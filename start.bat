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

:: Build web if dist is missing
if not exist "web\dist\" (
    echo [Build] Building web application...
    cd web
    call npm run build
    cd ..
)

:: Build server if dist is missing
if not exist "server\dist\" (
    echo [Build] Building server application...
    cd server
    call npm run build
    cd ..
)

echo.
echo [Starting] Launching Course Player on http://localhost:4000...
echo.

:: Open browser after a short delay
start "" http://localhost:4000

:: Run the server
cd server
node dist/index.js
pause
