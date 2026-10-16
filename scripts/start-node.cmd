@echo off
set BASE_DIR=%~dp0..
set GETH=%BASE_DIR%\geth\geth.exe
set DATADIR=%BASE_DIR%\data\node1
set PASSWORD_FILE=%BASE_DIR%\geth\password.txt
set VALIDATOR=0x86fcDCaF0a0C69C30D589e29F85a44a03A40A904

echo ==============================================
echo   Chain99 L1 Devnet (Windows)
echo   Chain ID: 9999 ^| Token: C99
echo   Consensus: Clique PoA (2s blocks)
echo ==============================================

taskkill /F /IM geth.exe 2>nul
timeout /t 1 /nobreak >nul

if not exist "%DATADIR%\geth\chaindata" (
    echo Initializing chain...
    "%GETH%" init --datadir "%DATADIR%" "%BASE_DIR%\geth\genesis.json"
)

echo Starting Geth Node...
"%GETH%" --datadir "%DATADIR%" --networkid 9999 --port 30303 --mine --miner.etherbase %VALIDATOR% --unlock %VALIDATOR% --password "%PASSWORD_FILE%" --allow-insecure-unlock --http --http.addr 127.0.0.1 --http.port 8545 --http.api "eth,net,web3,miner,txpool" --http.corsdomain "*" --http.vhosts "*" --nodiscover --syncmode full --gcmode archive --verbosity 3
