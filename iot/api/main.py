
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
import json
import sys
import os
import secrets

# Configuration des dossiers
BASE_DIR = Path(__file__).resolve().parent.parent

DATA_FILE = BASE_DIR / "simulation" / "latest_data.json"

sys.path.insert(0, str(BASE_DIR / "database"))

from storage import init_db, get_history

# Initialisation SQLite
init_db()

# Initialisation FastAPI
app = FastAPI(
    title="Smart Solar IoT API",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"]
)


# Lecture des dernieres donnees
def read_data():
    if not DATA_FILE.exists():
        raise HTTPException(
            status_code=404,
            detail="Aucune donnee IoT disponible"
        )

    try:
        with open(DATA_FILE, "r") as file:
            return json.load(file)

    except (OSError, json.JSONDecodeError):
        raise HTTPException(
            status_code=503,
            detail="Donnees temporairement indisponibles"
        )


# Etat du serveur
@app.get("/health")
@app.get("/")
def home():
    return {
        "status": "ok",
        "service": "Smart Solar IoT",
        "version": "2.0.0",
        "port": 8001,
        "database": "SQLite"
    }


# Dernieres donnees
@app.get("/api/iot/latest")
def latest_data():
    return read_data()


# Performance energetique
@app.get("/api/iot/performance")
def performance():
    data = read_data()

    return {
        "expected_energy_kwh": data["expected_energy_kwh"],
        "actual_energy_kwh": data["actual_energy_kwh"],
        "performance_pct": data["performance_pct"],
        "energy_loss_kwh": data["energy_loss_kwh"],
        "source": data["source"],
        "timestamp": data["timestamp"]
    }


# Alertes
@app.get("/api/iot/alerts")
def alerts():
    data = read_data()

    return {
        "device_id": data["device_id"],
        "alert": data["alert"],
        "status": data["status"],
        "timestamp": data["timestamp"],
        "message": (
            "Sous-performance solaire. Verification recommandee."
            if data["alert"]
            else "Production normale."
        )
    }


# Historique SQLite
@app.get("/api/iot/history")
def history(limit: int = 100):
    limit = max(1, min(limit, 1000))

    data = get_history(limit)

    return {
        "count": len(data),
        "measurements": data
    }


# Statistiques
@app.get("/api/iot/statistics")
def statistics():
    data = get_history(1000)

    if not data:
        return {"count": 0}

    count = len(data)

    anomalies = sum(
        1 for row in data if row["alert"]
    )

    return {
        "count": count,
        "normal_count": count - anomalies,
        "anomaly_count": anomalies,

        "average_performance_pct": round(
            sum(row["performance_pct"] for row in data)
            / count, 2
        ),

        "average_expected_kwh": round(
            sum(row["expected_energy_kwh"] for row in data)
            / count, 2
        ),

        "average_actual_kwh": round(
            sum(row["actual_energy_kwh"] for row in data)
            / count, 2
        )
    }
MONTHLY_FILE = BASE_DIR / "simulation" / "monthly_data.json"


@app.get("/api/iot/monthly")
def monthly_report():
    if not MONTHLY_FILE.exists():
        raise HTTPException(
            status_code=404,
            detail="Bilan mensuel non disponible"
        )

    try:
        with open(MONTHLY_FILE, "r", encoding="utf-8") as file:
            return json.load(file)

    except (OSError, json.JSONDecodeError):
        raise HTTPException(
            status_code=503,
            detail="Bilan mensuel indisponible"
        )

from pydantic import BaseModel, Field
from datetime import datetime, timezone
import sqlite3


class SolarMeasurement(BaseModel):
    device_id: str = "SOLAR-MOKXI-001"
    voltage_v: float = Field(ge=0, le=10)
    api_key: str


MOKXI_DB = BASE_DIR / "database" / "mokxi_iot.db"

with sqlite3.connect(MOKXI_DB) as conn:
    conn.execute("""
        CREATE TABLE IF NOT EXISTS solar_measurements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            device_id TEXT,
            timestamp TEXT,
            voltage_v REAL,
            current_ma REAL,
            power_w REAL,
            source TEXT
        )
    """)


@app.post("/api/iot/measurements")
def receive_measurement(data: SolarMeasurement):
    key = os.environ.get("SOLAR_API_KEY")
    if not key:
        key_file = BASE_DIR / "api_key.local.txt"
        if key_file.exists():
            key = key_file.read_text().strip()

    if not key or not secrets.compare_digest(
        data.api_key, key
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid API key"
        )

    voltage = data.voltage_v
    current = voltage / 36.0
    power = voltage * current

    measurement = {
        "device_id": data.device_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "voltage_v": round(voltage, 3),
        "current_ma": round(current * 1000, 3),
        "power_w": round(power, 4),
        "source": (
    		"mokxi_esp32"
    		if data.device_id == "SOLAR-MOKXI-001"
    		else "manual_test"
	)
    }

    with sqlite3.connect(MOKXI_DB) as conn:
        conn.execute("""
            INSERT INTO solar_measurements (
                device_id, timestamp, voltage_v,
                current_ma, power_w, source
            ) VALUES (?, ?, ?, ?, ?, ?)
        """, tuple(measurement.values()))

    return {
        "success": True,
        "measurement": measurement
    }


@app.get("/api/iot/mokxi/latest")
def mokxi_latest():

    with sqlite3.connect(MOKXI_DB) as conn:
        conn.row_factory = sqlite3.Row

        row = conn.execute("""
            SELECT * FROM solar_measurements
            ORDER BY id DESC LIMIT 1
        """).fetchone()

    if row is None:
        raise HTTPException(
            status_code=404,
            detail="Aucune mesure recue"
        )

    return dict(row)


@app.get("/api/iot/mokxi/history")
def mokxi_history(limit: int = 100):

    limit = max(1, min(limit, 1000))

    with sqlite3.connect(MOKXI_DB) as conn:
        conn.row_factory = sqlite3.Row

        rows = conn.execute("""
            SELECT * FROM solar_measurements
            ORDER BY id DESC LIMIT ?
        """, (limit,)).fetchall()

    return {
        "count": len(rows),
        "measurements": [dict(row) for row in rows]
    }
