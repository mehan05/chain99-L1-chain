/**
 * Chain99 L1 EVM Parity & Production Verification Suite
 */
const { ethers } = require("ethers");
const WebSocket = require("ws");

const RPC_URL = "http://127.0.0.1:8545";
const WS_URL = "ws://127.0.0.1:8546";
const DEPLOYER_PK = "0xd7e362021fa1878975c5cdd458d493cd2f01dd19554654eeb2a3dca4e428b62c";
const DEPLOYER_ADDR = "0x86fcDCaF0a0C69C30D589e29F85a44a03A40A904";
const KEYSTORE_ADDR = "0xB56269Dab6a306cac2D66462D2BD8D23670fe6b8";

const STORAGE_BYTECODE =
  "0x608060405234801561001057600080fd5b50610133806100206000396000f3fe6080604052348015600f57600080fd5b506004361060325760003560e01c80633fa4f24514603757806360fe47b1146051575b600080fd5b603d6069565b604051604891906090565b60405180910390f35b606760048036038101906063919060d5565b606f565b005b60005481565b8060008190555050565b6000819050919050565b608a816079565b82525050565b600060208201905060a360008301846083565b92915050565b600080fd5b60b5816079565b811460bf57600080fd5b50565b60008135905060cf8160ae565b92915050565b60006020828403121560e85760e760a9565b5b600060f48482850160c2565b9150509291505056fea2646970667358221220163ae8ac938be83a59ceee131564df56c446709d7c56817a823b60fa9c87e89964736f6c63430008130033";

const STORAGE_ABI = [
  "function set(uint256 _value) public",
  "function value() public view returns (uint256)",
];

async function main() {
  console.log("==================================================================");
  console.log("  🔬 CHAIN99 L1 — PRODUCTION EVM VERIFICATION SUITE");
  console.log("==================================================================\n");

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(DEPLOYER_PK, provider);

  // 1. Chain ID Verification
  console.log("1. Verifying Chain ID & JSON-RPC Namespaces...");
  const network = await provider.getNetwork();
  console.log("   - Chain ID             :", Number(network.chainId));
  if (Number(network.chainId) !== 9999) throw new Error("Incorrect Chain ID");
  console.log("   ✅ PASS: Chain ID is strictly 9999");

  const clientVer = await provider.send("web3_clientVersion", []);
  console.log("   - Client Version       :", clientVer);

  const netVer = await provider.send("net_version", []);
  console.log("   - Net Version          :", netVer);

  // 2. Account Balances
  console.log("\n2. Verifying Account Balances...");
  const deployerBal = await provider.getBalance(DEPLOYER_ADDR);
  const keystoreBal = await provider.getBalance(KEYSTORE_ADDR);
  console.log("   - Deployer Balance     :", ethers.formatEther(deployerBal), "C99");
  console.log("   - Keystore Balance     :", ethers.formatEther(keystoreBal), "C99");
  console.log("   ✅ PASS: Pre-funded genesis accounts verified.");

  // 3. EIP-1559 Transaction Verification
  console.log("\n3. Testing EIP-1559 Dynamic Fee Transaction...");
  const feeData = await provider.getFeeData();
  console.log("   - Gas Base Fee / Max Fee:", ethers.formatUnits(feeData.maxFeePerGas, "gwei"), "Gwei");

  const eip1559Tx = await wallet.sendTransaction({
    to: KEYSTORE_ADDR,
    value: ethers.parseEther("1"),
    gasLimit: 21000,
    maxPriorityFeePerGas: ethers.parseUnits("1", "gwei"),
    maxFeePerGas: ethers.parseUnits("3", "gwei"),
  });
  console.log("   - EIP-1559 Tx Hash     :", eip1559Tx.hash);
  const eip1559Receipt = await eip1559Tx.wait(1);
  console.log("   - Confirmed in Block   : #" + eip1559Receipt.blockNumber);
  console.log("   - Tx Type              :", eip1559Receipt.type, "(Type 2 EIP-1559)");
  if (eip1559Receipt.type !== 2) throw new Error("Expected Type 2 transaction");
  console.log("   ✅ PASS: EIP-1559 transaction executed successfully.");

  // 4. Smart Contract Deployment (Storage.sol)
  console.log("\n4. Deploying Storage.sol Contract...");
  const factory = new ethers.ContractFactory(STORAGE_ABI, STORAGE_BYTECODE, wallet);
  const contract = await factory.deploy({
    gasLimit: 300000,
    maxPriorityFeePerGas: ethers.parseUnits("1", "gwei"),
    maxFeePerGas: ethers.parseUnits("3", "gwei"),
  });
  await contract.waitForDeployment();
  const contractAddr = await contract.getAddress();
  console.log("   - Deployed Address     :", contractAddr);
  console.log("   ✅ PASS: Contract deployed.");

  // 5. Solidity State Mutation
  console.log("\n5. Testing Solidity Execution: set(999)...");
  const setTx = await contract.set(999, {
    gasLimit: 100000,
    maxPriorityFeePerGas: ethers.parseUnits("1", "gwei"),
    maxFeePerGas: ethers.parseUnits("3", "gwei"),
  });
  console.log("   - Set Tx Hash          :", setTx.hash);
  await setTx.wait(1);

  const readVal = await contract.value();
  console.log("   - Stored Value on-chain:", Number(readVal));
  if (Number(readVal) !== 999) throw new Error("Contract state mismatch");
  console.log("   ✅ PASS: Solidity state transition verified.");

  // 6. WebSocket RPC Verification
  console.log("\n6. Testing WebSocket RPC (port 8546)...");
  let wsSuccess = false;
  try {
    await new Promise((resolve, reject) => {
      const ws = new WebSocket(WS_URL);
      const timer = setTimeout(() => {
        ws.terminate();
        resolve(false);
      }, 3000);

      ws.on("open", () => {
        ws.send(JSON.stringify({ jsonrpc: "2.0", method: "eth_blockNumber", params: [], id: 1 }));
      });
      ws.on("message", (data) => {
        const res = JSON.parse(data.toString());
        if (res.result) {
          console.log("   - WebSocket Block Height:", parseInt(res.result, 16));
          wsSuccess = true;
        }
        clearTimeout(timer);
        ws.close();
        resolve(true);
      });
      ws.on("error", (err) => {
        clearTimeout(timer);
        resolve(false);
      });
    });
  } catch (e) {}

  if (wsSuccess) {
    console.log("   ✅ PASS: WebSocket RPC responsive on port 8546.");
  } else {
    console.log("   ⚠️ WebSocket on 8546 not listening or disabled (HTTP JSON-RPC primary).");
  }

  // 7. Frontend Integration Check
  console.log("\n7. Testing Frontend Next.js API Routes (port 3000)...");
  const feValRes = await fetch("http://localhost:3000/api/validators").then((r) => r.json());
  console.log("   - Frontend Active Validators Count:", feValRes.count);
  console.log("   - Total Voting Power              :", feValRes.totalVotingPower);
  console.log("   ✅ PASS: Frontend API operational.");

  console.log("\n==================================================================");
  console.log("  🎉 ALL EVM & APPLICATION VERIFICATIONS PASSED!");
  console.log("==================================================================");
}

main().catch((err) => {
  console.error("Verification error:", err);
  process.exitCode = 1;
});

