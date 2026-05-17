@echo off
echo Starting AI Study Arena...

echo Starting Backend server...
start "AI Study Arena - Backend" cmd /c "cd backend && npm run dev"

echo Starting Frontend server...
start "AI Study Arena - Frontend" cmd /c "cd frontend && npm run dev"

echo Waiting for services to initialize...
timeout /t 3 /nobreak > nul

echo Launching browser...
start http://localhost:5173

echo All systems operational! The terminal windows can be minimized but should remain open.
pause
