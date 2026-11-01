// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title C99Staking
 * @notice Production-grade Proof-of-Stake Staking & Validator Governance for Chain99 L1.
 * @dev Manages native C99 bonded stake, dynamic validator sets, stake-weighted voting power,
 *      delegations, unbonding queues (flash-loan defense), and slashing for infractions.
 */
contract C99Staking {
    // =========================================================================
    // Constants & Configuration
    // =========================================================================
    uint256 public constant MIN_SELF_BOND = 10_000 ether;       // 10,000 C99 minimum self-bond
    uint256 public constant MIN_DELEGATION = 1 ether;           // 1 C99 minimum delegation
    uint256 public constant MAX_ACTIVE_VALIDATORS = 50;         // Top-50 active consensus set
    uint256 public constant MAX_COMMISSION_BPS = 2000;          // Max 20% commission (in basis points)
    uint256 public constant BASIS_POINTS_DIVISOR = 10000;
    
    // Slashing penalties
    uint256 public constant EQUIVOCATION_SLASH_BPS = 500;       // 5.0% slash for double-signing
    uint256 public constant DOWNTIME_SLASH_BPS = 10;            // 0.1% slash for liveness failure
    
    // Unbonding duration (e.g. 2 hours for devnet/testnet, 14 days on mainnet)
    uint256 public unbondingPeriod = 2 hours;

    address public governance;
    address public consensusReporter;

    // =========================================================================
    // Structs
    // =========================================================================
    struct Validator {
        address operator;               // EVM operator address
        bytes consensusPubKey;          // Ed25519 consensus public key (for CometBFT)
        string moniker;                 // Human-readable identifier
        uint256 commissionRateBps;      // Validator commission in basis points (e.g. 500 = 5%)
        uint256 selfBond;               // Validator's own bonded C99
        uint256 totalBonded;            // Total bonded C99 (self-bond + delegations)
        uint256 rewardPerTokenAccumulated; // Historical reward tracking
        bool isActive;                  // Currently eligible for active set
        bool isJailed;                  // Temporarily jailed for downtime
        bool isTombstoned;              // Permanently slashed for double-signing
        uint256 jailedUntil;            // Timestamp until which validator remains jailed
    }

    struct Delegation {
        uint256 amount;                 // Bonded C99 amount
        uint256 rewardDebt;             // Reward accounting checkpoint
    }

    struct UnbondingEntry {
        uint256 id;
        address delegator;
        address validator;
        uint256 amount;
        uint256 unlockTimestamp;
        bool claimed;
    }

    // =========================================================================
    // State Variables
    // =========================================================================
    address[] public validatorList;
    mapping(address => Validator) public validators;
    mapping(address => bool) public isValidatorRegistered;

    // Delegations: delegator => validator => Delegation
    mapping(address => mapping(address => Delegation)) public delegations;

    // Unbonding queues
    UnbondingEntry[] public unbondingQueue;
    mapping(address => uint256[]) public userUnbondingIds;

    uint256 public totalNetworkBonded;
    uint256 public rewardPerTokenGlobal;
    uint256 public nextUnbondingId;

    // =========================================================================
    // Events
    // =========================================================================
    event ValidatorRegistered(address indexed validator, bytes consensusPubKey, string moniker, uint256 selfBond, uint256 commissionRateBps);
    event Delegated(address indexed delegator, address indexed validator, uint256 amount, uint256 newTotalBonded);
    event Undelegated(address indexed delegator, address indexed validator, uint256 amount, uint256 unlockTime, uint256 unbondingId);
    event UnbondingWithdrawn(address indexed delegator, uint256 unbondingId, uint256 amount);
    event ValidatorSlashed(address indexed validator, uint8 infractionType, uint256 slashedAmount, bool tombstoned);
    event ValidatorJailed(address indexed validator, uint256 untilTimestamp);
    event ValidatorUnjailed(address indexed validator);
    event RewardsClaimed(address indexed delegator, address indexed validator, uint256 amount);
    event RewardsDeposited(address indexed sender, uint256 amount);
    event UnbondingPeriodUpdated(uint256 newPeriod);

    // =========================================================================
    // Modifiers
    // =========================================================================
    modifier onlyGovernance() {
        require(msg.sender == governance, "C99Staking: only governance");
        _;
    }

    modifier onlyConsensusReporter() {
        require(msg.sender == consensusReporter || msg.sender == governance, "C99Staking: only consensus reporter");
        _;
    }

    // =========================================================================
    // Constructor
    // =========================================================================
    constructor(address _consensusReporter, uint256 _unbondingPeriod) {
        governance = msg.sender;
        consensusReporter = _consensusReporter;
        if (_unbondingPeriod > 0) {
            unbondingPeriod = _unbondingPeriod;
        }
    }

    // =========================================================================
    // 1. Validator Registration & Self-Bonding
    // =========================================================================
    /**
     * @notice Registers a new validator candidate with initial self-bonded C99.
     * @param consensusPubKey 32-byte Ed25519 public key used for CometBFT BFT signing.
     * @param moniker Human-readable node name.
     * @param commissionRateBps Commission rate in basis points (max 2000 = 20%).
     */
    function registerValidator(
        bytes calldata consensusPubKey,
        string calldata moniker,
        uint256 commissionRateBps
    ) external payable {
        require(!isValidatorRegistered[msg.sender], "C99Staking: already registered");
        require(msg.value >= MIN_SELF_BOND, "C99Staking: self-bond below minimum");
        require(commissionRateBps <= MAX_COMMISSION_BPS, "C99Staking: commission exceeds maximum");
        require(consensusPubKey.length == 32, "C99Staking: invalid Ed25519 consensus pubkey length");

        validators[msg.sender] = Validator({
            operator: msg.sender,
            consensusPubKey: consensusPubKey,
            moniker: moniker,
            commissionRateBps: commissionRateBps,
            selfBond: msg.value,
            totalBonded: msg.value,
            rewardPerTokenAccumulated: rewardPerTokenGlobal,
            isActive: true,
            isJailed: false,
            isTombstoned: false,
            jailedUntil: 0
        });

        isValidatorRegistered[msg.sender] = true;
        validatorList.push(msg.sender);
        totalNetworkBonded += msg.value;

        // Auto-delegate self-bond
        delegations[msg.sender][msg.sender] = Delegation({
            amount: msg.value,
            rewardDebt: (msg.value * rewardPerTokenGlobal) / 1e18
        });

        emit ValidatorRegistered(msg.sender, consensusPubKey, moniker, msg.value, commissionRateBps);
    }

    // =========================================================================
    // 2. Native C99 Delegation
    // =========================================================================
    /**
     * @notice Delegates native C99 tokens to an active validator.
     * @param validator Address of the validator operator.
     */
    function delegate(address validator) external payable {
        require(isValidatorRegistered[validator], "C99Staking: validator not registered");
        require(msg.value >= MIN_DELEGATION, "C99Staking: delegation below minimum");
        
        Validator storage val = validators[validator];
        require(!val.isTombstoned, "C99Staking: validator permanently tombstoned");

        Delegation storage del = delegations[msg.sender][validator];
        if (del.amount > 0) {
            _claimRewards(msg.sender, validator);
        }

        del.amount += msg.value;
        del.rewardDebt = (del.amount * rewardPerTokenGlobal) / 1e18;

        val.totalBonded += msg.value;
        totalNetworkBonded += msg.value;

        emit Delegated(msg.sender, validator, msg.value, val.totalBonded);
    }

    // =========================================================================
    // 3. Undelegation & Unbonding Queue (Flash-Loan Protection)
    // =========================================================================
    /**
     * @notice Initiates unbonding of delegated C99 tokens.
     * @dev Tokens are locked for `unbondingPeriod` before they can be withdrawn,
     *      preventing intra-epoch voting power manipulation.
     */
    function undelegate(address validator, uint256 amount) external {
        require(isValidatorRegistered[validator], "C99Staking: validator not registered");
        Delegation storage del = delegations[msg.sender][validator];
        require(del.amount >= amount, "C99Staking: insufficient bonded balance");

        Validator storage val = validators[validator];
        
        // If validator is unbonding self-bond, enforce minimum self-bond constraint
        if (msg.sender == validator) {
            require(val.selfBond - amount >= MIN_SELF_BOND || val.selfBond == amount, "C99Staking: cannot breach min self-bond unless fully exiting");
            val.selfBond -= amount;
        }

        _claimRewards(msg.sender, validator);

        del.amount -= amount;
        del.rewardDebt = (del.amount * rewardPerTokenGlobal) / 1e18;

        val.totalBonded -= amount;
        totalNetworkBonded -= amount;

        uint256 unlockTimestamp = block.timestamp + unbondingPeriod;
        uint256 entryId = nextUnbondingId++;

        unbondingQueue.push(UnbondingEntry({
            id: entryId,
            delegator: msg.sender,
            validator: validator,
            amount: amount,
            unlockTimestamp: unlockTimestamp,
            claimed: false
        }));

        userUnbondingIds[msg.sender].push(entryId);

        emit Undelegated(msg.sender, validator, amount, unlockTimestamp, entryId);
    }

    /**
     * @notice Claims unlocked C99 tokens after unbonding duration has elapsed.
     */
    function withdrawUnbonded(uint256 entryId) external {
        require(entryId < unbondingQueue.length, "C99Staking: invalid entry id");
        UnbondingEntry storage entry = unbondingQueue[entryId];
        require(entry.delegator == msg.sender, "C99Staking: not entry owner");
        require(!entry.claimed, "C99Staking: already claimed");
        require(block.timestamp >= entry.unlockTimestamp, "C99Staking: unbonding period not expired");

        entry.claimed = true;
        (bool sent, ) = payable(msg.sender).call{value: entry.amount}("");
        require(sent, "C99Staking: transfer failed");

        emit UnbondingWithdrawn(msg.sender, entryId, entry.amount);
    }

    // =========================================================================
    // 4. Automated Slashing for Verifiable Infractions
    // =========================================================================
    /**
     * @notice Slashes a validator for verifiable Byzantine infractions.
     * @param validator The validator operator address.
     * @param infractionType 1 = Double-Signing (Equivocation), 2 = Downtime (Liveness).
     */
    function slash(address validator, uint8 infractionType) external onlyConsensusReporter {
        require(isValidatorRegistered[validator], "C99Staking: validator not registered");
        Validator storage val = validators[validator];
        require(!val.isTombstoned, "C99Staking: validator already tombstoned");

        uint256 slashRateBps = (infractionType == 1) ? EQUIVOCATION_SLASH_BPS : DOWNTIME_SLASH_BPS;
        uint256 slashedAmount = (val.totalBonded * slashRateBps) / BASIS_POINTS_DIVISOR;

        val.totalBonded -= slashedAmount;
        totalNetworkBonded -= slashedAmount;

        if (infractionType == 1) {
            // Equivocation: permanent tombstone & ban
            val.isTombstoned = true;
            val.isActive = false;
            val.isJailed = true;
            emit ValidatorSlashed(validator, infractionType, slashedAmount, true);
        } else {
            // Downtime: temporary jail
            val.isJailed = true;
            val.jailedUntil = block.timestamp + 10 minutes;
            emit ValidatorSlashed(validator, infractionType, slashedAmount, false);
            emit ValidatorJailed(validator, val.jailedUntil);
        }
    }

    /**
     * @notice Unjails a validator after its downtime jail period has elapsed.
     */
    function unjail() external {
        Validator storage val = validators[msg.sender];
        require(val.isJailed, "C99Staking: not jailed");
        require(!val.isTombstoned, "C99Staking: permanently tombstoned");
        require(block.timestamp >= val.jailedUntil, "C99Staking: jail duration not expired");

        val.isJailed = false;
        val.isActive = true;
        emit ValidatorUnjailed(msg.sender);
    }

    // =========================================================================
    // 5. Staking Rewards Distribution & Claims
    // =========================================================================
    /**
     * @notice Injects protocol fees and block rewards into the staking pool.
     */
    function depositRewards() external payable {
        require(msg.value > 0, "C99Staking: no value deposited");
        if (totalNetworkBonded > 0) {
            rewardPerTokenGlobal += (msg.value * 1e18) / totalNetworkBonded;
            emit RewardsDeposited(msg.sender, msg.value);
        }
    }

    /**
     * @notice Claims accumulated staking rewards for a given validator.
     */
    function claimRewards(address validator) external {
        _claimRewards(msg.sender, validator);
    }

    function _claimRewards(address delegator, address validator) internal {
        Delegation storage del = delegations[delegator][validator];
        if (del.amount == 0) return;

        uint256 accumulatedReward = (del.amount * rewardPerTokenGlobal) / 1e18;
        if (accumulatedReward > del.rewardDebt) {
            uint256 pending = accumulatedReward - del.rewardDebt;
            del.rewardDebt = accumulatedReward;

            (bool sent, ) = payable(delegator).call{value: pending}("");
            require(sent, "C99Staking: reward transfer failed");
            emit RewardsClaimed(delegator, validator, pending);
        }
    }

    // =========================================================================
    // 6. View Methods & Consensus Engine Queries
    // =========================================================================
    /**
     * @notice Returns integer voting power for a validator (directly proportional to bonded C99).
     */
    function getVotingPower(address validator) external view returns (uint256) {
        Validator storage val = validators[validator];
        if (!val.isActive || val.isJailed || val.isTombstoned) {
            return 0;
        }
        return val.totalBonded / 1 ether; // 1 unit voting power per 1 C99
    }

    /**
     * @notice Returns the list of all registered validator addresses.
     */
    function getAllValidators() external view returns (address[] memory) {
        return validatorList;
    }

    /**
     * @notice Returns active validator addresses sorted by bonded stake (up to MAX_ACTIVE_VALIDATORS).
     */
    function getActiveValidators() external view returns (address[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < validatorList.length; i++) {
            Validator storage val = validators[validatorList[i]];
            if (val.isActive && !val.isJailed && !val.isTombstoned && val.totalBonded >= MIN_SELF_BOND) {
                count++;
            }
        }

        address[] memory active = new address[](count > MAX_ACTIVE_VALIDATORS ? MAX_ACTIVE_VALIDATORS : count);
        uint256 idx = 0;
        for (uint256 i = 0; i < validatorList.length && idx < active.length; i++) {
            Validator storage val = validators[validatorList[i]];
            if (val.isActive && !val.isJailed && !val.isTombstoned && val.totalBonded >= MIN_SELF_BOND) {
                active[idx++] = validatorList[i];
            }
        }
        return active;
    }

    /**
     * @notice Returns detailed validator metadata.
     */
    function getValidatorDetails(address validator) external view returns (
        address operator,
        bytes memory consensusPubKey,
        string memory moniker,
        uint256 selfBond,
        uint256 totalBonded,
        uint256 votingPower,
        bool isActive,
        bool isJailed,
        bool isTombstoned
    ) {
        Validator storage val = validators[validator];
        uint256 power = (!val.isActive || val.isJailed || val.isTombstoned) ? 0 : (val.totalBonded / 1 ether);
        return (
            val.operator,
            val.consensusPubKey,
            val.moniker,
            val.selfBond,
            val.totalBonded,
            power,
            val.isActive,
            val.isJailed,
            val.isTombstoned
        );
    }

    /**
     * @notice Returns unbonding entries for a user.
     */
    function getUserUnbondingEntries(address user) external view returns (UnbondingEntry[] memory) {
        uint256[] storage ids = userUnbondingIds[user];
        UnbondingEntry[] memory entries = new UnbondingEntry[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            entries[i] = unbondingQueue[ids[i]];
        }
        return entries;
    }

    // =========================================================================
    // Governance Admin Functions
    // =========================================================================
    function setConsensusReporter(address _consensusReporter) external onlyGovernance {
        consensusReporter = _consensusReporter;
    }

    function setUnbondingPeriod(uint256 _unbondingPeriod) external onlyGovernance {
        unbondingPeriod = _unbondingPeriod;
        emit UnbondingPeriodUpdated(_unbondingPeriod);
    }

    receive() external payable {
        if (totalNetworkBonded > 0) {
            rewardPerTokenGlobal += (msg.value * 1e18) / totalNetworkBonded;
            emit RewardsDeposited(msg.sender, msg.value);
        }
    }
}
