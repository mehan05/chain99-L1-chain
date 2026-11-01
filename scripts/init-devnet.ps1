# Chain99 Devnet Initializer (Windows PowerShell)
$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$rootDir = Split-Path -Parent $scriptDir

Write-Host "Running Chain99 Devnet Initialization..." -ForegroundColor Cyan
Set-Location $rootDir

node scripts/init-devnet.js
if ($LASTEXITCODE -ne 0) {
    Write-Error "Devnet initialization failed."
    exit 1
}

Write-Host "Devnet successfully initialized." -ForegroundColor Green

