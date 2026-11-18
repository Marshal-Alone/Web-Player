@echo off
title Apna Course Player
echo ========================================================
echo               APNA COURSE PLAYER
echo   Offline Path Player with Resume, Autoplay ^& Drive Sync
echo ========================================================
echo.

cd /d "%~dp0"

:: Check if server is already running on port 4000
netstat -ano | findstr /R ":4000.*LISTENING" >nul 2>nul
if %errorlevel% equ 0 (
    echo.
    echo [Info] Apna Course Player server is already running on http://localhost:4000!
    echo [Info] Opening player in your default browser...
    echo.
    start "" http://localhost:4000
    exit /b 0
)

echo.
echo [Starting] Launching Course Player on http://localhost:4000...
echo.

:: Check if MongoDB is running, attempt to start if stopped
netstat -ano | findstr /R ":27017.*LISTENING" >nul 2>nul
if %errorlevel% neq 0 (
    echo [MongoDB] Starting local MongoDB service...
    net start MongoDB >nul 2>nul
)

:: Open browser
start "" http://localhost:4000

:: Run the server
cd server
node dist/index.js
pause
