# Installation & Setup Guide — Smart Solar

This guide provides end-to-end instructions for deploying **Smart Solar** locally on Windows, Linux, or macOS.

---

## 1. Prerequisites

Ensure you have the following installed on your host system:

| Prerequisite | Minimum Version | Recommended | Notes |
| :--- | :---: | :---: | :--- |
| **Python** | 3.10 | 3.10 or 3.11 | Required for backend, IoT, and SAM microservices |
| **Node.js** | 18.x | 20.x LTS | Required for Expo / React Native frontend |
| **Git** | 2.30+ | Latest | For repository cloning and submodule management |
| **NVIDIA CUDA** | 11.8+ | 12.1+ | Optional: required for GPU-accelerated SAM ViT-B |

---

## 2. Clone the Repository

```bash
git clone https://github.com/karimmlayah/Kizuna_Hackathon.git
cd Kizuna_Hackathon
```

---

## 3. Environment Variables Configuration

Create the local `.env` files using the provided templates:

### A. Root / Core Backend Configuration
Copy `.env.example` to `backend/.env`:
```bash
cp .env.example backend/.env
```
Edit `backend/.env` with your preferred credentials:
```env
# Google Gemini API Key (Get a free key from https://aistudio.google.com/)
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_BASE_URL=https://generativelanguage.googleapis.com/v1beta
GEMINI_MODEL=gemini-3.5-flash

# IoT Security Key (Generate any secure random string or 32-char hex)
SMART_SOLAR_IOT_API_KEY=ac8c3e4ff5d67f5806df8013beb439f2f311975ae923de7d
```

---

## 4. AI Models Download & Verification

Verify or download the required weights (such as Meta Segment Anything ViT-B):

```bash
python scripts/download_models.py
```

*For more details regarding model licenses and manual download links, consult [docs/MODELS.md](MODELS.md).*

---

## 5. Dependency Installation

### A. Core Backend Dependencies
```bash
cd backend
python -m venv .venv
# On Windows:
.venv\Scripts\activate
# On Linux / macOS:
# source .venv/bin/activate

pip install -r requirements.txt
cd ..
```

### B. SAM AI Microservice Dependencies (GPU Recommended)
```bash
cd test_sam
python -m venv .venv
# On Windows:
.venv\Scripts\activate
# On Linux / macOS:
# source .venv/bin/activate

# Install PyTorch with CUDA support (adjust for your CUDA version):
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121
pip install -r requirements.txt
cd ..
```

### C. IoT Telemetry Dependencies
```bash
cd iot
python -m venv .venv
# On Windows:
.venv\Scripts\activate
# On Linux / macOS:
# source .venv/bin/activate

pip install -r requirements.txt
cd ..
```

### D. Frontend Dependencies (Expo / React Native)
```bash
cd frontend
npm install
cd ..
```

---

## 6. Launching Smart Solar

### Fast Launch (Windows 1-Click)
Simply double-click:
```cmd
START_SMART_SOLAR.bat
```
or run via PowerShell:
```powershell
.\start_smart_solar.ps1
```
This automatically boots all 5 background services and opens the **Smart Solar Control Center** GUI.

### Manual Individual Launch
If you prefer running services in separate terminal sessions:

1. **IoT Backend (Port 8001)**:
   ```bash
   cd iot && .venv\Scripts\uvicorn api.main:app --host 0.0.0.0 --port 8001
   ```
2. **IoT Gateway (Port 8002)**:
   ```bash
   cd iot && .venv\Scripts\uvicorn api.gateway:app --host 0.0.0.0 --port 8002
   ```
3. **Core Backend (Port 8003)**:
   ```bash
   cd backend && .venv\Scripts\uvicorn main:app --host 0.0.0.0 --port 8003
   ```
4. **SAM AI Microservice (Port 8004)**:
   ```bash
   cd test_sam && .venv\Scripts\uvicorn sam_server:app --host 0.0.0.0 --port 8004
   ```
5. **Frontend Client (Port 8081)**:
   ```bash
   cd frontend && npx expo start --web
   ```

Open your browser at `http://localhost:8081` to experience **Smart Solar**.
