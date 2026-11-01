/**
 * Chain99 4-Validator Production-Grade Devnet Initializer
 *
 * Configures:
 * - 4 independent validator nodes with separate keys, accounts, states, databases.
 * - Dynamic stake-weighted voting power (val1: 10,000, val2: 15,000, val3: 20,000, val4: 25,000 C99).
 * - Full EVM compatibility (evm_denom: ac99, chain-id: chain_9999-1, EVM chainId: 9999).
 * - Native precompiles (staking: 0x800, distribution: 0x801).
 * - Multi-peer P2P mesh on localhost with isolated ports.
 * - Node 1 exposes standard Ethereum JSON-RPC on port 8545.
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "..");
const BIN_PATH = process.platform === "win32"
  ? path.join(ROOT_DIR, "build", "chain99d.exe")
  : path.join(ROOT_DIR, "build", "chain99d");
const DATA_DIR = path.join(ROOT_DIR, "data");

const CHAIN_ID = "chain_9999-1";
const BASE_DENOM = "ac99";
const DISPLAY_DENOM = "C99";

const NODES = [
  {
    name: "node1",
    moniker: "validatorA",
    stake: "10000000000000000000000ac99", // 10,000 C99
    p2pPort: 26656,
    rpcPort: 26657,
    proxyPort: 26658,
    apiPort: 1317,
    grpcPort: 9090,
    evmRpcPort: 8545,
    evmWsPort: 8546,
  },
  {
    name: "node2",
    moniker: "validatorB",
    stake: "20000000000000000000000ac99", // 20,000 C99
    p2pPort: 26666,
    rpcPort: 26667,
    proxyPort: 26668,
    apiPort: 1319,
    grpcPort: 9092,
    evmRpcPort: 8555,
    evmWsPort: 8556,
  },
  {
    name: "node3",
    moniker: "validatorC",
    stake: "10000000000000000000000ac99", // 10,000 C99
    p2pPort: 26676,
    rpcPort: 26677,
    proxyPort: 26678,
    apiPort: 1321,
    grpcPort: 9094,
    evmRpcPort: 8565,
    evmWsPort: 8566,
  },
  {
    name: "node4",
    moniker: "validatorD",
    stake: "10000000000000000000000ac99", // 10,000 C99
    p2pPort: 26686,
    rpcPort: 26687,
    proxyPort: 26688,
    apiPort: 1323,
    grpcPort: 9096,
    evmRpcPort: 8575,
    evmWsPort: 8576,
  },
];

// Pre-allocated accounts
const DEPLOYER_HEX = "0x86fcDCaF0a0C69C30D589e29F85a44a03A40A904";
const NODE1_KEYSTORE_HEX = "0xB56269Dab6a306cac2D66462D2BD8D23670fe6b8";
const GENESIS_BALANCE = "1000000000000000000000000ac99"; // 1,000,000 C99
const VALIDATOR_FUNDING = "100000000000000000000000ac99"; // 100,000 C99

function run(cmd, env = {}) {
  return execSync(cmd, {
    cwd: ROOT_DIR,
    env: { ...process.env, ...env },
    encoding: "utf8",
  }).trim();
}

async function main() {
  console.log("================================================================");
  console.log("  🚀 CHAIN99 — 4-VALIDATOR PROOF-OF-STAKE DEVNET INITIALIZER");
  console.log("================================================================");

  if (!fs.existsSync(BIN_PATH)) {
    console.error(`Binary not found at: ${BIN_PATH}. Compiling...`);
    run(`go build -o "${BIN_PATH}" ./cmd/chain99d`);
  }

  // 1. Reset data directory
  console.log("\n1. Resetting data directory...");
  if (fs.existsSync(DATA_DIR)) {
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(DATA_DIR, { recursive: true });

  // 2. Initialize nodes
  console.log("\n2. Initializing 4 validator nodes...");
  for (const node of NODES) {
    const home = path.join(DATA_DIR, node.name);
    console.log(`   - Initializing ${node.name} (${node.moniker}) at ${home}...`);
    run(`"${BIN_PATH}" init "${node.moniker}" --chain-id "${CHAIN_ID}" --home "${home}"`);
  }

  // 3. Create operator accounts in each node's keyring
  console.log("\n3. Creating validator operator keys...");
  const validatorAccounts = [];
  for (const node of NODES) {
    const home = path.join(DATA_DIR, node.name);
    const keyOutput = run(
      `"${BIN_PATH}" keys add "${node.name}" --keyring-backend test --home "${home}" --output json`
    );
    const keyData = JSON.parse(keyOutput);
    console.log(`   - ${node.name}: ${keyData.address}`);
    validatorAccounts.push({
      node: node.name,
      address: keyData.address,
      stake: node.stake,
    });
  }

  // 4. Configure genesis template on node1
  console.log("\n4. Configuring base genesis state on node1...");
  const node1Home = path.join(DATA_DIR, "node1");
  const genesisPath = path.join(node1Home, "config", "genesis.json");

  // Add deployer and legacy keystore accounts
  console.log(`   - Adding deployer account: ${DEPLOYER_HEX}...`);
  run(
    `"${BIN_PATH}" add-genesis-account "${DEPLOYER_HEX}" "${GENESIS_BALANCE}" --keyring-backend test --home "${node1Home}"`
  );

  console.log(`   - Adding keystore account: ${NODE1_KEYSTORE_HEX}...`);
  run(
    `"${BIN_PATH}" add-genesis-account "${NODE1_KEYSTORE_HEX}" "${GENESIS_BALANCE}" --keyring-backend test --home "${node1Home}"`
  );

  // Add each validator operator account with funds for self-bonding
  for (const v of validatorAccounts) {
    console.log(`   - Adding validator account: ${v.address} with ${VALIDATOR_FUNDING}...`);
    run(
      `"${BIN_PATH}" add-genesis-account "${v.address}" "${VALIDATOR_FUNDING}" --keyring-backend test --home "${node1Home}"`
    );
  }

  // Update genesis parameters for Chain99 PoS
  console.log("   - Customizing consensus, EVM, and staking parameters in genesis.json...");
  let genesis = JSON.parse(fs.readFileSync(genesisPath, "utf8"));

  // EVM parameters
  genesis.app_state.evm.params.evm_denom = BASE_DENOM;
  genesis.app_state.feemarket.params.no_base_fee = false;
  genesis.app_state.feemarket.params.base_fee = "1000000000"; // 1 Gwei

  // Staking parameters
  genesis.app_state.staking.params.bond_denom = BASE_DENOM;
  genesis.app_state.staking.params.unbonding_time = "1209600s"; // 14 days
  genesis.app_state.staking.params.max_validators = 50;
  genesis.app_state.staking.params.min_commission_rate = "0.050000000000000000"; // 5%

  // Slashing parameters
  genesis.app_state.slashing.params.signed_blocks_window = "100";
  genesis.app_state.slashing.params.min_signed_per_window = "0.500000000000000000"; // 50%
  genesis.app_state.slashing.params.downtime_jail_duration = "600s"; // 10 minutes
  genesis.app_state.slashing.params.slash_fraction_double_sign = "0.050000000000000000"; // 5% equivocation slash
  genesis.app_state.slashing.params.slash_fraction_downtime = "0.001000000000000000"; // 0.1% downtime slash

  // Inflation / Minting
  if (genesis.app_state.inflation) {
    genesis.app_state.inflation.params.mint_denom = BASE_DENOM;
    genesis.app_state.inflation.params.enable_inflation = true;
  }

  // Denom metadata for Bank module
  genesis.app_state.bank.denom_metadata = [
    {
      description: "Chain99 Native Token",
      denom_units: [
        { denom: "ac99", exponent: 0, aliases: ["wei", "atto-c99"] },
        { denom: "mc99", exponent: 12, aliases: ["micro-c99"] },
        { denom: "C99", exponent: 18, aliases: ["c99"] },
      ],
      base: "ac99",
      display: "C99",
      name: "Chain99",
      symbol: "C99",
    },
  ];

  // Consensus params
  if (genesis.consensus && genesis.consensus.params) {
    genesis.consensus.params.block.max_gas = "30000000";
  } else if (genesis.consensus_params) {
    genesis.consensus_params.block.max_gas = "30000000";
  }

  fs.writeFileSync(genesisPath, JSON.stringify(genesis, null, 2));

  // 5. Replicate customized genesis to nodes 2, 3, 4 before generating gentxs
  console.log("\n5. Distributing configured genesis to nodes 2, 3, 4...");
  for (let i = 1; i < NODES.length; i++) {
    const dest = path.join(DATA_DIR, NODES[i].name, "config", "genesis.json");
    fs.copyFileSync(genesisPath, dest);
  }

  // 6. Generate gentxs for each validator node
  console.log("\n6. Generating genesis transactions (gentxs)...");
  const gentxDir = path.join(node1Home, "config", "gentx");
  fs.mkdirSync(gentxDir, { recursive: true });

  for (const node of NODES) {
    const home = path.join(DATA_DIR, node.name);
    console.log(`   - Generating gentx for ${node.name} (Stake: ${node.stake})...`);
    run(
      `"${BIN_PATH}" gentx "${node.name}" "${node.stake}" --chain-id "${CHAIN_ID}" --keyring-backend test --home "${home}"`
    );

    // Copy gentx file to node1 gentx directory
    const nodeGentxDir = path.join(home, "config", "gentx");
    const files = fs.readdirSync(nodeGentxDir);
    for (const f of files) {
      if (f.endsWith(".json")) {
        fs.copyFileSync(path.join(nodeGentxDir, f), path.join(gentxDir, f));
      }
    }
  }

  // 7. Collect gentxs on node1
  console.log("\n7. Collecting genesis transactions into shared genesis.json...");
  run(`"${BIN_PATH}" collect-gentxs --home "${node1Home}"`);

  // Validate the final genesis
  console.log("   - Validating final genesis.json...");
  run(`"${BIN_PATH}" validate "${genesisPath}"`);

  // 8. Distribute final collected genesis to all nodes
  console.log("\n8. Distributing final genesis.json to all nodes...");
  for (let i = 1; i < NODES.length; i++) {
    const dest = path.join(DATA_DIR, NODES[i].name, "config", "genesis.json");
    fs.copyFileSync(genesisPath, dest);
  }

  // 9. Query node IDs for P2P persistent peers
  console.log("\n9. Discovering CometBFT Node IDs...");
  const peerList = [];
  for (const node of NODES) {
    const home = path.join(DATA_DIR, node.name);
    const nodeId = run(`"${BIN_PATH}" tendermint show-node-id --home "${home}"`);
    console.log(`   - ${node.name}: ${nodeId}@127.0.0.1:${node.p2pPort}`);
    peerList.push(`${nodeId}@127.0.0.1:${node.p2pPort}`);
  }
  const persistentPeers = peerList.join(",");

  // 10. Update config.toml and app.toml for all nodes
  console.log("\n10. Updating config.toml and app.toml for each node...");
  for (let i = 0; i < NODES.length; i++) {
    const node = NODES[i];
    const home = path.join(DATA_DIR, node.name);
    const configTomlPath = path.join(home, "config", "config.toml");
    const appTomlPath = path.join(home, "config", "app.toml");

    // Filter peers to exclude this node itself
    const nodePeers = peerList.filter((_, idx) => idx !== i).join(",");

    let cfg = fs.readFileSync(configTomlPath, "utf8");
    cfg = cfg.replace(/proxy_app = ".*"/, `proxy_app = "tcp://127.0.0.1:${node.proxyPort}"`);
    cfg = cfg.replace(/laddr = "tcp:\/\/127.0.0.1:26657"/, `laddr = "tcp://127.0.0.1:${node.rpcPort}"`);
    cfg = cfg.replace(/laddr = "tcp:\/\/0.0.0.0:26656"/, `laddr = "tcp://0.0.0.0:${node.p2pPort}"`);
    cfg = cfg.replace(/persistent_peers = ".*"/, `persistent_peers = "${nodePeers}"`);
    cfg = cfg.replace(/addr_book_strict = true/, `addr_book_strict = false`);
    cfg = cfg.replace(/allow_duplicate_ip = false/, `allow_duplicate_ip = true`);
    cfg = cfg.replace(/timeout_commit = ".*"/, `timeout_commit = "1s"`);
    cfg = cfg.replace(/pprof_laddr = ".*"/, `pprof_laddr = ""`);
    fs.writeFileSync(configTomlPath, cfg);

    let appToml = fs.readFileSync(appTomlPath, "utf8");
    // Replace API, gRPC, and EVM JSON-RPC config
    appToml = appToml.replace(/address = "tcp:\/\/localhost:1317"/, `address = "tcp://127.0.0.1:${node.apiPort}"`);
    appToml = appToml.replace(/address = "localhost:9090"/, `address = "127.0.0.1:${node.grpcPort}"`);
    appToml = appToml.replace(/minimum-gas-prices = ".*"/, `minimum-gas-prices = "0ac99"`);

    // Enable API only
    appToml = appToml.replace(/(\[api\][\s\S]*?)enable = false/, `$1enable = true`);

    // Enable gRPC
    appToml = appToml.replace(/(\[grpc\][\s\S]*?)enable = false/, `$1enable = true`);

    // Enable JSON-RPC only
    appToml = appToml.replace(/(\[json-rpc\][\s\S]*?)enable = false/, `$1enable = true`);
    appToml = appToml.replace(/address = "127.0.0.1:8545"/, `address = "127.0.0.1:${node.evmRpcPort}"`);
    appToml = appToml.replace(/ws-address = "127.0.0.1:8546"/, `ws-address = "127.0.0.1:${node.evmWsPort}"`);
    appToml = appToml.replace(
      /api = ".*"/,
      `api = "eth,net,web3,txpool,debug"`
    );
    fs.writeFileSync(appTomlPath, appToml);
  }

  // Also save a copy of the canonical genesis in config/
  fs.copyFileSync(genesisPath, path.join(ROOT_DIR, "config", "genesis_pos.json"));

  console.log("\n================================================================");
  console.log("  ✅ DEVNET INITIALIZATION COMPLETE!");
  console.log("================================================================");
  console.log("Nodes initialized with 4 independent validators:");
  NODES.forEach((node) => {
    const bondC99 = BigInt(node.stake.replace("ac99", "")) / BigInt(1e18);
    console.log(`  - ${node.name} (${node.moniker}): RPC ${node.rpcPort} | EVM JSON-RPC ${node.evmRpcPort} | Bond: ${bondC99.toLocaleString()} C99 (Power ${bondC99})`);
  });
  console.log("Pre-allocated Accounts:");
  console.log(`  - Deployer: ${DEPLOYER_HEX} (1,000,000 C99)`);
  console.log(`  - Node1 Keystore: ${NODE1_KEYSTORE_HEX} (1,000,000 C99)`);
  console.log("Network Parameters:");
  console.log(`  - Chain ID: ${CHAIN_ID} (EVM ID: 9999)`);
  console.log(`  - Base Denom: ${BASE_DENOM} | Display: ${DISPLAY_DENOM}`);
  console.log("================================================================\n");
}

main().catch((err) => {
  console.error("Initialization failed:", err);
  process.exit(1);
});
