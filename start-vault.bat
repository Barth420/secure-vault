@echo off
title SecureVault — Startup
color 0A

echo.
echo  ==========================================
echo   SECUREVAULT — Starting up...
echo  ==========================================
echo.

:: ── Step 1: Check if Docker is running ──────────────────────
echo  [1/4] Checking Docker...
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo  Docker is not running. Starting Docker Desktop...
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    echo  Waiting for Docker to be ready (30 seconds)...
    timeout /t 30 /nobreak >nul
    docker info >nul 2>&1
    if %errorlevel% neq 0 (
        echo.
        echo  ERROR: Docker still not ready. Please open Docker Desktop manually
        echo  and wait for the green icon, then run this file again.
        echo.
        pause
        exit /b 1
    )
)
echo  Docker is running!

:: ── Step 2: Start the containers ────────────────────────────
echo.
echo  [2/4] Starting SecureVault containers...
cd /d "%~dp0"
docker compose up -d
if %errorlevel% neq 0 (
    echo  ERROR: Failed to start containers. Check docker compose logs.
    pause
    exit /b 1
)
echo  Containers started!

:: ── Step 3: Get current Wi-Fi IP automatically ──────────────
echo.
echo  [3/4] Detecting Wi-Fi IP address...
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4" ^| findstr "192.168"') do (
    set WIFI_IP=%%a
    goto :found_ip
)
:found_ip
:: Trim leading space from IP
set WIFI_IP=%WIFI_IP: =%

if "%WIFI_IP%"=="" (
    echo  Could not auto-detect Wi-Fi IP. Skipping phone proxy setup.
    echo  Run 'ipconfig' manually and set up port proxy if needed.
    goto :done
)

echo  Found IP: %WIFI_IP%

:: ── Step 4: Set up port proxy for phone access ───────────────
echo.
echo  [4/4] Setting up phone access (port proxy)...
:: Remove old rule first (in case IP changed)
netsh interface portproxy delete v4tov4 listenaddress=%WIFI_IP% listenport=80 >nul 2>&1
:: Add fresh rule
netsh interface portproxy add v4tov4 listenaddress=%WIFI_IP% listenport=80 connectaddress=127.0.0.1 connectport=80
echo  Phone proxy configured!

:done
echo.
echo  ==========================================
echo   SECUREVAULT IS READY!
echo  ==========================================
echo.
echo   PC Access  : http://localhost
if not "%WIFI_IP%"=="" (
    echo   Phone Access: http://%WIFI_IP%
)
echo.
echo  Starting Cloudflare Tunnel for global access...
echo  (Keep this window open. URL appears below)
echo  ==========================================
echo.
.\cloudflared.exe tunnel --url http://localhost:80
pause
