@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ============================================
echo   Oravio Hub - Demo Launcher
echo ============================================
echo.

rem -- 1. Preflight: required .env files ------------------------------------
rem Vite reads .env.local (or plain .env) automatically; nothing here creates
rem these for you, since VITE_SUPABASE_ANON_KEY is per-project and must be
rem copied in by hand from `supabase status` or the dashboard.
set MISSING_ENV=0

if not exist "apps\shell\.env.local" if not exist "apps\shell\.env" (
    echo [MISSING] apps\shell\.env.local
    echo   Copy apps\shell\.env.example to apps\shell\.env.local and fill in
    echo   VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.
    echo.
    set MISSING_ENV=1
)
if not exist "apps\m5-documents\.env.local" if not exist "apps\m5-documents\.env" (
    echo [MISSING] apps\m5-documents\.env.local
    echo   Copy apps\m5-documents\.env.example to apps\m5-documents\.env.local
    echo   and fill in VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.
    echo.
    set MISSING_ENV=1
)
if not exist "supabase\functions\.env" (
    echo [MISSING] supabase\functions\.env
    echo   Copy supabase\functions\.env.example to supabase\functions\.env.
    echo   Required for local M5 uploads to work at all: pipeline-worker
    echo   rejects every job without PIPELINE_WORKER_SECRET set. Add a real
    echo   ANTHROPIC_API_KEY too if you want documents to actually process,
    echo   not just upload.
    echo.
    set MISSING_ENV=1
)

if "!MISSING_ENV!"=="1" (
    echo Fix the missing file^(s^) above, then run start-hub.bat again.
    echo.
    pause
    exit /b 1
)

echo All required .env files are present.
echo.

rem -- 2. Resolve the Supabase CLI ------------------------------------------
rem This project has never required a global "supabase" install - every
rem command in docs/deploy-checklist.md and the CI workflow uses
rem `npx supabase@latest`. If you ran `supabase start` directly in cmd and
rem got "'supabase' is not recognized", that's why - there's nothing on
rem PATH unless you installed the CLI yourself. Use a real install if one
rem exists (faster, skips npx's version-resolution network check on every
rem call); fall back to npx otherwise.
set SUPABASE_CMD=supabase
where supabase >nul 2>&1
if errorlevel 1 (
    echo No global "supabase" command found on PATH - using "npx supabase@latest" instead.
    set SUPABASE_CMD=npx --yes supabase@latest
) else (
    echo Found a global "supabase" CLI on PATH.
)
echo.

rem -- 3. Docker must actually be running - supabase start needs it --------
echo Checking Docker...
docker info >nul 2>&1
if errorlevel 1 (
    echo.
    echo [ERROR] Docker doesn't seem to be installed or running. Supabase's
    echo         local stack ^(Postgres, Auth, Storage, Edge Functions^) runs
    echo         entirely in Docker containers. Start Docker Desktop, wait
    echo         for it to say it's running, then run start-hub.bat again.
    echo.
    pause
    exit /b 1
)
echo Docker is running.
echo.

rem -- 4. Start the local Supabase stack ------------------------------------
echo Starting Supabase ^(first run pulls several images - can take a few
echo minutes; safe to leave running across sessions after that^)...
call %SUPABASE_CMD% start
if errorlevel 1 (
    echo.
    echo [ERROR] "supabase start" failed. Scroll up for the actual error.
    echo.
    pause
    exit /b 1
)
echo.

set /p RESET_DB="Reset the local database to a clean, fully-migrated state? This wipes any local test data. [Y/n]: "
if "!RESET_DB!"=="" set RESET_DB=Y
if /i "!RESET_DB!"=="Y" (
    echo Applying every migration and seed.sql from scratch ^(supabase db reset^)...
    call %SUPABASE_CMD% db reset
    if errorlevel 1 (
        echo.
        echo [ERROR] "supabase db reset" failed. Scroll up for the actual error.
        echo.
        pause
        exit /b 1
    )
) else (
    echo Skipping the reset - using whatever's already in the local database.
    echo If you've added new migrations since the last reset, run
    echo "supabase db reset" yourself before testing anything that depends on them.
)

echo.
echo Supabase is up:
echo   Studio ^(browse the DB^):        http://127.0.0.1:54323
echo   Inbucket ^(local dev email^):    http://127.0.0.1:54324
echo   Signing up through the hub sends magic links / confirmation emails
echo   there, not to a real inbox. The FIRST account you create becomes
echo   platform staff automatically ^(local dev only^) - that's how you
echo   reach /admin.
echo.

rem -- 5. Launch the two Vite dev servers -----------------------------------
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
echo Running now: Supabase ^(Docker^), and the "Oravio Hub - shell" and
echo "Oravio Hub - m5-documents" windows. Keep all of it open while you test;
echo use stop-hub.bat when you're done.
echo.
pause
