@echo off
echo ========================================================
echo   Chain99 L1 - Public RPC Tunnel (No Signup Needed)
echo ========================================================
echo Exposing local Geth RPC (port 8545) to the public internet...
echo.
echo Copy the HTTPS URL printed below and set it in your Vercel
echo / deployment Environment Variables:
echo.
echo   NEXT_PUBLIC_RPC_URL=https://xxxx.loca.lt
echo   CHAIN99_RPC_URL=https://xxxx.loca.lt
echo.
echo NOTE: Keep this window OPEN while testing your deployed app!
echo ========================================================
echo.
npx --yes localtunnel --port 8545
