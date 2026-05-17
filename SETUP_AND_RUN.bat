@echo off
setlocal enabledelayedexpansion

echo.
echo ========================================================
echo            AI STUDY ARENA - QUICK START SETUP
echo ========================================================
echo.

:: 1. Check for Node.js
echo [1/4] Verifying Node.js...
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo [CRITICAL ERROR] Node.js is missing.
    echo Please install it from: https://nodejs.org
    echo.
    pause
    exit /b
)

:: 2. Check for .env
echo [2/4] Checking environment configuration...
if not exist "backend\.env" (
    echo.
    echo [ERROR] backend/.env is missing!
    echo Please paste the .env file shared with you into the /backend folder.
    echo.
    pause
    exit /b
) else (
    echo [OK] Credentials detected.
)

:: 3. Install Stages
if exist "node_modules" (
    echo.
    echo [INFO] Dependencies already found. Skipping installation.
    echo.
    goto LAUNCH
)

echo [3/4] Installing system libraries (this may take a minute)...
echo Working on Backend...
cd backend && call npm install --no-audit --no-fund && cd ..
echo Working on Frontend...
cd frontend && call npm install --no-audit --no-fund && cd ..

:LAUNCH
:: 4. Final Launch
echo.
echo [4/4] Finishing...
echo ========================================================
echo   SETUP READY! STUDY SESSION STARTING...
echo ========================================================
echo.

if exist "start.bat" (
    call start.bat
) else (
    echo [ERROR] start.bat missing. Launching manually...
    start http://localhost:5173
    cd backend && npm run dev
)
