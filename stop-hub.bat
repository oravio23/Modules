@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ============================================
echo   Oravio Hub - Demo Stopper
echo ============================================
echo.

echo Stopping the shell and m5-documents windows...
taskkill /FI "WINDOWTITLE eq Oravio Hub - shell*" /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq Oravio Hub - m5-documents*" /T /F >nul 2>&1

echo Freeing ports 5173 and 5175 (in case a server is running outside its window)...
for %%P in (5173 5175) do (
    for /f "tokens=5" %%Q in ('netstat -ano ^| findstr ":%%P" ^| findstr "LISTENING"') do (
        taskkill /PID %%Q /F >nul 2>&1
    )
)

echo.
echo Done. The hub's shell and m5-documents dev servers are stopped.
echo.
pause
