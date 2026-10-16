# ========================================================
# Chain99 L1 - Public RPC Tunnel (No Signup Needed)
# ========================================================
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "   Chain99 L1 - Public RPC Tunnel (No Signup Needed)" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "Exposing local Geth RPC (port 8545) to the public internet..." -ForegroundColor Green
Write-Host ""
Write-Host "Copy the HTTPS URL printed below and set it in your Vercel" -ForegroundColor Yellow
Write-Host "/ deployment Environment Variables:" -ForegroundColor Yellow
Write-Host "  NEXT_PUBLIC_RPC_URL=https://xxxx.loca.lt" -ForegroundColor White
Write-Host "  CHAIN99_RPC_URL=https://xxxx.loca.lt" -ForegroundColor White
Write-Host ""
Write-Host "NOTE: Keep this terminal OPEN while using the deployed app!" -ForegroundColor Magenta
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

npx --yes localtunnel --port 8545
