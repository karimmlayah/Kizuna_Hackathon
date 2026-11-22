@echo off
echo =======================================================
echo Smart Solar — AI Roof Planner & Expo Go SDK 58
echo =======================================================
echo Lancement du service FastAPI IA U-Net sur le port 8003...
start "Smart Solar AI Backend (Port 8003)" cmd /k "cd /d %~dp0backend && .venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8003"

echo Lancement de Metro Expo Go (SDK 58) sur le port 8081...
start "Smart Solar Expo Go (Port 8081)" cmd /k "cd /d %~dp0frontend && npm run ios:go"

echo Les deux services demarrent dans des fenetres dediees.
