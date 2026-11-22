@echo off
chcp 65001 > nul
title "Smart Solar — Démarrage Complet"
cls
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start_smart_solar.ps1"
if %errorlevel% neq 0 (
    echo.
    echo [ERREUR] Le script de démarrage a rencontré une anomalie.
    pause
)
