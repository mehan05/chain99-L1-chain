# Chain99 4-Validator Devnet Starter (PowerShell)
$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$rootDir = Split-Path -Parent $scriptDir

Set-Location $rootDir

# Stop any already running chain99d instances
Write-Host "Stopping any running chain99d instances..." -ForegroundColor Yellow
& "$scriptDir\stop-devnet.ps1"
Start-Sleep -Seconds 1

$binPath = Join-Path $rootDir "build\chain99d.exe"
if (-not (Test-Path $binPath)) {
    Write-Host "Binary not found. Compiling chain99d.exe..." -ForegroundColor Yellow
    go build -o $binPath ./cmd/chain99d
}

$nodes = @("node1", "node2", "node3", "node4")

Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  🚀 LAUNCHING CHAIN99 4-VALIDATOR DEVNET (DETACHED)" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

foreach ($node in $nodes) {
    $nodeHome = Join-Path $rootDir "data\$node"
    Write-Host "Starting $node (Home: $nodeHome)..." -ForegroundColor White
    $cmd = "`"$binPath`" start --home `"$nodeHome`" --log_level info"
    Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = $cmd } | Out-Null
}

Start-Sleep -Seconds 2
$procs = Get-Process chain99d -ErrorAction SilentlyContinue
Write-Host "`nAll 4 validators launched in background! ($($procs.Count) active processes)" -ForegroundColor Green
Write-Host "Endpoints:" -ForegroundColor Gray
Write-Host "  Node 1: CometBFT RPC: http://127.0.0.1:26657 | EVM JSON-RPC: http://127.0.0.1:8545" -ForegroundColor Yellow
Write-Host "  Node 2: CometBFT RPC: http://127.0.0.1:26667 | EVM JSON-RPC: http://127.0.0.1:8555" -ForegroundColor Yellow
Write-Host "  Node 3: CometBFT RPC: http://127.0.0.1:26677 | EVM JSON-RPC: http://127.0.0.1:8565" -ForegroundColor Yellow
Write-Host "  Node 4: CometBFT RPC: http://127.0.0.1:26687 | EVM JSON-RPC: http://127.0.0.1:8575" -ForegroundColor Yellow
