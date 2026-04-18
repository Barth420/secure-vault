# SecureVault Startup Script
# Runs as Administrator via start-vault.bat

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

Write-Host ""
Write-Host "  ==========================================" -ForegroundColor Green
Write-Host "   SECUREVAULT - Starting up..." -ForegroundColor Green
Write-Host "  ==========================================" -ForegroundColor Green
Write-Host ""

# ── Step 1: Check Docker ──────────────────────────────────────
Write-Host "  [1/4] Checking Docker..." -ForegroundColor Cyan
try {
    docker info 2>&1 | Out-Null
    Write-Host "  Docker is running!" -ForegroundColor Green
} catch {
    Write-Host "  Docker is not running. Starting Docker Desktop..." -ForegroundColor Yellow
    Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    Write-Host "  Waiting 45 seconds for Docker to be ready..." -ForegroundColor Yellow
    Start-Sleep -Seconds 45
    try {
        docker info 2>&1 | Out-Null
        Write-Host "  Docker is now running!" -ForegroundColor Green
    } catch {
        Write-Host ""
        Write-Host "  ERROR: Docker is still not ready." -ForegroundColor Red
        Write-Host "  Please wait for the Docker whale icon to stop animating," -ForegroundColor Red
        Write-Host "  then run start-vault.bat again." -ForegroundColor Red
        Write-Host ""
        Read-Host "  Press Enter to exit"
        exit 1
    }
}

# ── Step 2: Start Containers ─────────────────────────────────
Write-Host ""
Write-Host "  [2/4] Starting SecureVault containers..." -ForegroundColor Cyan
try {
    docker compose up -d
    Write-Host "  Containers started!" -ForegroundColor Green
} catch {
    Write-Host ""
    Write-Host "  ERROR: Failed to start containers." -ForegroundColor Red
    Write-Host "  Run 'docker compose logs' to see what went wrong." -ForegroundColor Red
    Write-Host ""
    Read-Host "  Press Enter to exit"
    exit 1
}

# ── Step 3: Detect Wi-Fi IP ───────────────────────────────────
Write-Host ""
Write-Host "  [3/4] Detecting Wi-Fi IP address..." -ForegroundColor Cyan
$WIFI_IP = ""
$adapters = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -like "192.168.*" }
if ($adapters) {
    $WIFI_IP = $adapters[0].IPAddress
    Write-Host "  Found IP: $WIFI_IP" -ForegroundColor Green
} else {
    Write-Host "  Could not detect Wi-Fi IP. Skipping phone proxy." -ForegroundColor Yellow
}

# ── Step 4: Port Proxy for Phone ─────────────────────────────
if ($WIFI_IP) {
    Write-Host ""
    Write-Host "  [4/4] Setting up phone access..." -ForegroundColor Cyan
    netsh interface portproxy delete v4tov4 listenaddress=$WIFI_IP listenport=80 2>&1 | Out-Null
    netsh interface portproxy add v4tov4 listenaddress=$WIFI_IP listenport=80 connectaddress=127.0.0.1 connectport=80
    Write-Host "  Phone proxy configured!" -ForegroundColor Green
}

# ── Ready! ────────────────────────────────────────────────────
Write-Host ""
Write-Host "  ==========================================" -ForegroundColor Green
Write-Host "   SECUREVAULT IS READY!" -ForegroundColor Green
Write-Host "  ==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "   PC Access    : http://localhost" -ForegroundColor White
if ($WIFI_IP) {
    Write-Host "   Phone Access  : http://$WIFI_IP" -ForegroundColor White
}
Write-Host ""
Write-Host "  Starting Cloudflare Tunnel..." -ForegroundColor Cyan
Write-Host "  (Keep this window open - your public URL appears below)" -ForegroundColor Yellow
Write-Host "  ==========================================" -ForegroundColor Green
Write-Host ""

# ── Cloudflare Tunnel ─────────────────────────────────────────
$cloudflared = Join-Path $scriptDir "cloudflared.exe"
if (Test-Path $cloudflared) {
    & $cloudflared tunnel --url http://localhost:80
} else {
    Write-Host "  cloudflared.exe not found in project folder." -ForegroundColor Yellow
    Write-Host "  Skipping Cloudflare Tunnel. Server is still running locally." -ForegroundColor Yellow
}

Write-Host ""
Read-Host "  Press Enter to exit"
