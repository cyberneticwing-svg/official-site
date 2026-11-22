@echo off
cd /d "%~dp0"
echo Stopping old servers on port 3000 (if any)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
  taskkill /F /PID %%a >nul 2>&1
)
echo.
echo Starting Cybernetics Wings...
echo Website: http://localhost:3000
echo Admin:   http://localhost:3000/admin
echo Login:   admin / admin123
echo.
echo Do NOT use "npx serve" for admin login.
echo.
npm start
pause
