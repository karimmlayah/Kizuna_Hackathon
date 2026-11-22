<#
.SYNOPSIS
    Smart Solar - Verification et Diagnostic des Services.
#>

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "==========================================================================" -ForegroundColor DarkYellow
Write-Host "       SMART SOLAR - VERIFICATION DU STATUT DES SERVICES                  " -ForegroundColor Yellow -BackgroundColor Black
Write-Host "==========================================================================" -ForegroundColor DarkYellow
Write-Host ""

function Test-Port {
    param([int]$p, [string]$name, [string]$url)
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $iar = $tcp.BeginConnect('127.0.0.1', $p, $null, $null)
        $ok = $iar.AsyncWaitHandle.WaitOne(400, $false)
        if ($ok) {
            $tcp.EndConnect($iar)
            $tcp.Close()
            Write-Host "   [EN LIGNE]  Port $p : $name" -ForegroundColor Green
            if ($url) {
                try {
                    $res = Invoke-WebRequest -Uri $url -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
                    Write-Host "                 Healthcheck: $($res.StatusCode) OK" -ForegroundColor DarkGreen
                } catch {
                    Write-Host "                 Healthcheck: $($_.Exception.Message)" -ForegroundColor DarkYellow
                }
            }
        } else {
            $tcp.Close()
            Write-Host "   [ARRETE]   Port $p : $name" -ForegroundColor Red
        }
    } catch {
        Write-Host "   [ARRETE]   Port $p : $name" -ForegroundColor Red
    }
}

Write-Host "Etat des Ports et Microservices :" -ForegroundColor Cyan
Test-Port 8001 "Backend IoT (Mokxi / ESP32)" "http://127.0.0.1:8001/health"
Test-Port 8002 "Gateway IoT Securise" "http://127.0.0.1:8002/health"
Test-Port 8003 "Backend Principal Smart Solar" "http://127.0.0.1:8003/"
Test-Port 8004 "Microservice Meta SAM ViT-B (CUDA)" "http://127.0.0.1:8004/health"
Test-Port 8081 "Frontend Expo Router / Web" "http://127.0.0.1:8081/status"

Write-Host ""
Write-Host "Tunnel Cloudflare (Mokxi) :" -ForegroundColor Cyan
$cf = Get-Process -Name "cloudflared" -ErrorAction SilentlyContinue
if ($cf) {
    Write-Host "   [ACTIF]    cloudflared.exe en cours (PID: $($cf.Id))" -ForegroundColor Green
} else {
    Write-Host "   [INACTIF]  Aucun tunnel Cloudflare en cours" -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "Acceleration Materielle GPU (CUDA) :" -ForegroundColor Cyan
try {
    $py = Join-Path $RootDir "test_sam\.venv\Scripts\python.exe"
    if (Test-Path $py) {
        $gpuInfo = & $py -c "import torch; print(f'CUDA: {torch.cuda.is_available()} | GPU: {torch.cuda.get_device_name(0) if torch.cuda.is_available() else None}')"
        Write-Host "   $gpuInfo" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   Verification CUDA non disponible" -ForegroundColor DarkRed
}

Write-Host ""
Write-Host "Telemetrie Mokxi ESP32 (Derniere mesure) :" -ForegroundColor Cyan
try {
    $res = Invoke-RestMethod -Uri "http://127.0.0.1:8001/api/iot/mokxi/latest" -TimeoutSec 2 -ErrorAction Stop
    Write-Host "   Tension solaire: $($res.voltage_v) V | Puissance: $($res.power_w) W | Date: $($res.timestamp)" -ForegroundColor Green
} catch {
    Write-Host "   En attente de reception de mesures Mokxi" -ForegroundColor DarkYellow
}

Write-Host ""
Write-Host "==========================================================================" -ForegroundColor DarkYellow
