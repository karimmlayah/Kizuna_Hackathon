<#
.SYNOPSIS
    Smart Solar - Arret Propre de Tous les Services.
.DESCRIPTION
    Arrete de facon securisee l'ensemble des microservices et processus Smart Solar :
    - Port 8001 (Backend IoT)
    - Port 8002 (Gateway IoT)
    - Port 8003 (Backend Principal)
    - Port 8004 (Microservice SAM ViT-B CUDA)
    - Port 8081 (Frontend Expo / Metro)
    - Processus cloudflared.exe
#>

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "==========================================================================" -ForegroundColor DarkYellow
Write-Host "       SMART SOLAR - ARRET DE L'ENSEMBLE DES SERVICES                     " -ForegroundColor Yellow -BackgroundColor Black
Write-Host "==========================================================================" -ForegroundColor DarkYellow
Write-Host ""

$portsToKill = @(8001, 8002, 8003, 8004, 8081)

foreach ($port in $portsToKill) {
    Write-Host "Recherche des processus sur le port $port..." -ForegroundColor Cyan
    try {
        $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
        if ($connections) {
            $pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique
            foreach ($procId in $pids) {
                if ($procId -gt 4) {
                    $p = Get-Process -Id $procId -ErrorAction SilentlyContinue
                    $pName = if ($p) { $p.ProcessName } else { "PID $procId" }
                    Write-Host "   -> Arret de $pName (PID: $procId sur port $port)..." -ForegroundColor Yellow
                    Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
                    Write-Host "      [Stoppe]" -ForegroundColor Green
                }
            }
        } else {
            Write-Host "   -> Port $port libre [OK]" -ForegroundColor DarkGray
        }
    } catch {
        Write-Host "   -> Erreur d'arret pour le port $port : $_" -ForegroundColor DarkRed
    }
}

# Arret du tunnel Cloudflare si en cours
Write-Host ""
Write-Host "Arret eventuel de cloudflared..." -ForegroundColor Cyan
$cfProcesses = Get-Process -Name "cloudflared" -ErrorAction SilentlyContinue
if ($cfProcesses) {
    foreach ($cf in $cfProcesses) {
        Write-Host "   -> Arret du tunnel Cloudflare (PID: $($cf.Id))..." -ForegroundColor Yellow
        Stop-Process -Id $cf.Id -Force -ErrorAction SilentlyContinue
        Write-Host "      [Stoppe]" -ForegroundColor Green
    }
} else {
    Write-Host "   -> Aucun tunnel Cloudflare actif [OK]" -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "==========================================================================" -ForegroundColor Green
Write-Host "       TOUS LES SERVICES SMART SOLAR SONT ARRETES PROPREMENT !            " -ForegroundColor White -BackgroundColor DarkGreen
Write-Host "==========================================================================" -ForegroundColor Green
Write-Host ""
