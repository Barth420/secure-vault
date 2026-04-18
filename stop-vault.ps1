# SecureVault Stop Script
# Runs as Administrator via stop-vault.bat

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

Write-Host ""
Write-Host "  ==========================================" -ForegroundColor Red
Write-Host "   SECUREVAULT - Shutting down..." -ForegroundColor Red
Write-Host "  ==========================================" -ForegroundColor Red
Write-Host ""

# ── Stop Containers ──────────────────────────────────────────
Write-Host "  [1/2] Stopping containers..." -ForegroundColor Cyan
docker compose down
Write-Host "  Containers stopped!" -ForegroundColor Green

# ── Remove Port Proxy ────────────────────────────────────────
Write-Host ""
Write-Host "  [2/2] Removing phone port proxy..." -ForegroundColor Cyan
$adapters = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -like "192.168.*" }
if ($adapters) {
    $WIFI_IP = $adapters[0].IPAddress
    netsh interface portproxy delete v4tov4 listenaddress=$WIFI_IP listenport=80 2>&1 | Out-Null
    Write-Host "  Port proxy removed!" -ForegroundColor Green
}

Write-Host ""
Write-Host "  ==========================================" -ForegroundColor Red
Write-Host "   SECUREVAULT stopped cleanly." -ForegroundColor Red
Write-Host "  ==========================================" -ForegroundColor Red
Write-Host ""
Read-Host "  Press Enter to exit"
