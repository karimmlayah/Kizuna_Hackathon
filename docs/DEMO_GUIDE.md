# Hackathon Jury Demonstration Guide — Smart Solar

This guide outlines the recommended 5-minute live demonstration flow for the **Kizuna Hackathon** jury.

---

## 🚀 Pre-Flight Checklist

1. Double-click `START_SMART_SOLAR.bat` (or run `./start_smart_solar.ps1`).
2. Verify in the **Smart Solar Control Center** that all indicators are green:
   - Port 8001: IoT Core
   - Port 8002: IoT Gateway
   - Port 8003: Core Backend
   - Port 8004: SAM AI CUDA
   - Port 8081: Expo Web
3. Open `http://localhost:8081` in Chrome or Edge.

---

## ⏱️ 5-Minute Live Demo Walkthrough

### Minute 1: The Modern Energy Dashboard & 3D Mediterranean Villa
- **Action**: Arrive on the dashboard.
- **Key Points to Highlight**:
  - Contemporary architectural villa designed for Mediterranean & Tunisian climate.
  - Interactive 3D OrbitControls (drag to rotate, inspect rooftop panels, inverter, battery).
  - Dynamic weather pill with live solar irradiance from Open-Meteo for Tunis.
  - Transparent Solar Score gauge (69/100).

---

### Minute 2: STEG Invoice Digitization (PaddleOCR)
- **Action**: Navigate to **Facture Scan** (or upload `backend/models/ocr/outputs/facture_01.png`).
- **Key Points to Highlight**:
  - Instant extraction of invoice metrics without manual input:
    - Monthly consumption: **850 kWh**
    - Total amount: **297.500 TND**
    - STEG tier calculation and baseline carbon footprint.
  - Demonstrates how Smart Solar eliminates technical friction for non-expert homeowners.

---

### Minute 3: Interactive Solar Design Studio & Meta SAM ViT-B (GPU)
- **Action**: Open the **Studio** tab with `test_sam/test_images/roof.jpg`.
- **Key Points to Highlight**:
  - Click **"Segmentation IA (SAM)"**:
    - Runs Meta Segment Anything ViT-B locally on NVIDIA GPU.
    - Generates **26 candidate masks in 4.94 seconds**.
  - Highlighting safe zone and obstacle masking (chimneys, skylights, satellite dishes).
  - Automated panel layout: places 18 high-efficiency panels respecting a 0.5m setback buffer.
  - Instant financial projection: **7.2 kWp**, payback period **~4.8 years**.

---

### Minute 4: Voice Assistant & Tunisian Arabizi Intelligence
- **Action**: Open **Solar AI Chat** and click the microphone icon.
- **Spoken Prompt (Tunisian Arabizi)**:
  > *« Aslema, n7eb na3ref kadeh nesta3mel énergie hedha chhar, w est-ce que bech net3adda objectif mte3i ? »*
- **Key Points to Highlight**:
  - Live dictation text appears progressively in the input bar in real time.
  - Google Gemini multimodal model responds instantly in natural Tunisian Arabizi.
  - Solar AI recognizes the user's real-time consumption metrics and warns about target overruns.
  - Click the speaker icon to hear the synthesized audio response.

---

### Minute 5: Live IoT Edge Telemetry & Predictive Optimization
- **Action**: Navigate to **Monitoring**.
- **Key Points to Highlight**:
  - Live 1-second pulse from Mokxi ESP32 firmware measuring physical voltage & wattage.
  - **The 1200 / 900 / 15 / 30 Reference Prediction Scenario**:
    - Monthly goal: **1,200 kWh**
    - Consumed by Day 15: **900 kWh**
    - Projected consumption at current pace: **1,800 kWh (+600 kWh excess)**
    - Real-time advisory recommendation: **Cap remaining daily usage at 20 kWh/day** to avoid the expensive STEG tariff bracket (>500 kWh).
