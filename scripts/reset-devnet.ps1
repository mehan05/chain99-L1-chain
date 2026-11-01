# Chain99 Devnet Reset Tool (PowerShell)
$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$rootDir = Split-Path -Parent $scriptDir

Write-Host "Stopping running validators..." -ForegroundColor Yellow
& "$scriptDir\stop-devnet.ps1"
Start-Sleep -Seconds 2

Write-Host "Re-initializing 4-validator devnet..." -ForegroundColor Cyan
Set-Location $rootDir
node scripts/init-devnet.js

Write-Host "Devnet reset and ready." -ForegroundColor Green

