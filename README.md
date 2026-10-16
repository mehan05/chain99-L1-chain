# Chain99 Devnet

Chain99 is a minimal working prototype of an Ethereum-compatible L1/devnet. This project demonstrates how to build and operate an independent blockchain network capable of executing EVM smart contracts.

## Why Geth?
Geth (Go-Ethereum) is the official Golang implementation of the Ethereum protocol. We use Geth because it provides a robust, production-tested foundation for an EVM-compatible L1. By leveraging Geth, we avoid reinventing the wheel and gain immediate access to a mature ecosystem.

### What Geth provides out of the box:
* **EVM**: Complete execution environment for smart contracts.
* **Transaction processing**: Mempool management, state transitions, and gas mechanisms.
* **State management**: Trie-based account balances and contract storage.
* **P2P networking**: Peer discovery and synchronization.
* **JSON-RPC**: Standard HTTP APIs for interacting with the chain via Web3/ethers.js.

## What is Custom about Chain99?
To isolate Chain99 from the Ethereum mainnet and give it its own identity, we configured:
* **Chain Name**: Chain99
* **Chain ID**: `9999` (to ensure transactions cannot be replayed on mainnet or testnets).
* **Currency**: `C99` is the native token used for transactions and gas.
* **Genesis State**: A completely independent genesis block that pre-funds a developer account.
* **Consensus**: We use Clique (Proof of Authority) to allow a single dev node to consistently mine blocks without requiring huge amounts of computational power (Proof of Work).

## How the Chain99 Genesis Works
The `geth/genesis.json` file defines the rules and starting state of the blockchain.
- **Config**: Sets the `chainId: 9999` and enables Clique consensus (`period: 2` seconds per block). Pre-Merge hardforks are activated from block 0. Post-Merge hardforks are disabled for stability with Clique.
- **Alloc**: Pre-allocates a large balance of C99 to our designated dev account (`0xB56269Dab6a306cac2D66462D2BD8D23670fe6b8`).
- **Extradata**: Contains the initial validator address formatted for Clique consensus (allowing our dev node to produce blocks).

## Getting Started

### 1. Initialize the Chain
Run the initialization script. This creates the local database (`data/node1`) and injects the initial state from `genesis.json`.
```bash
./scripts/init-chain.sh
```

### 2. Start the Node
Start the Chain99 RPC and Miner node:
```bash
./scripts/start-node.sh
```
This runs the node on HTTP port `8545` and enables mining using the pre-funded account.

### 3. Client Interaction
We provide a Node.js/ethers.js script (`client/index.js`) to test the network.
Make sure you run `npm install` in the `client/` folder first.

**What the script does:**
* Connects to Chain99 via JSON-RPC (`http://127.0.0.1:8545`).
* Checks the latest block and account balance.
* Sends 10 C99 to a random address and verifies the balance.
* Deploys a smart contract (`Storage.sol`).
* Calls `set(99)` to modify the contract's state.
* Reads the updated value from the contract.

Run the test:
```bash
cd client
node index.js
```

### 4. Interactive Web Frontend & Explorer
Chain99 includes a web frontend dashboard for live block exploration, token dispensing, and smart contract interaction.

Run the dashboard:
```bash
./scripts/start-frontend.sh
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser:
* **Live Block Feed**: Watch new blocks sealed every 2 seconds with gas used and tx count.
* **1-Click MetaMask Connection**: Automatically adds Chain99 (Chain ID `9999`, symbol `C99`).
* **C99 Faucet**: Dispenses native C99 tokens directly from the genesis pool.
* **Smart Contract Studio**: Deploys `Storage.sol`, mutates state with `set()`, and reads live values.
* **JSON-RPC Terminal**: Test low-level RPC queries (`eth_blockNumber`, `net_version`, etc.).

## Current Limitations
* **Consensus Mechanism**: Chain99 currently uses PoA (Clique) which relies on trusted signers.
* **Single Node Reliance**: By default, the network relies on a single block-producing node for the devnet.
* **Hardforks**: Post-Merge features (like blob gas from Cancun) are not enabled in this minimal prototype to maintain stability with Clique.

## Path to a Production Chain99 L1
To turn this prototype into a production-ready L1, we would need to investigate and implement:
1. **Robust Consensus**: Transition from PoA (Clique) to a decentralized Proof-of-Stake (PoS) consensus mechanism (like Ethereum's Gasper or Tendermint). This requires a separate Consensus Client (e.g., Prysm, Lighthouse) running alongside Geth via the Engine API.
2. **Bootnodes & P2P Network**: Setup public bootnodes for peer discovery and ensure robust protection against network-level attacks.
3. **Economic Security**: Implement validator staking, slashing mechanisms, and tokenomics for C99.
4. **Tooling & Infrastructure**: Deploy block explorers (e.g., Blockscout), public RPC endpoints, and a faucet for developers.
5. **Security Audits**: Comprehensive auditing of our genesis state, network parameters, and potential custom Geth modifications.
