@echo off
title AI Study Arena - Duel Mode
echo.
echo ========================================================
echo          AI STUDY ARENA - AUTO MATCHMAKING BOOT
echo ========================================================
echo.

:: Pre-cleanup
taskkill /FI "WINDOWTITLE eq ARENA-BACKEND*" /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq ARENA-FRONTEND*" /T /F >nul 2>&1

:: Start Backend Minimized
echo [1/3] Launching Backend Server (Minimized)...
start /min "ARENA-BACKEND" cmd /c "cd backend && npm run dev"

:: Start Frontend Minimized
echo [2/3] Launching Frontend Server (Minimized)...
start /min "ARENA-FRONTEND" cmd /c "cd frontend && npm run dev"

echo [WAIT] Waiting for servers to stabilize (5s)...
timeout /t 5 /nobreak > nul

:: Launch 2 Browser Instances
echo [3/3] Opening Duel Instances...

echo Launching Player 1...
start http://localhost:5173

:: Small delay between launches to ensure they don't fight for focus
timeout /t 2 /nobreak > nul

echo Launching Player 2...
start http://localhost:5173

echo.
echo ========================================================
echo    SYSTEM OPERATIONAL - ALL TABS MINIMIZED
echo ========================================================
echo.
echo Press any key to stop all background processes...
pause > nul

:: Cleanup (Optional: Taskkill if user presses a key)
taskkill /FI "WINDOWTITLE eq ARENA-BACKEND*" /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq ARENA-FRONTEND*" /T /F >nul 2>&1
echo Done.
