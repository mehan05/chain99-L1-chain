# ====================================================================
# Chain99 L1 — Production Validator Backup Script (PowerShell)
# IMPORTANT: Protects against double-signing by isolating consensus state!
# ====================================================================
param (
    [string]$NodeHome = "data/node1",
    [string]$BackupDir = "backups"
)

$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  💾 CHAIN99 PRODUCTION VALIDATOR BACKUP UTILITY" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

if (-not (Test-Path $NodeHome)) {
    Write-Error "Node home directory not found: $NodeHome"
}

if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$archiveName = "chain99_backup_$($timestamp).zip"
$targetArchive = Join-Path $BackupDir $archiveName

Write-Host "Backing up application database from $NodeHome to $targetArchive..." -ForegroundColor Yellow

# Create temp staging folder
$tempStage = Join-Path $env:TEMP "chain99_backup_stage_$timestamp"
New-Item -ItemType Directory -Path $tempStage -Force | Out-Null

try {
    # Copy data directory (EXCLUDING priv_validator_state.json and active database LOCK files!)
    $sourceData = Join-Path $NodeHome "data"
    $destData = Join-Path $tempStage "data"
    New-Item -ItemType Directory -Path $destData -Force | Out-Null

    robocopy $sourceData $destData /E /XF "priv_validator_state.json" "cs.wal" "LOCK" "*.lock" | Out-Null

    # Copy config directory (excluding private keys for safety)
    $sourceConfig = Join-Path $NodeHome "config"
    $destConfig = Join-Path $tempStage "config"
    New-Item -ItemType Directory -Path $destConfig -Force | Out-Null
    Copy-Item (Join-Path $sourceConfig "genesis.json") $destConfig -Force
    Copy-Item (Join-Path $sourceConfig "config.toml") $destConfig -Force
    Copy-Item (Join-Path $sourceConfig "app.toml") $destConfig -Force

    # Compress archive
    Compress-Archive -Path "$tempStage\*" -DestinationPath $targetArchive -CompressionLevel Optimal

    $archiveSizeMb = (Get-Item $targetArchive).Length / 1MB
    Write-Host "✅ Backup created successfully: $targetArchive ($([math]::Round($archiveSizeMb, 2)) MB)" -ForegroundColor Green
    Write-Host "⚠️ NOTE: priv_validator_key.json and priv_validator_state.json were safely excluded to prevent accidental double-signing." -ForegroundColor Yellow
} finally {
    Remove-Item -Path $tempStage -Recurse -Force -ErrorAction SilentlyContinue
}
