@echo off
cd /d "%~dp0"
if not exist node_modules\vite\bin\vite.js (
  call npm.cmd install --no-audit
  if errorlevel 1 exit /b 1
)
echo Open http://localhost:5173 in your browser.
call npm.cmd run dev
