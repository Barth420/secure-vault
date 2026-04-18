@echo off
title SecureVault — Stopping
color 0C

echo.
echo  ==========================================
echo   SECUREVAULT — Shutting down...
echo  ==========================================
echo.

:: ── Stop containers ─────────────────────────────────────────
echo  [1/2] Stopping containers...
cd /d "%~dp0"
docker compose down
echo  Containers stopped!

:: ── Remove port proxy ────────────────────────────────────────
echo.
echo  [2/2] Removing phone port proxy...
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4" ^| findstr "192.168"') do (
    set WIFI_IP=%%a
    goto :found_ip
)
:found_ip
set WIFI_IP=%WIFI_IP: =%

if not "%WIFI_IP%"=="" (
    netsh interface portproxy delete v4tov4 listenaddress=%WIFI_IP% listenport=80 >nul 2>&1
    echo  Port proxy removed!
)

echo.
echo  ==========================================
echo   SECUREVAULT stopped cleanly.
echo  ==========================================
echo.
pause
