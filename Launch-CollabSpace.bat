@echo off
setlocal
cd /d "%~dp0"

:: Check if CollabSpace server is running, if not start it
curl.exe -s http://localhost:4000/api/health >nul 2>&1
if %errorlevel% neq 0 (
    echo Starting CollabSpace Server...
    start /b "" "..\tools\nodejs\node.exe" server\src\index.js
    timeout /t 2 /nobreak >nul
)

:: Launch in Dedicated Application Window Mode
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --app="http://localhost:4000" --window-size=1280,840 --name="CollabSpace"
) else if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
    start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --app="http://localhost:4000" --window-size=1280,840 --name="CollabSpace"
) else (
    start "" "http://localhost:4000"
)
