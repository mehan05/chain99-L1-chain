# Chain99 4-Validator Devnet Starter (PowerShell)
$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$rootDir = Split-Path -Parent $scriptDir

Set-Location $rootDir

# Stop any already running chain99d instances
Write-Host "Stopping any running chain99d instances..." -ForegroundColor Yellow
& "$scriptDir\stop-devnet.ps1"
Start-Sleep -Seconds 1

node scripts/start-devnet.js
