# Chain99 Devnet Stopper (PowerShell)

Write-Host "Stopping all chain99d validator instances..." -ForegroundColor Yellow

$procs = Get-Process chain99d -ErrorAction SilentlyContinue
if ($procs) {
    $procs | ForEach-Object {
        Write-Host "Stopping PID $($_.Id)..." -ForegroundColor Gray
        Stop-Process -Id $_.Id -Force
    }
    Write-Host "All chain99d instances stopped." -ForegroundColor Green
} else {
    Write-Host "No active chain99d processes found." -ForegroundColor Gray
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$rootDir = Split-Path -Parent $scriptDir
$pidsFile = Join-Path $rootDir "data\pids.json"
if (Test-Path $pidsFile) {
    Remove-Item $pidsFile -Force -ErrorAction SilentlyContinue
}

