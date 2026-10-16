# Chain99 L1 — Executive Demo & Presentation Guide

## 📌 Executive Summary
**Chain99** is an independent, sovereign, EVM-compatible Layer 1 blockchain devnet. It demonstrates end-to-end blockchain architecture from node consensus down to smart contract execution and an interactive web explorer.

---

## 🚀 Live System Status

| Component | Status | Endpoint / Location | Details |
| :--- | :---: | :--- | :--- |
| **Geth L1 Node** | 🟢 **RUNNING** | `http://127.0.0.1:8545` | Clique PoA consensus, **2.0s block time**, Chain ID `9999` |
| **Web Explorer & Studio** | 🟢 **RUNNING** | [http://localhost:3000](http://localhost:3000) | Live block visualizer, Faucet, Contract Studio, RPC Console |
| **Validator Wallet** | 🟢 **ACTIVE** | `0x86fcDCaF0a0C69C30D589e29F85a44a03A40A904` | Pre-funded with `1,000,000 C99` in Genesis block |
| **Demo Smart Contract** | 🟢 **DEPLOYED**| `0x53E6CbC73d9866b93Ea563b297ab1f2cf0b79eEa` | `Storage.sol` verified on-chain |

---

## 🎬 5-Minute Demo Flow for Your Manager

### Step 1: Show the Sovereign L1 Explorer (1 min)
1. Open your browser and navigate to **[http://localhost:3000](http://localhost:3000)**.
2. **Point out the Live Block Feed**: Show that every 2 seconds, a new block is sealed by our validator node with its block number, hash, gas limit, and timestamp.
3. **Highlight Independence**: Explain that this is **not** a Ganache or Hardhat mock; it is a full **Go-Ethereum (Geth) node** running independent consensus.

---

### Step 2: 1-Click MetaMask Onboarding (1 min)
1. Click the **"Add Chain99 to MetaMask"** button in the header.
2. Show your manager that MetaMask prompts to add:
   - **Network Name**: `Chain99 L1 Devnet`
   - **Chain ID**: `9999`
   - **Currency**: `C99`
   - **RPC URL**: `http://127.0.0.1:8545`
3. Click **"Connect Wallet"** to bind your MetaMask account to the dashboard.

---

### Step 3: Dispense Native Tokens from the Faucet (1 min)
1. Scroll to the **C99 Faucet** section.
2. The recipient input will automatically populate with your connected MetaMask address (or any address).
3. Enter `10` C99 and click **"Request C99 Tokens"**.
4. Watch the live transaction submit $\rightarrow$ mine into the next 2-second block $\rightarrow$ confirm.
5. Verify that your MetaMask balance immediately updates with 10 C99!

---

### Step 4: Live Smart Contract Interaction (1.5 min)
1. Scroll to the **Smart Contract Studio** section.
2. Demonstrate that `Storage.sol` is compiled and ready.
3. Click **Deploy Contract** (or interact with the already deployed contract at `0x53E6CbC73d9866b93Ea563b297ab1f2cf0b79eEa`).
4. In the `set(uint256)` input box, enter a new number (e.g. `777`) and submit.
5. Click `value()` $\rightarrow$ Show the updated on-chain state read live from the chain!

---

### Step 5: Terminal Script Verification (30 sec)
To prove production-readiness and automated testing to your manager, open terminal and run:
```powershell
node client/index.js
```
Show the formatted CLI output proving automated wallet decryption, native C99 transfer, contract deployment, and read/write verification:
```text
✅ Connected! Chain ID: 9999
🔑 Loading Validator Wallet: 0x86fc...A904
⛓️  Chain State: Block #36, 1,000,000.0 C99
💸 Sending C99 Transfer: 10.0 C99 -> Confirmed in block #38
📄 Deploying Storage Contract -> 0x53E6CbC73d9866b93Ea563b297ab1f2cf0b79eEa
✍️  Writing to Contract (set 99) -> Confirmed in block #42
📖 Reading from Contract -> Stored value: 99 ✅
```

---

## 🛠️ Management & Restart Cheatsheet

If you ever need to stop or restart the services before your meeting:

* **To Stop Node**: `taskkill /F /IM geth.exe`
* **To Restart Node**: Run `cmd.exe /c .\scripts\start-node.cmd`
* **To Restart Frontend**: `node frontend/server.js`
