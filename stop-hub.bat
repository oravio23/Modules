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
echo The hub's shell and m5-documents dev servers are stopped.
echo.

rem start-hub.bat brings up the local Supabase stack (Docker containers for
rem Postgres/Auth/Storage/Edge Functions) - offer to stop that too, so this
rem script actually undoes everything start-hub.bat started, not just the
rem two Vite servers. `supabase stop` keeps your local data on disk (no
rem --no-backup here); it's picked back up on the next `supabase start`.
set /p STOP_SUPABASE="Also stop the local Supabase stack (Docker)? [Y/n]: "
if "!STOP_SUPABASE!"=="" set STOP_SUPABASE=Y
if /i "!STOP_SUPABASE!"=="Y" (
    set SUPABASE_CMD=supabase
    where supabase >nul 2>&1
    if errorlevel 1 (
        set SUPABASE_CMD=npx --yes supabase@latest
    )
    echo Stopping Supabase...
    call !SUPABASE_CMD! stop
) else (
    echo Leaving Supabase running.
)

echo.
echo Done.
echo.
pause
