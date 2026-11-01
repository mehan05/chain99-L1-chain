const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Chain99 L1 — C99Staking (Proof-of-Stake Validator Governance)", function () {
  let staking;
  let owner, validator1, validator2, delegator1, delegator2, reporter;
  const MIN_SELF_BOND = ethers.parseEther("10000"); // 10,000 C99
  const DUMMY_PUBKEY_1 = ethers.hexlify(ethers.randomBytes(32));
  const DUMMY_PUBKEY_2 = ethers.hexlify(ethers.randomBytes(32));

  beforeEach(async function () {
    [owner, validator1, validator2, delegator1, delegator2, reporter] = await ethers.getSigners();

    const C99Staking = await ethers.getContractFactory("C99Staking");
    staking = await C99Staking.deploy(reporter.address, 3600); // 1 hour unbonding for test
    await staking.waitForDeployment();
  });

  describe("1. Validator Registration & Self-Bonding", function () {
    it("Should successfully register a validator with minimum self-bond", async function () {
      await expect(
        staking.connect(validator1).registerValidator(
          DUMMY_PUBKEY_1,
          "Node-Alpha",
          500, // 5% commission
          { value: MIN_SELF_BOND }
        )
      ).to.emit(staking, "ValidatorRegistered")
       .withArgs(validator1.address, DUMMY_PUBKEY_1, "Node-Alpha", MIN_SELF_BOND, 500);

      const details = await staking.getValidatorDetails(validator1.address);
      expect(details.operator).to.equal(validator1.address);
      expect(details.moniker).to.equal("Node-Alpha");
      expect(details.selfBond).to.equal(MIN_SELF_BOND);
      expect(details.totalBonded).to.equal(MIN_SELF_BOND);
      expect(details.votingPower).to.equal(10000n); // 10,000 units
      expect(details.isActive).to.be.true;
    });

    it("Should reject registration below minimum self-bond", async function () {
      await expect(
        staking.connect(validator1).registerValidator(
          DUMMY_PUBKEY_1,
          "Node-Alpha",
          500,
          { value: ethers.parseEther("9999") }
        )
      ).to.be.revertedWith("C99Staking: self-bond below minimum");
    });
  });

  describe("2. Native C99 Delegation & Stake-Weighted Voting Power", function () {
    beforeEach(async function () {
      await staking.connect(validator1).registerValidator(DUMMY_PUBKEY_1, "Node-Alpha", 500, { value: MIN_SELF_BOND });
      await staking.connect(validator2).registerValidator(DUMMY_PUBKEY_2, "Node-Beta", 1000, { value: MIN_SELF_BOND });
    });

    it("Should accurately scale voting power when delegators bond C99", async function () {
      const delegationAmount = ethers.parseEther("5000"); // 5,000 C99
      await staking.connect(delegator1).delegate(validator1.address, { value: delegationAmount });

      const power1 = await staking.getVotingPower(validator1.address);
      const power2 = await staking.getVotingPower(validator2.address);

      expect(power1).to.equal(15000n); // 10,000 + 5,000
      expect(power2).to.equal(10000n); // 10,000
    });

    it("Should track active validator list correctly", async function () {
      const activeValidators = await staking.getActiveValidators();
      expect(activeValidators.length).to.equal(2);
      expect(activeValidators[0]).to.equal(validator1.address);
      expect(activeValidators[1]).to.equal(validator2.address);
    });
  });

  describe("3. Unbonding Queue & Flash-Loan Protection", function () {
    beforeEach(async function () {
      await staking.connect(validator1).registerValidator(DUMMY_PUBKEY_1, "Node-Alpha", 500, { value: MIN_SELF_BOND });
      await staking.connect(delegator1).delegate(validator1.address, { value: ethers.parseEther("5000") });
    });

    it("Should prevent immediate withdrawal before unbonding period expires", async function () {
      await staking.connect(delegator1).undelegate(validator1.address, ethers.parseEther("2000"));

      // Voting power immediately decrements
      expect(await staking.getVotingPower(validator1.address)).to.equal(13000n);

      // Attempt immediate withdrawal
      await expect(
        staking.connect(delegator1).withdrawUnbonded(0)
      ).to.be.revertedWith("C99Staking: unbonding period not expired");
    });

    it("Should allow withdrawal after unbonding duration elapses", async function () {
      await staking.connect(delegator1).undelegate(validator1.address, ethers.parseEther("2000"));

      // Advance time by 3601 seconds
      await ethers.provider.send("evm_increaseTime", [3601]);
      await ethers.provider.send("evm_mine");

      const balanceBefore = await ethers.provider.getBalance(delegator1.address);
      const tx = await staking.connect(delegator1).withdrawUnbonded(0);
      const receipt = await tx.wait();
      const gasSpent = receipt.gasUsed * receipt.gasPrice;
      const balanceAfter = await ethers.provider.getBalance(delegator1.address);

      expect(balanceAfter + gasSpent - balanceBefore).to.equal(ethers.parseEther("2000"));
    });
  });

  describe("4. Slashing & Byzantine Infraction Penalties", function () {
    beforeEach(async function () {
      await staking.connect(validator1).registerValidator(DUMMY_PUBKEY_1, "Node-Alpha", 500, { value: MIN_SELF_BOND });
      await staking.connect(delegator1).delegate(validator1.address, { value: ethers.parseEther("10000") }); // Total: 20,000 C99
    });

    it("Should execute 5% slash and permanent tombstone on Double-Signing (Equivocation)", async function () {
      // 5% of 20,000 = 1,000 C99 slashed
      await expect(
        staking.connect(reporter).slash(validator1.address, 1)
      ).to.emit(staking, "ValidatorSlashed")
       .withArgs(validator1.address, 1, ethers.parseEther("1000"), true);

      const details = await staking.getValidatorDetails(validator1.address);
      expect(details.isTombstoned).to.be.true;
      expect(details.votingPower).to.equal(0n); // Stripped of consensus voting power

      const active = await staking.getActiveValidators();
      expect(active).to.not.include(validator1.address);
    });

    it("Should execute 0.1% slash and temporary jail on Downtime (Liveness failure)", async function () {
      // 0.1% of 20,000 = 20 C99 slashed
      await expect(
        staking.connect(reporter).slash(validator1.address, 2)
      ).to.emit(staking, "ValidatorSlashed")
       .withArgs(validator1.address, 2, ethers.parseEther("20"), false);

      const details = await staking.getValidatorDetails(validator1.address);
      expect(details.isJailed).to.be.true;
      expect(details.isTombstoned).to.be.false;
      expect(details.votingPower).to.equal(0n); // Zero power while jailed

      // Try to unjail early
      await expect(staking.connect(validator1).unjail()).to.be.revertedWith("C99Staking: jail duration not expired");

      // Advance time by 11 minutes
      await ethers.provider.send("evm_increaseTime", [660]);
      await ethers.provider.send("evm_mine");

      await staking.connect(validator1).unjail();
      const updatedDetails = await staking.getValidatorDetails(validator1.address);
      expect(updatedDetails.isJailed).to.be.false;
      expect(updatedDetails.votingPower).to.equal(19980n); // 20,000 - 20
    });
  });

  describe("5. Protocol Rewards Distribution", function () {
    beforeEach(async function () {
      await staking.connect(validator1).registerValidator(DUMMY_PUBKEY_1, "Node-Alpha", 500, { value: MIN_SELF_BOND });
    });

    it("Should distribute rewards to stakers", async function () {
      // Deposit 100 C99 as protocol rewards
      await staking.connect(owner).depositRewards({ value: ethers.parseEther("100") });

      const balanceBefore = await ethers.provider.getBalance(validator1.address);
      const tx = await staking.connect(validator1).claimRewards(validator1.address);
      const receipt = await tx.wait();
      const gasSpent = receipt.gasUsed * receipt.gasPrice;
      const balanceAfter = await ethers.provider.getBalance(validator1.address);

      expect(balanceAfter + gasSpent - balanceBefore).to.equal(ethers.parseEther("100"));
    });
  });
});
