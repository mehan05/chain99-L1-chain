# =============================================================
# Chain99 — Windows PowerShell Node Launcher
# =============================================================
$ErrorActionPreference = "Stop"

$BASE_DIR = (Get-Item $PSScriptRoot).Parent.FullName
$GETH = Join-Path $BASE_DIR "geth\geth.exe"
$DATADIR = Join-Path $BASE_DIR "data\node1"
$GENESIS = Join-Path $BASE_DIR "geth\genesis.json"
$PASSWORD_FILE = Join-Path $BASE_DIR "geth\password.txt"
$VALIDATOR = "0x86fcDCaF0a0C69C30D589e29F85a44a03A40A904"

Write-Host "╔══════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║        Chain99 L1 Devnet (Windows)   ║" -ForegroundColor Cyan
Write-Host "║   Chain ID : 9999  |  Token : C99    ║" -ForegroundColor Cyan
Write-Host "║   Consensus: Clique PoA (2s blocks)  ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════╝" -ForegroundColor Cyan

# Kill any existing geth processes
Get-Process geth -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 1

# Check if initialized
if (-not (Test-Path (Join-Path $DATADIR "geth\chaindata"))) {
    Write-Host "Initialising Chain99 from genesis..." -ForegroundColor Yellow
    & $GETH init --datadir $DATADIR $GENESIS
}

Write-Host "Starting Chain99 Node (RPC + Clique Miner)..." -ForegroundColor Green
Write-Host "RPC endpoint: http://127.0.0.1:8545" -ForegroundColor Yellow

$gethArgs = @(
    "--datadir", $DATADIR,
    "--networkid", "9999",
    "--port", "30303",
    "--mine",
    "--miner.etherbase", $VALIDATOR,
    "--unlock", $VALIDATOR,
    "--password", $PASSWORD_FILE,
    "--allow-insecure-unlock",
    "--http",
    "--http.addr", "127.0.0.1",
    "--http.port", "8545",
    "--http.api", "eth,net,web3,miner,txpool",
    "--http.corsdomain", "*",
    "--http.vhosts", "*",
    "--nodiscover",
    "--syncmode", "full",
    "--gcmode", "archive",
    "--verbosity", "3"
)

& $GETH $gethArgs
