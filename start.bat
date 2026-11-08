@echo off
title Apna Course Player
echo ========================================================
echo               APNA COURSE PLAYER
echo   Offline Path Player with Resume, Autoplay ^& Drive Sync
echo ========================================================
echo.

cd /d "%~dp0"

:: Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not found. Please install Node.js v18+ from https://nodejs.org/
    pause
    exit /b 1
)

:: Install dependencies if node_modules is missing
if not exist "node_modules\" (
    echo [Setup] Installing root dependencies...
    call npm install
)

if not exist "server\node_modules\" (
    echo [Setup] Installing server dependencies...
    cd server
    call npm install
    cd ..
)

if not exist "web\node_modules\" (
    echo [Setup] Installing web dependencies...
    cd web
    call npm install
    cd ..
)

:: Build server and web applications to ensure latest updates
echo [Build] Compiling latest updates...
cd server
call npm run build
cd ..\web
call npm run build
cd ..

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

:: Open browser
start "" http://localhost:4000

:: Run the server
cd server
node dist/index.js
pause
