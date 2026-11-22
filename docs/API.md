# REST API Documentation — Smart Solar

Smart Solar exposes unified FastAPI services across dedicated ports. All endpoints support standard JSON serialization, CORS, and comprehensive validation via Pydantic models.

Interactive Swagger UI documentation is available locally for each service:
- **Core Backend**: [http://localhost:8003/docs](http://localhost:8003/docs)
- **SAM AI Microservice**: [http://localhost:8004/docs](http://localhost:8004/docs)
- **IoT Telemetry Core**: [http://localhost:8001/docs](http://localhost:8001/docs)
- **IoT Secure Gateway**: [http://localhost:8002/docs](http://localhost:8002/docs)

---

## 1. Core Backend (Port 8003)

### `GET /api/health`
Checks backend readiness and loaded service integrations.
- **Response `200 OK`**:
  ```json
  {
    "status": "healthy",
    "version": "1.0.0",
    "services": {
      "gemini_ai": true,
      "pvgis": true,
      "open_meteo": true,
      "ocr": true
    }
  }
  ```

---

### `GET /api/chat/status`
Returns the status, provider, active model, and capabilities of the conversational agent.
- **Response `200 OK`**:
  ```json
  {
    "provider": "Google Gemini API",
    "model": "gemini-3.5-flash",
    "base_url": "https://generativelanguage.googleapis.com/v1beta",
    "api_key_configured": true,
    "ready": true,
    "modalities": ["text", "image", "pdf"],
    "max_tokens": 2048,
    "streaming_supported": true
  }
  ```

---

### `POST /api/chat`
Dispatches multimodal queries to Google Gemini with injected solar, weather, and IoT context.
- **Request Body**:
  ```json
  {
    "messages": [
      { "role": "user", "content": "Kadeh nesta3mel énergie hedha chhar ?" }
    ],
    "context": {
      "city": "Tunis",
      "monthly_target_kwh": 1200,
      "current_consumption_kwh": 900,
      "day_of_month": 15
    }
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "reply": "Aslema bik! Hassab el données en direct mte3ek: Consommit 900 kWh men l'objectif mte3ek (1200 kWh) fi nhar 15/30...",
    "model": "gemini-3.5-flash",
    "solar_card": null
  }
  ```

---

### `POST /api/chat/stream`
Streams conversational tokens in real time via Server-Sent Events (SSE).
- **Headers**: `Accept: text/event-stream`
- **Output Stream**:
  ```
  data: {"chunk": "Aslema"}
  data: {"chunk": " bik!"}
  data: [DONE]
  ```

---

### `POST /api/solar/sizing`
Calculates optimal photovoltaic capacity, number of panels, annual production, and financial savings.
- **Request Body**:
  ```json
  {
    "monthly_bill_tnd": 250.0,
    "available_area_m2": 60.0,
    "city": "Tunis",
    "roof_type": "flat",
    "tilt_deg": 30.0,
    "azimuth_deg": 180.0
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "recommended_kwp": 5.4,
    "panel_count": 12,
    "annual_production_kwh": 8640.0,
    "annual_savings_tnd": 2850.0,
    "payback_years": 4.8,
    "co2_saved_tons_year": 4.1
  }
  ```

---

### `POST /api/ocr/bill`
Performs OCR on an uploaded STEG electricity invoice image or PDF.
- **Request**: Multipart Form Data (`file: UploadFile`)
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "consumption_kwh": 850.0,
    "amount_ttc_tnd": 297.500,
    "meter_ref": "481023",
    "period_days": 60,
    "confidence": 0.94
  }
  ```

---

## 2. SAM AI Microservice (Port 8004)

### `GET /health`
Returns GPU device information, CUDA availability, and loaded model weights.
- **Response `200 OK`**:
  ```json
  {
    "status": "healthy",
    "service": "SAM AI ViT-B Microservice",
    "device": "cuda",
    "gpu_name": "NVIDIA GeForce RTX",
    "model_loaded": true
  }
  ```

---

### `POST /roof/segment`
Generates binary segmentation masks for an uploaded rooftop image using Meta SAM ViT-B.
- **Request Body**:
  ```json
  {
    "image_base64": "/9j/4AAQSkZJRg...",
    "points_per_side": 32,
    "pred_iou_thresh": 0.88,
    "stability_score_thresh": 0.95
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "masks_count": 26,
    "inference_time_sec": 4.94,
    "roof_candidate_polygon": [[120, 80], [450, 85], [440, 390], [115, 385]],
    "obstacles": [
      { "type": "chimney", "bbox": [180, 140, 210, 170] }
    ]
  }
  ```

---

### `POST /roof/plan`
Places solar panels inside the designated safe roof zone while avoiding detected obstacles.
- **Request Body**:
  ```json
  {
    "roof_polygon": [[120, 80], [450, 85], [440, 390], [115, 385]],
    "obstacles": [{"bbox": [180, 140, 210, 170]}],
    "panel_width_m": 1.75,
    "panel_height_m": 1.05,
    "margin_m": 0.5
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "placed_panels": 18,
    "installed_capacity_kwp": 7.2,
    "total_area_m2": 33.075,
    "collision_free": true
  }
  ```

---

## 3. IoT Subsystem (Ports 8001 & 8002)

### `POST /api/iot/measurements` (Port 8002 Gateway)
Ingests encrypted telemetry from the ESP32 firmware.
- **Headers**: `X-API-KEY: <secure-token>`
- **Request Body**:
  ```json
  {
    "device_id": "esp32-solar-01",
    "voltage_v": 5.82,
    "current_ma": 163.4,
    "power_w": 0.951,
    "timestamp": "2026-11-22T08:00:00Z"
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "status": "accepted",
    "forwarded_to": "iot_backend_8001",
    "measurement_id": 4821
  }
  ```

---

### `GET /api/iot/measurements/latest` (Port 8001)
Returns the most recent physical or simulated metric for live dashboard updates.
- **Response `200 OK`**:
  ```json
  {
    "device_id": "esp32-solar-01",
    "voltage_v": 5.82,
    "current_ma": 163.4,
    "power_w": 0.951,
    "daily_yield_wh": 4.12,
    "status": "online",
    "last_seen_sec_ago": 0.8
  }
  ```
