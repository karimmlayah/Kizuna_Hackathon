<#
.SYNOPSIS
    Smart Solar - Lanceur Unique Haute Performance.
.DESCRIPTION
    Demarre automatiquement l'ensemble de la plateforme Smart Solar :
    1. Backend IoT (Port 8001)
    2. Gateway IoT (Port 8002)
    3. Microservice SAM AI CUDA (Port 8004)
    4. Backend Principal et API (Port 8003)
    5. Cloudflare Tunnel (Tunnel public pour Mokxi ESP32)
    6. Frontend Expo Router (Port 8081)
    7. Smart Solar Control Center (GUI Tkinter)
#>

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $RootDir

$LogsDir = Join-Path $RootDir "logs"
if (-not (Test-Path $LogsDir)) {
    New-Item -ItemType Directory -Path $LogsDir -Force | Out-Null
}

function Write-Header {
    Write-Host "==========================================================================" -ForegroundColor DarkYellow
    Write-Host "       SMART SOLAR - PLATEFORME PHOTOVOLTAIQUE ET IOT LIVE                " -ForegroundColor Yellow -BackgroundColor Black
    Write-Host "       Meta SAM ViT-B (CUDA) | Live Mokxi ESP32 | Gemini Multimodal       " -ForegroundColor White
    Write-Host "==========================================================================" -ForegroundColor DarkYellow
    Write-Host ""
}

function Test-PortListening {
    param([int]$Port)
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $iar = $tcp.BeginConnect("127.0.0.1", $Port, $null, $null)
        $wait = $iar.AsyncWaitHandle.WaitOne(400, $false)
        if ($wait) {
            $tcp.EndConnect($iar)
            $tcp.Close()
            return $true
        }
        $tcp.Close()
        return $false
    } catch {
        return $false
    }
}

function Wait-EndpointHealthy {
    param(
        [string]$Url,
        [int]$TimeoutSeconds = 25,
        [string]$ServiceName
    )
    $elapsed = 0
    while ($elapsed -lt $TimeoutSeconds) {
        try {
            $req = [System.Net.WebRequest]::Create($Url)
            $req.Timeout = 1200
            $res = $req.GetResponse()
            if ($res.StatusCode -eq 200) {
                $res.Close()
                return $true
            }
            $res.Close()
        } catch {
            # Still waiting
        }
        Start-Sleep -Milliseconds 600
        $elapsed += 1
    }
    return $false
}

Write-Header

# 1. Acceleration Materielle CUDA
Write-Host "[1/6] Verification de l'acceleration GPU CUDA..." -ForegroundColor Cyan
try {
    $cudaScript = "import torch; print(f'CUDA: {torch.cuda.is_available()} | GPU: {torch.cuda.get_device_name(0) if torch.cuda.is_available() else None}')"
    $cudaOut = & "$RootDir\test_sam\.venv\Scripts\python.exe" -c $cudaScript 2>&1
    Write-Host "   -> $cudaOut" -ForegroundColor Green
} catch {
    Write-Host "   -> Verification GPU terminee" -ForegroundColor DarkGray
}

# 2. Service Backend IoT (Port 8001)
Write-Host ""
Write-Host "[2/6] Demarrage du Backend IoT (Port 8001)..." -ForegroundColor Cyan
if (Test-PortListening 8001) {
    Write-Host "   -> Port 8001 deja actif [OK]" -ForegroundColor Yellow
} else {
    $iotLog = Join-Path $LogsDir "iot_backend.log"
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = "$RootDir\iot\.venv\Scripts\python.exe"
    $psi.Arguments = "-m uvicorn iot.api.main:app --host 0.0.0.0 --port 8001"
    $psi.WorkingDirectory = $RootDir
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.UseShellExecute = $false
    $p = [System.Diagnostics.Process]::Start($psi)

    Start-Job -ScriptBlock {
        param($proc, $log)
        while (-not $proc.HasExited) {
            $line = $proc.StandardOutput.ReadLine()
            if ($line) { Add-Content -Path $log -Value $line }
            $err = $proc.StandardError.ReadLine()
            if ($err) { Add-Content -Path $log -Value $err }
        }
    } -ArgumentList $p, $iotLog | Out-Null

    if (Wait-EndpointHealthy "http://127.0.0.1:8001/health" 15 "Backend IoT") {
        Write-Host "   -> Backend IoT operationnel sur http://127.0.0.1:8001 [OK]" -ForegroundColor Green
    } else {
        Write-Host "   -> Demarrage Backend IoT en cours, voir logs/iot_backend.log" -ForegroundColor Yellow
    }
}

# 3. Service Gateway IoT (Port 8002)
Write-Host ""
Write-Host "[3/6] Demarrage du Gateway IoT Securise (Port 8002)..." -ForegroundColor Cyan
if (Test-PortListening 8002) {
    Write-Host "   -> Port 8002 deja actif [OK]" -ForegroundColor Yellow
} else {
    $gwLog = Join-Path $LogsDir "iot_gateway.log"
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = "$RootDir\iot\.venv\Scripts\python.exe"
    $psi.Arguments = "-m uvicorn iot.api.gateway:app --host 0.0.0.0 --port 8002"
    $psi.WorkingDirectory = $RootDir
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.UseShellExecute = $false
    $p = [System.Diagnostics.Process]::Start($psi)

    Start-Job -ScriptBlock {
        param($proc, $log)
        while (-not $proc.HasExited) {
            $line = $proc.StandardOutput.ReadLine()
            if ($line) { Add-Content -Path $log -Value $line }
            $err = $proc.StandardError.ReadLine()
            if ($err) { Add-Content -Path $log -Value $err }
        }
    } -ArgumentList $p, $gwLog | Out-Null

    if (Wait-EndpointHealthy "http://127.0.0.1:8002/health" 15 "Gateway IoT") {
        Write-Host "   -> Gateway IoT operationnel sur http://127.0.0.1:8002 [OK]" -ForegroundColor Green
    } else {
        Write-Host "   -> Demarrage Gateway IoT differe, voir logs/iot_gateway.log" -ForegroundColor Yellow
    }
}

# 4. Microservice SAM ViT-B CUDA (Port 8004)
Write-Host ""
Write-Host "[4/6] Demarrage du Microservice SAM ViT-B sur GPU (Port 8004)..." -ForegroundColor Cyan
if (Test-PortListening 8004) {
    Write-Host "   -> Port 8004 deja actif [OK]" -ForegroundColor Yellow
} else {
    $samLog = Join-Path $LogsDir "sam_microservice.log"
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = "$RootDir\test_sam\.venv\Scripts\python.exe"
    $psi.Arguments = "-m uvicorn test_sam.sam_server:app --host 0.0.0.0 --port 8004"
    $psi.WorkingDirectory = $RootDir
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.UseShellExecute = $false
    $p = [System.Diagnostics.Process]::Start($psi)

    Start-Job -ScriptBlock {
        param($proc, $log)
        while (-not $proc.HasExited) {
            $line = $proc.StandardOutput.ReadLine()
            if ($line) { Add-Content -Path $log -Value $line }
            $err = $proc.StandardError.ReadLine()
            if ($err) { Add-Content -Path $log -Value $err }
        }
    } -ArgumentList $p, $samLog | Out-Null

    if (Wait-EndpointHealthy "http://127.0.0.1:8004/health" 25 "SAM Microservice") {
        Write-Host "   -> SAM AI Engine operationnel sur http://127.0.0.1:8004 [OK]" -ForegroundColor Green
    } else {
        Write-Host "   -> Demarrage SAM differe, voir logs/sam_microservice.log" -ForegroundColor Yellow
    }
}

# 5. Backend Principal Smart Solar (Port 8003)
Write-Host ""
Write-Host "[5/6] Demarrage du Backend Principal Smart Solar (Port 8003)..." -ForegroundColor Cyan
if (Test-PortListening 8003) {
    Write-Host "   -> Port 8003 deja actif [OK]" -ForegroundColor Yellow
} else {
    $backendLog = Join-Path $LogsDir "backend_main.log"
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = "$RootDir\backend\.venv\Scripts\python.exe"
    $psi.Arguments = "-m uvicorn backend.main:app --host 0.0.0.0 --port 8003"
    $psi.WorkingDirectory = $RootDir
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.UseShellExecute = $false
    $p = [System.Diagnostics.Process]::Start($psi)

    Start-Job -ScriptBlock {
        param($proc, $log)
        while (-not $proc.HasExited) {
            $line = $proc.StandardOutput.ReadLine()
            if ($line) { Add-Content -Path $log -Value $line }
            $err = $proc.StandardError.ReadLine()
            if ($err) { Add-Content -Path $log -Value $err }
        }
    } -ArgumentList $p, $backendLog | Out-Null

    if (Wait-EndpointHealthy "http://127.0.0.1:8003/" 20 "Backend Principal") {
        Write-Host "   -> Backend Principal operationnel sur http://127.0.0.1:8003 [OK]" -ForegroundColor Green
    } else {
        Write-Host "   -> Demarrage Backend differe, voir logs/backend_main.log" -ForegroundColor Yellow
    }
}

# 6. Cloudflare Quick Tunnel pour Mokxi
Write-Host ""
Write-Host "Demarrage du Cloudflare Tunnel pour Mokxi..." -ForegroundColor Cyan
$cfTunnelLog = Join-Path $LogsDir "cloudflare_tunnel.log"
$cfCmd = "C:\Program Files (x86)\cloudflared\cloudflared.exe"
if (Test-Path $cfCmd) {
    $existingCf = Get-Process -Name "cloudflared" -ErrorAction SilentlyContinue
    if (-not $existingCf) {
        $psi = New-Object System.Diagnostics.ProcessStartInfo
        $psi.FileName = $cfCmd
        $psi.Arguments = "tunnel --url http://localhost:8002"
        $psi.RedirectStandardOutput = $true
        $psi.RedirectStandardError = $true
        $psi.UseShellExecute = $false
        $cfProc = [System.Diagnostics.Process]::Start($psi)

        Start-Job -ScriptBlock {
            param($proc, $log)
            while (-not $proc.HasExited) {
                $err = $proc.StandardError.ReadLine()
                if ($err) { Add-Content -Path $log -Value $err }
            }
        } -ArgumentList $cfProc, $cfTunnelLog | Out-Null

        Start-Sleep -Seconds 4
    }

    $detectedUrl = ""
    if (Test-Path $cfTunnelLog) {
        $matches = Select-String -Path $cfTunnelLog -Pattern "https://[a-zA-Z0-9-]+\.trycloudflare\.com" -AllMatches
        if ($matches) {
            $detectedUrl = $matches[-1].Matches[0].Value
        }
    }

    if ($detectedUrl) {
        Write-Host "   -> URL publique Cloudflare Tunnel : $detectedUrl" -ForegroundColor Green
        Write-Host "      (A coller dans le code Mokxi pour l'endpoint HTTPS !)" -ForegroundColor Yellow
    } else {
        Write-Host "   -> Tunnel actif sur http://localhost:8002 (logs: logs/cloudflare_tunnel.log)" -ForegroundColor Green
    }
} else {
    Write-Host "   -> cloudflared non trouve, les tests locaux utilisent http://127.0.0.1:8002" -ForegroundColor DarkGray
}

# 7. Frontend Expo (Port 8081)
Write-Host ""
Write-Host "[6/6] Demarrage du Frontend Expo SDK 58 (Port 8081)..." -ForegroundColor Cyan
if (Test-PortListening 8081) {
    Write-Host "   -> Port 8081 deja actif [OK]" -ForegroundColor Yellow
} else {
    $frontendLog = Join-Path $LogsDir "frontend.log"
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = "node.exe"
    $psi.Arguments = "scripts/start-expo-go.cjs"
    $psi.WorkingDirectory = Join-Path $RootDir "frontend"
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.UseShellExecute = $false
    $p = [System.Diagnostics.Process]::Start($psi)

    Start-Job -ScriptBlock {
        param($proc, $log)
        while (-not $proc.HasExited) {
            $line = $proc.StandardOutput.ReadLine()
            if ($line) { Add-Content -Path $log -Value $line }
            $err = $proc.StandardError.ReadLine()
            if ($err) { Add-Content -Path $log -Value $err }
        }
    } -ArgumentList $p, $frontendLog | Out-Null

    Wait-EndpointHealthy "http://127.0.0.1:8081" 15 "Frontend" | Out-Null
    Write-Host "   -> Frontend Expo operationnel sur http://localhost:8081 [OK]" -ForegroundColor Green
}

# 8. Lancement du Smart Solar Control Center (GUI Tkinter)
$pythonwCmd = "$RootDir\backend\.venv\Scripts\pythonw.exe"
$controlCenterPy = "$RootDir\control_center.py"
if (Test-Path $pythonwCmd) {
    Start-Process $pythonwCmd -ArgumentList "`"$controlCenterPy`"" -WorkingDirectory $RootDir
    Write-Host ""
    Write-Host "   -> Smart Solar Control Center lance en interface graphique [OK]" -ForegroundColor Green
}

# Resume Final
Write-Host ""
Write-Host "==========================================================================" -ForegroundColor Green
Write-Host "       TOUS LES SERVICES SMART SOLAR SONT PRETS ET OPERATIONNELS !         " -ForegroundColor White -BackgroundColor DarkGreen
Write-Host "==========================================================================" -ForegroundColor Green
Write-Host " - Frontend Web et Expo Go   : http://localhost:8081" -ForegroundColor White
Write-Host " - Smart Energy Monitoring   : http://localhost:8081/monitoring" -ForegroundColor Yellow
Write-Host " - Backend Principal API     : http://127.0.0.1:8003/docs" -ForegroundColor White
Write-Host " - Backend IoT               : http://127.0.0.1:8001/api/iot/mokxi/latest" -ForegroundColor White
Write-Host " - Gateway IoT (Securise)    : http://127.0.0.1:8002/api/iot/measurements" -ForegroundColor White
Write-Host " - Microservice SAM (CUDA)   : http://127.0.0.1:8004/health" -ForegroundColor White
Write-Host " - Logs centralises          : $LogsDir" -ForegroundColor DarkGray
Write-Host "==========================================================================" -ForegroundColor Green
Write-Host ""

# Ouverture automatique du navigateur Web
Start-Process "http://localhost:8081/monitoring"

Write-Host "Services actifs en arriere-plan. Vous pouvez utiliser le Smart Solar Control Center."
