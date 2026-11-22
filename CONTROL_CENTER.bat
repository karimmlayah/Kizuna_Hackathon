@echo off
chcp 65001 > nul
title Smart Solar Control Center
cls
echo Démarrage du Smart Solar Control Center...
start "" "%~dp0backend\.venv\Scripts\pythonw.exe" "%~dp0control_center.py"
if %errorlevel% neq 0 (
    python "%~dp0control_center.py"
)
exit
