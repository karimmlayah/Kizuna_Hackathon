# System Architecture — Smart Solar

**Smart Solar** is architected as an event-driven, decoupled multi-service platform uniting Computer Vision, Generative AI, Edge IoT telemetry, and a reactive cross-platform mobile/web client.

---

## 1. High-Level Architecture Diagram

```mermaid
flowchart TB
    subgraph Client["📱 Frontend Client (React Native / Expo SDK 52/58)"]
        UI["Cross-Platform UI (Web & Mobile)"]
        ThreeD["3D Solar Villa (Three.js / React Three Fiber)"]
        Studio["Interactive Solar Design Studio (Canvas)"]
        Voice["Voice Dictation & Speech Assistant"]
        MonitoringUI["Live Energy Monitoring & Gauges"]
    end

    subgraph CoreBackend["⚙️ Core API Backend (FastAPI :8003)"]
        ChatRouter["/api/chat — Solar AI Conversational Router"]
        SolarRouter["/api/solar — PV Sizing & Financial Engine"]
        OCRRouter["/api/ocr — STEG Bill Digitization (PaddleOCR)"]
        WeatherRouter["/api/weather — Open-Meteo & PVGIS Service"]
        EnergyRouter["/api/energy — Aggregator & Predictive Engine"]
    end

    subgraph SAMService["🧠 Computer Vision Microservice (PyTorch CUDA :8004)"]
        SAMCore["Meta Segment Anything (ViT-B)"]
        AutoMask["Automatic Mask Generator"]
        PlacementEngine["Photovoltaic Collision & Safe Zone Placement"]
    end

    subgraph IoTSubsystem["⚡ Edge IoT & Telemetry Subsystem"]
        MokxiSim["Mokxi Lab Simulator / Physical ESP32"]
        Gateway["FastAPI IoT Gateway (:8002)"]
        Cloudflare["Cloudflare Quick Tunnel (Public HTTPS)"]
        IoTBackend["IoT Telemetry Aggregator (:8001)"]
        SQLiteDB[("SQLite Telemetry Store (solar_iot.db)")]
    end

    subgraph ExternalAPIs["🌐 External Cloud Services"]
        GeminiAPI["Google Gemini 3.5 Flash API"]
        PVGISAPI["EU PVGIS Solar Irradiance API"]
        OpenMeteoAPI["Open-Meteo Weather API"]
    end

    %% Client Communications
    Client -->|HTTP / SSE Streaming| CoreBackend
    Client -->|Direct REST Queries| SAMService
    Client -->|Live Polling (1s)| CoreBackend

    %% Backend Integrations
    ChatRouter -->|Multimodal Inquiries| GeminiAPI
    WeatherRouter -->|Live Forecasts| OpenMeteoAPI
    SolarRouter -->|Satellite Solar Yield| PVGISAPI
    EnergyRouter -->|Fetch Live Measurements| IoTBackend

    %% IoT Flow
    MokxiSim -->|HTTPS POST + X-API-Key| Cloudflare
    Cloudflare --> Gateway
    Gateway -->|Forward Validated Metric| IoTBackend
    IoTBackend --> SQLiteDB
```

---

## 2. Microservices & Port Map

| Component | Technology | Default Port | Primary Responsibilities | Health Endpoint |
| :--- | :--- | :---: | :--- | :--- |
| **Frontend Application** | Expo, React Native, Three.js, TypeScript | `8081` | Web and mobile interactive dashboard, 3D house, rooftop canvas, voice assistant | `http://localhost:8081` |
| **Core Backend** | FastAPI, Uvicorn, Python 3.10+ | `8003` | Business logic, STEG invoice parsing, solar calculations, chat orchestration | `http://localhost:8003/api/health` |
| **SAM AI Microservice** | PyTorch, CUDA, Meta SAM ViT-B | `8004` | Rooftop facet extraction, obstacle isolation, safe zone computation | `http://localhost:8004/health` |
| **IoT Telemetry Gateway** | FastAPI, Pydantic | `8002` | Ingests ESP32 telemetry, enforces API key verification, forwards to IoT core | `http://localhost:8002/health` |
| **IoT Telemetry Service** | FastAPI, SQLite, Pydantic | `8001` | Manages historical time-series telemetry, calculates power averages | `http://localhost:8001/health` |
| **Smart Solar Control Center** | Python Tkinter Desktop GUI | GUI | Real-time service monitoring, process lifecycle management, tunnel status | Local Desktop Window |

---

## 3. Data & Communication Pipelines

### A. Solar AI Chatbot & Multimodal Pipeline
1. **User Input**: Text or speech audio recorded from the microphone (via Web Speech API / Audio Recorder).
2. **Context Enrichment**: The Core Backend injects:
   - User's location (Tunis, Sousse, Sfax, etc.).
   - Live weather and solar score from Open-Meteo.
   - Live IoT consumption vs. monthly target (e.g. 900 kWh used out of 1200 kWh at day 15).
   - STEG tariff brackets (0-200, 201-300, 301-500, >500 kWh).
3. **Inference**: Dispatched to `gemini-3.5-flash` with streaming SSE chunks (`streamGenerateContent`).
4. **Structured Cards**: If the query requests sizing or financial payback, Gemini appends a markdown block `---SOLAR_CARD_START--- ... ---SOLAR_CARD_END---`, parsed client-side into interactive cards.

### B. Meta SAM ViT-B Rooftop Segmentation Pipeline
1. **Image Input**: Aerial or high-resolution rooftop photo uploaded via the Design Studio.
2. **Inference (Port 8004)**: SAM ViT-B generates binary candidate segmentation masks across the surface.
3. **Facet Extraction**: Largest contiguous polygon detected as primary roof candidate; small structures (chimneys, AC units, vents) classified as obstacles.
4. **Geometric Placement**:
   - Rotates candidate panels along roof azimuth.
   - Enforces a 0.5m setback buffer from roof boundaries.
   - Excludes obstacle bounding boxes.
   - Computes total installed kWp and estimated annual kWh yield.

### C. Live IoT Telemetry Pipeline
1. **Mokxi ESP32 Simulation**: A virtual ESP32 DevKit V1 acquires analog voltage on GPIO 34 across a simulated 6V 1W panel with voltage divider (R1=10k, R2=20k).
2. **Packet Transmission**: The ESP32 builds an HTTP JSON payload:
   ```json
   {
     "device_id": "esp32-solar-01",
     "voltage_v": 5.82,
     "current_ma": 163.4,
     "power_w": 0.951,
     "timestamp": "2026-11-22T08:00:00Z"
   }
   ```
3. **Security Ingestion**: Transmitted with header `X-API-KEY`. Cloudflare Tunnel terminates SSL and routes to Gateway (`:8002`), which verifies the key and commits the metric to `solar_iot.db`.
4. **Frontend Reflection**: The Monitoring screen polls every 1000ms to display instantaneous wattage, daily cumulative yield, and predictive alerts.
