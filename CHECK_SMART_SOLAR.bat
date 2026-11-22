@echo off
chcp 65001 > nul
title "Smart Solar — Diagnostic & Statut"
cls
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0check_smart_solar.ps1"
echo.
pause
