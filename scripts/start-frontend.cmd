@echo off
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%..\frontend-next"
echo Starting Chain99 Next.js Dashboard on http://localhost:3000 ...
npm run dev
