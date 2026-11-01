# Chain99 Layer 1 — Production Proof-of-Stake Blockchain

Chain99 is a production-grade, EVM-compatible Layer 1 blockchain engineered with **Cosmos SDK v0.50**, **CometBFT v0.38** consensus, and **Cosmos EVM v20**.

The network features genuine stake-weighted Proof of Stake, deterministic 1-block BFT finality, an EVM Staking Precompile (`0x800`), an automated 4-validator local mesh devnet, a Next.js 16 Web3 block explorer & staking dashboard, and 100% Ethereum tooling compatibility (MetaMask, Hardhat, Ethers.js).

---

## 1. Network Parameters & Specifications

| Parameter / Endpoint | Specification / Value | Notes |
| :--- | :--- | :--- |
| **Consensus Engine** | CometBFT v0.38.12 | 2-phase BFT (Propose → Prevote → Precommit) |
| **Finality** | 1-Block Deterministic Finality | Finalized upon $> 2/3$ precommit signatures |
| **Cosmos Network ID** | `chain_9999-1` | Used in CometBFT consensus & transactions |
| **EVM Chain ID** | `9999` (`0x270f`) | Standard Ethereum JSON-RPC chain ID |
| **Native Token Symbol** | **C99** | Base denom: `ac99` ($1\text{ C99} = 10^{18}\text{ ac99}$) |
| **Authoritative State** | Cosmos SDK `x/staking` | Governs validator voting powers & set updates |
| **EVM Staking Precompile** | `0x0000000000000000000000000000000000000800` | Exposes `delegate`, `undelegate`, `redelegate` to EVM |
| **Unbonding Queue** | 14 days (devnet configurable) | Prevents flash-loan voting power attacks |
| **Slashing Penalties** | Equivocation: 5% + tombstone | Downtime: 0.1% + temporary jail |
| **Validator Devnet** | 4 Independent Nodes | Byzantine Fault Tolerant ($N \ge 3f + 1$, tolerates $f = 1$) |
| **Frontend Web3 Dashboard** | [http://localhost:3000](http://localhost:3000) | Live block explorer & PoS staking portal |
| **Validator 1 EVM JSON-RPC** | [http://127.0.0.1:8545](http://127.0.0.1:8545) | MetaMask & Ethereum Web3 HTTP endpoint |
| **Validator 1 EVM WebSocket** | `ws://127.0.0.1:8546` | Real-time `eth_subscribe` event streams |
| **Validator 1 CometBFT RPC** | [http://127.0.0.1:26657](http://127.0.0.1:26657) | Consensus status, block feed & validator set |
| **Validator 1 Cosmos REST API** | [http://127.0.0.1:1317](http://127.0.0.1:1317) | Cosmos SDK module queries |

---

## 2. Prerequisites

Before running the chain, ensure you have the following installed:
- **Go**: `1.22+` (or `1.24+`) — for compiling the native `chain99d` binary
- **Node.js**: `v18+` or `v20+` and `npm`
- **PowerShell** (Windows) or **Bash** (Linux / macOS)

---

## 3. Quick Start Guide

### Step 1: Build the Native Daemon (`chain99d`)

* **Windows:**
  ```powershell
  go build -o build/chain99d.exe ./cmd/chain99d
  ```
* **Linux / macOS:**
  ```bash
  go build -o build/chain99d ./cmd/chain99d
  chmod +x scripts/*.sh
  ```

### Step 2: Initialize the 4-Validator Devnet

Initializes 4 isolated validator home directories (`data/node1` through `data/node4`), generates consensus validator keys, funds accounts, issues gentx staking declarations, and writes the shared genesis:

* **Windows:**
  ```powershell
  powershell -ExecutionPolicy Bypass -File scripts/init-devnet.ps1
  ```
* **Linux / macOS:**
  ```bash
  ./scripts/init-devnet.sh
  ```

### Step 3: Start the 4-Validator PoS Devnet

Spawns all 4 validators as detached background processes connected via P2P mesh:

* **Windows:**
  ```powershell
  powershell -ExecutionPolicy Bypass -File scripts/start-devnet.ps1
  ```
* **Linux / macOS:**
  ```bash
  ./scripts/start-devnet.sh
  ```

#### Multi-Node Port Allocation:
- **Node 1:** CometBFT RPC: `http://127.0.0.1:26657` | EVM JSON-RPC: `http://127.0.0.1:8545` | Cosmos REST: `http://127.0.0.1:1317`
- **Node 2:** CometBFT RPC: `http://127.0.0.1:26667` | EVM JSON-RPC: `http://127.0.0.1:8555` | Cosmos REST: `http://127.0.0.1:1319`
- **Node 3:** CometBFT RPC: `http://127.0.0.1:26677` | EVM JSON-RPC: `http://127.0.0.1:8565` | Cosmos REST: `http://127.0.0.1:1321`
- **Node 4:** CometBFT RPC: `http://127.0.0.1:26687` | EVM JSON-RPC: `http://127.0.0.1:8575` | Cosmos REST: `http://127.0.0.1:1323`

### Step 4: Launch the Next.js 16 Web3 Explorer Dashboard

* In a new terminal window:
  ```bash
  npm --prefix frontend-next start -- -p 3000
  ```
* Or in development mode:
  ```bash
  npm --prefix frontend-next run dev
  ```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## 4. Pre-Funded Genesis Accounts & MetaMask Setup

### Adding Chain99 to MetaMask:
* **Network Name:** Chain99 PoS L1
* **New RPC URL:** `http://127.0.0.1:8545`
* **Chain ID:** `9999`
* **Currency Symbol:** `C99`
* **Block Explorer URL:** `http://localhost:3000`

### Pre-Allocated Test Accounts:
1. **Deployer Account:**
   * **Address:** `0x86fcDCaF0a0C69C30D589e29F85a44a03A40A904`
   * **Private Key:** `0xd7e362021fa1878975c5cdd458d493cd2f01dd19554654eeb2a3dca4e428b62c`
   * **Genesis Balance:** `100,000,000 C99`
2. **Keystore Account:**
   * **Address:** `0xB56269Dab6a306cac2D66462D2BD8D23670fe6b8`
   * **Genesis Balance:** `100,000,000 C99`

---

## 5. Network Verification & Health Checks

Verify your running network with the following commands:

### A. Consensus Status & Block Height
```bash
curl http://127.0.0.1:26657/status
```
*(Confirms CometBFT round state, latest block height, and block hashes).*

### B. Active Validator Set & Stake Voting Power
```bash
curl http://127.0.0.1:26657/validators
```
*(Returns all 4 validators and their current CometBFT voting powers).*

### C. Ethereum JSON-RPC Query
```bash
curl -X POST http://127.0.0.1:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

---

## 6. Automated Test Suites & Verification

With the network running, execute any of the verification suites:

### 1. Native PoS & Staking Precompile Integration Test
Verifies 16 end-to-end assertions: CometBFT multi-validator consensus, EVM precompile delegation, unbonding queue, and consensus voting power updates:
```bash
node test/native-integration.test.js
```

### 2. Full EVM Compatibility & EIP-1559 Verification
Tests smart contract deployment (`Storage.sol`), state mutation, EIP-1559 dynamic fee transactions, and WebSocket subscriptions:
```bash
node scripts/verify-evm.js
```

### 3. Adversarial Consensus & Byzantine Fault Tolerance Test
Tests validator downtime resilience (1 node stopped: chain continues committing) and network partition safety (2 nodes stopped: chain safely pauses without forks):
```bash
node scripts/test-adverse-consensus.js
```

### 4. Production TPS & Latency Benchmark
Runs concurrent batch transaction workloads to measure TPS, block latency, and execution times:
```bash
node scripts/benchmark-tps.js
```

### 5. Economic Tokenomics & Reward Solvency Simulator
Validates treasury solvency, inflation decay curves, and validator staking yield over a 10-year horizon:
```bash
node scripts/simulate-economics.js
```

### 6. Hardhat Unit Tests
```bash
npx hardhat test
```

---

## 7. EVM Staking Precompile Interface (`0x800`)

Smart contracts and Ethereum wallets interact directly with the native Cosmos SDK PoS staking engine through the precompile at `0x0000000000000000000000000000000000000800`:

```solidity
interface IStakingPrecompile {
    function delegate(
        address delegatorAddress,
        string calldata validatorAddress,
        uint256 amount
    ) external returns (int64 completionTime);

    function undelegate(
        address delegatorAddress,
        string calldata validatorAddress,
        uint256 amount
    ) external returns (int64 completionTime);

    function redelegate(
        address delegatorAddress,
        string calldata srcValidatorAddress,
        string calldata dstValidatorAddress,
        uint256 amount
    ) external returns (int64 completionTime);

    function delegation(
        address delegatorAddress,
        string calldata validatorAddress
    ) external view returns (
        DelegationResponse memory delegationResponse
    );
}
```

---

## 8. Stopping & Resetting the Network

### Stop All Validator Nodes
* **Windows:**
  ```powershell
  powershell -ExecutionPolicy Bypass -File scripts/stop-devnet.ps1
  ```
* **Linux / macOS:**
  ```bash
  ./scripts/stop-devnet.sh
  ```

### Full State Reset (Clean Wipe)
Deletes all node state databases and log files so you can run `init-devnet` fresh:
* **Windows:**
  ```powershell
  powershell -ExecutionPolicy Bypass -File scripts/reset-devnet.ps1
  ```
* **Linux / macOS:**
  ```bash
  ./scripts/reset-devnet.sh
  ```

---

## 9. Non-Blocking Node Backup & Anti-Double-Signing Recovery

To create a consistent live snapshot of any validator without stopping consensus:

* **Windows:**
  ```powershell
  powershell -ExecutionPolicy Bypass -File scripts/backup-node.ps1 -NodeHome data/node1 -BackupDir backups
  ```
* **Linux / macOS:**
  ```bash
  ./scripts/backup-node.sh data/node1 backups
  ```

> **Security Note:** The backup script deliberately excludes `priv_validator_state.json` and active `.lock` files to prevent validator double-signing when restoring from a snapshot on a secondary machine.

---

## 10. License & Credits

Chain99 Layer 1 is released under the [MIT License](LICENSE). Built with Cosmos SDK, CometBFT, and Evmos.
