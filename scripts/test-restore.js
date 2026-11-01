const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT_DIR = path.resolve(__dirname, "..");
const BACKUPS_DIR = path.join(ROOT_DIR, "backups");
const RESTORE_DIR = path.join(ROOT_DIR, "data", "test_restore_node");

async function testRestore() {
  console.log("==================================================================");
  console.log("  📦 BACKUP RESTORATION & ANTI-DOUBLE-SIGNING TEST");
  console.log("==================================================================\n");

  const backupFiles = fs.readdirSync(BACKUPS_DIR).filter(f => f.endsWith(".zip"));
  if (backupFiles.length === 0) throw new Error("No backup zip found in backups/");
  
  const latestBackup = path.join(BACKUPS_DIR, backupFiles[backupFiles.length - 1]);
  console.log(`1. Testing restoration from backup archive: ${latestBackup}`);

  if (fs.existsSync(RESTORE_DIR)) {
    fs.rmSync(RESTORE_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(RESTORE_DIR, { recursive: true });

  console.log(`2. Extracting archive into clean staging directory: ${RESTORE_DIR}...`);
  execSync(`powershell -Command "Expand-Archive -Path '${latestBackup}' -DestinationPath '${RESTORE_DIR}' -Force"`);
  console.log("   ✅ Extraction complete.");

  console.log("\n3. Verifying double-signing protection rules...");
  const restoredPrivState = path.join(RESTORE_DIR, "data", "priv_validator_state.json");
  const restoredPrivKey = path.join(RESTORE_DIR, "config", "priv_validator_key.json");

  const privStateExcluded = !fs.existsSync(restoredPrivState);
  const privKeyExcluded = !fs.existsSync(restoredPrivKey);

  console.log(`   - priv_validator_state.json was excluded from archive: ${privStateExcluded}`);
  console.log(`   - priv_validator_key.json was excluded from archive  : ${privKeyExcluded}`);

  if (privStateExcluded && privKeyExcluded) {
    console.log("   ✅ PASS: Double-signing hazard prevented! Stale height states cannot be restored over active validator keys.");
  } else {
    throw new Error("SECURITY FAILURE: Stale consensus state or private key was included in backup archive!");
  }

  console.log("\n4. Verifying database integrity via state export...");
  const binPath = path.join(ROOT_DIR, "build", "chain99d.exe");
  const exportOutput = execSync(`"${binPath}" export --home "${RESTORE_DIR}"`, { encoding: "utf8" });
  const exported = JSON.parse(exportOutput);
  console.log(`   - Successfully exported state at height #${exported.initial_height || exported.height || "genesis"}`);
  console.log(`   - Chain ID in restored state: ${exported.chain_id}`);
  console.log(`   - Restored accounts count   : ${exported.app_state.auth.accounts.length}`);
  console.log(`   - Restored bank supply      : ${exported.app_state.bank.supply[0].amount} ac99`);
  console.log("   ✅ PASS: Restored database integrity confirmed!");

  // Clean up test directory
  fs.rmSync(RESTORE_DIR, { recursive: true, force: true });
  console.log("\n==================================================================");
  console.log("  🎉 BACKUP RESTORATION VERIFICATION COMPLETE: ALL PASS");
  console.log("==================================================================");
}

testRestore().catch(err => {
  console.error("Restore test failed:", err);
  process.exitCode = 1;
});

