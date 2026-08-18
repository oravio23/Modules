@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ============================================
echo   Oravio Hub - Demo Launcher
echo ============================================
echo.

echo Starting the m5-documents module dev server (port 5175)...
start "Oravio Hub - m5-documents" cmd /k "pnpm --filter @oravio/m5-documents dev"

echo Starting the shell dev server (port 5173)...
start "Oravio Hub - shell" cmd /k "pnpm --filter @oravio/shell dev"

echo.
echo Waiting for the servers to boot...
timeout /t 6 /nobreak >nul
start "" "http://localhost:5173"

echo.
echo Done. The hub should open in your browser at http://localhost:5173
echo Two windows are running: "Oravio Hub - shell" and "Oravio Hub - m5-documents".
echo Keep both open while you demo; use stop-hub.bat when you're done.
echo.
pause
