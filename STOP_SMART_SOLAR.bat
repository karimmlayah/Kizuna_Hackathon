@echo off
chcp 65001 > nul
title "Smart Solar — Arrêt des Services"
cls
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0stop_smart_solar.ps1"
echo.
echo Opération terminée.
pause
