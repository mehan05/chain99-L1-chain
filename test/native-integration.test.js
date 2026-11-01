/**
 * Chain99 Production-Grade Proof-of-Stake L1 Integration Test Suite
 *
 * Verifies live CometBFT consensus, 4-node agreement, EVM execution,
 * native staking precompile, voting power reflection, and liveness tracking.
 */

const { ethers } = require("ethers");
const axios = require("axios");

const DEPLOYER_PK = "0xd7e362021fa1878975c5cdd458d493cd2f01dd19554654eeb2a3dca4e428b62c";
const PRECOMPILE_STAKING = "0x0000000000000000000000000000000000000800";

const STAKING_ABI = [
  "function delegate(address delegatorAddress, string validatorAddress, uint256 amount) external returns (bool)",
  "function undelegate(address delegatorAddress, string validatorAddress, uint256 amount) external returns (int64)",
  "function redelegate(address delegatorAddress, string validatorSrcAddress, string validatorDstAddress, uint256 amount) external returns (int64)",
  "function delegation(address delegatorAddress, string validatorAddress) external view returns (uint256 shares, tuple(string denom, uint256 amount) balance)",
  "function unbondingDelegation(address delegatorAddress, string validatorAddress) external view returns (tuple(string delegatorAddress, string validatorAddress, tuple(int64 creationHeight, int64 completionTime, uint256 initialBalance, uint256 balance, uint64 unbondingId, int64 unbondingOnHoldRefCount)[] entries))"
];

const NODES = [
  { name: "Node 1", rpc: "http://127.0.0.1:26657", evm: "http://127.0.0.1:8545" },
  { name: "Node 2", rpc: "http://127.0.0.1:26667", evm: "http://127.0.0.1:8555" },
  { name: "Node 3", rpc: "http://127.0.0.1:26677", evm: "http://127.0.0.1:8565" },
  { name: "Node 4", rpc: "http://127.0.0.1:26687", evm: "http://127.0.0.1:8575" },
];

async function main() {
  console.log("==================================================================");
  console.log("  🧪 CHAIN99 L1 — NATIVE PROOF-OF-STAKE INTEGRATION TEST SUITE");
  console.log("==================================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`   ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`   ❌ FAIL: ${message}`);
      failed++;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // TEST GROUP 1: MULTI-VALIDATOR COMETBFT CONSENSUS AGREEMENT
  // ─────────────────────────────────────────────────────────────
  console.log("TEST 1: 4-Node Consensus & Hash Agreement");
  const blockHeights = [];
  const blockHashes = [];

  for (const node of NODES) {
    try {
      const res = await axios.get(`${node.rpc}/status`);
      const syncInfo = res.data.result.sync_info;
      const height = parseInt(syncInfo.latest_block_height, 10);
      blockHeights.push(height);
      console.log(`   - ${node.name} Height: #${height} | Hash: ${syncInfo.latest_block_hash.substring(0, 16)}...`);
    } catch (e) {
      console.error(`   - ${node.name} unreachable: ${e.message}`);
    }
  }

  assert(blockHeights.length === 4, "All 4 independent validators responded to CometBFT RPC");
  const minHeight = Math.min(...blockHeights);
  assert(minHeight > 0, `Network is advancing blocks (current height: #${minHeight})`);

  // Query block at fixed height to verify hash agreement
  const testHeight = Math.max(1, minHeight - 5);
  console.log(`\nVerifying deterministic BFT hash agreement at block #${testHeight}...`);
  for (const node of NODES) {
    const res = await axios.get(`${node.rpc}/block?height=${testHeight}`);
    blockHashes.push(res.data.result.block_id.hash);
  }
  const allEqual = blockHashes.every((h) => h === blockHashes[0]);
  assert(allEqual, `All 4 validators committed the exact same block hash at #${testHeight}: ${blockHashes[0]}`);

  // ─────────────────────────────────────────────────────────────
  // TEST GROUP 2: STAKE-WEIGHTED VOTING POWER IN COMETBFT
  // ─────────────────────────────────────────────────────────────
  console.log("\nTEST 2: Authoritative CometBFT Validator Set & Voting Power");
  const valRes = await axios.get(`${NODES[0].rpc}/validators`);
  const validators = valRes.data.result.validators;

  assert(validators.length === 4, `Consensus validator set contains exactly 4 active validators`);
  const powers = validators.map(v => parseInt(v.voting_power, 10)).sort((a, b) => a - b);
  console.log(`   - Consensus Voting Powers: [${powers.join(", ")}]`);
  assert(powers.every(p => p >= 10000), "All validators have voting power >= 10,000 (minimum self-bond)");

  // ─────────────────────────────────────────────────────────────
  // TEST GROUP 3: EVM JSON-RPC & ETHEREUM COMPATIBILITY
  // ─────────────────────────────────────────────────────────────
  console.log("\nTEST 3: Modern EVM JSON-RPC Parity & EIP-1559");
  const provider = new ethers.JsonRpcProvider(NODES[0].evm);
  const wallet = new ethers.Wallet(DEPLOYER_PK, provider);

  const net = await provider.getNetwork();
  assert(net.chainId === 9999n, `EVM Chain ID is exactly 9999 (received: ${net.chainId})`);

  const balance = await provider.getBalance(wallet.address);
  assert(balance > ethers.parseEther("900000"), `Deployer has expected genesis C99 balance: ${ethers.formatEther(balance)} C99`);

  // EIP-1559 transfer
  console.log("   - Executing EIP-1559 type 2 transaction...");
  const txEip1559 = await wallet.sendTransaction({
    to: "0xB56269Dab6a306cac2D66462D2BD8D23670fe6b8",
    value: ethers.parseEther("1.0"),
    maxPriorityFeePerGas: ethers.parseUnits("1", "gwei"),
    maxFeePerGas: ethers.parseUnits("3", "gwei"),
  });
  const receiptEip1559 = await txEip1559.wait();
  assert(receiptEip1559.status === 1, `EIP-1559 transaction committed in block #${receiptEip1559.blockNumber}`);
  assert(receiptEip1559.type === 2, `Transaction type is 2 (EIP-1559 dynamic fee)`);

  // ─────────────────────────────────────────────────────────────
  // TEST GROUP 4: NATIVE EVM STAKING PRECOMPILE (0x800)
  // ─────────────────────────────────────────────────────────────
  console.log("\nTEST 4: Native EVM Staking Precompile Operations");
  const stakingContract = new ethers.Contract(PRECOMPILE_STAKING, STAKING_ABI, wallet);

  // Fetch validator 1 operator address
  const cosmosValsRes = await axios.get("http://127.0.0.1:1317/cosmos/staking/v1beta1/validators");
  const val1 = cosmosValsRes.data.validators.find(v => v.description.moniker === "validatorA" || v.description.moniker === "validator1") || cosmosValsRes.data.validators[0];
  const val1OpAddr = val1.operator_address;
  console.log(`   - Validator 1 Operator Address: ${val1OpAddr}`);

  // Query initial delegation
  const initDel = await stakingContract.delegation(wallet.address, val1OpAddr);
  console.log(`   - Initial delegation: ${ethers.formatEther(initDel.balance.amount)} C99`);

  // Delegate 1,000 C99
  console.log("   - Delegating 1,000 C99 via precompile 0x800...");
  const delegateTx = await stakingContract.delegate(wallet.address, val1OpAddr, ethers.parseEther("1000"), { gasLimit: 400000 });
  const delegateReceipt = await delegateTx.wait();
  assert(delegateReceipt.status === 1, `delegate() executed in block #${delegateReceipt.blockNumber} (Gas used: ${delegateReceipt.gasUsed})`);

  // Verify updated delegation
  const updatedDel = await stakingContract.delegation(wallet.address, val1OpAddr);
  assert(updatedDel.balance.amount > initDel.balance.amount, `Delegation balance successfully increased to: ${ethers.formatEther(updatedDel.balance.amount)} C99`);

  // Undelegate 500 C99
  console.log("   - Undelegating 500 C99 via precompile 0x800...");
  const undelegateTx = await stakingContract.undelegate(wallet.address, val1OpAddr, ethers.parseEther("500"), { gasLimit: 400000 });
  const undelegateReceipt = await undelegateTx.wait();
  assert(undelegateReceipt.status === 1, `undelegate() executed in block #${undelegateReceipt.blockNumber}`);

  // Verify unbonding queue entry
  const unbonding = await stakingContract.unbondingDelegation(wallet.address, val1OpAddr);
  const entries = unbonding[2] || unbonding.entries;
  assert(entries && entries.length > 0, `Unbonding queue contains ${entries.length} active time-lock entries`);
  const firstBalance = entries[0].balance !== undefined ? entries[0].balance : entries[0][3];
  assert(firstBalance > 0n, `Unbonding entry amount: ${ethers.formatEther(firstBalance)} C99`);

  // ─────────────────────────────────────────────────────────────
  // TEST GROUP 5: NATIVE LIVENESS & SLASHING TRACKING
  // ─────────────────────────────────────────────────────────────
  console.log("\nTEST 5: Native Slashing & Signing Info Tracking");
  const slashingRes = await axios.get("http://127.0.0.1:1317/cosmos/slashing/v1beta1/signing_infos");
  const signingInfos = slashingRes.data.info;
  assert(signingInfos.length === 4, `Slashing module actively tracks all 4 validator signing records`);

  const trackedHeights = signingInfos.map(s => parseInt(s.index_offset, 10));
  assert(trackedHeights.every(h => h > 0), `Slashing sliding window indexes are updating dynamically across blocks`);

  console.log("\n==================================================================");
  console.log(`  🎉 INTEGRATION TEST SUMMARY: ${passed} PASSED / ${failed} FAILED`);
  console.log("==================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
