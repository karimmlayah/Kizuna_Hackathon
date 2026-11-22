"""Smart Solar IoT Service — Real-Time Energy Monitoring & Smart Prediction Engine.

Interfaces with:
- Mokxi electronic simulation & ESP32 DevKit V1 (via port 8001/8002 & mokxi_iot.db)
- Real SQLite time-series storage
- Trapezoidal power-to-energy integration with genuine timestamps (Africa/Tunis)
- Deterministic Smart Consumption Prediction Engine
- Multilevel Smart Alerts System (Green, Orange, Red)
- Solar AI Tools for Gemini
"""
from __future__ import annotations
import calendar
import json
import logging
import math
import os
import sqlite3
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any, Optional
import zoneinfo

logger = logging.getLogger("iot_service")

BASE_DIR = Path(__file__).resolve().parent.parent.parent
IOT_DIR = BASE_DIR / "iot"
MOKXI_DB_PATH = IOT_DIR / "database" / "mokxi_iot.db"
SOLAR_IOT_DB_PATH = IOT_DIR / "database" / "solar_iot.db"
try:
    import zoneinfo
    TUNIS_TZ = zoneinfo.ZoneInfo("Africa/Tunis")
except Exception:
    TUNIS_TZ = timezone(timedelta(hours=1), "Africa/Tunis")

# ─────────────────────────────────────────────────────────────────────────────
# 1. Database Initialization & Alert Storage
# ─────────────────────────────────────────────────────────────────────────────
def get_db_connection() -> sqlite3.Connection:
    """Returns a connection to the primary Mokxi IoT database with row factory."""
    MOKXI_DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(MOKXI_DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def init_iot_tables():
    """Ensure all required IoT and alert tables exist."""
    with get_db_connection() as conn:
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
        conn.execute("""
            CREATE TABLE IF NOT EXISTS iot_user_objectives (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT DEFAULT 'default',
                monthly_consumption_target_kwh REAL DEFAULT 1200.0,
                monthly_budget_tnd REAL DEFAULT 350.0,
                monthly_solar_target_kwh REAL DEFAULT 380.0,
                reduction_target_pct REAL DEFAULT 15.0,
                updated_at TEXT
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS iot_alerts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT,
                level TEXT, -- 'green', 'orange', 'red'
                type TEXT,  -- 'overrun_risk', 'overrun_exceeded', 'disconnection', 'weather_drop', 'target_reached'
                title TEXT,
                message TEXT,
                is_read INTEGER DEFAULT 0
            )
        """)
        # Initialize default objectives if empty
        row = conn.execute("SELECT id FROM iot_user_objectives WHERE user_id = 'default'").fetchone()
        if not row:
            conn.execute("""
                INSERT INTO iot_user_objectives (user_id, monthly_consumption_target_kwh, monthly_budget_tnd, monthly_solar_target_kwh, reduction_target_pct, updated_at)
                VALUES ('default', 1200.0, 350.0, 380.0, 15.0, ?)
            """, (datetime.now(timezone.utc).isoformat(),))

init_iot_tables()


# ─────────────────────────────────────────────────────────────────────────────
# 2. Live Data Acquisition & Status Check
# ─────────────────────────────────────────────────────────────────────────────
def get_live_energy_data() -> dict[str, Any]:
    """
    Retrieve instantaneous readings, connection health, and cumulative energy.
    Does NOT invent values if the ESP32 is offline.
    """
    with get_db_connection() as conn:
        row = conn.execute("""
            SELECT * FROM solar_measurements
            ORDER BY id DESC LIMIT 1
        """).fetchone()

        # Cumulative energy integration from all raw records
        rows = conn.execute("""
            SELECT timestamp, power_w FROM solar_measurements
            ORDER BY id ASC
        """).fetchall()

    if not row:
        return {
            "status": "waiting_first_measurement",
            "connected": False,
            "badge": "Simulation Mokxi",
            "device_id": "SOLAR-MOKXI-001",
            "voltage_v": 0.0,
            "current_a": 0.0,
            "current_ma": 0.0,
            "power_w": 0.0,
            "cumulative_energy_wh": 0.0,
            "cumulative_energy_kwh": 0.0,
            "timestamp": None,
            "age_seconds": None,
            "message": "En attente du premier paquet de mesure ESP32 depuis Mokxi."
        }

    # Timestamp age check
    raw_ts = row["timestamp"]
    now_utc = datetime.now(timezone.utc)
    try:
        dt_record = datetime.fromisoformat(raw_ts)
        if dt_record.tzinfo is None:
            dt_record = dt_record.replace(tzinfo=timezone.utc)
        age_seconds = max(0.0, round((now_utc - dt_record).total_seconds(), 1))
    except Exception:
        age_seconds = 999.0

    # Status classification:
    # < 15s : Active / Connected
    # 15s - 60s : Stale
    # > 60s : Disconnected
    if age_seconds < 15.0:
        connection_status = "connected"
    elif age_seconds <= 60.0:
        connection_status = "stale"
    else:
        connection_status = "disconnected"

    # Precise Trapezoidal Integration for cumulative energy
    cum_wh = integrate_energy_wh(rows)

    voltage_v = float(row["voltage_v"])
    current_ma = float(row["current_ma"])
    current_a = round(current_ma / 1000.0, 4)
    power_w = float(row["power_w"])
    source = row["source"] or "mokxi_esp32"

    badge = "Simulation Mokxi" if "mokxi" in source.lower() else "Installation physique"

    return {
        "status": connection_status,
        "connected": connection_status == "connected",
        "badge": badge,
        "device_id": row["device_id"],
        "voltage_v": round(voltage_v, 3),
        "current_a": current_a,
        "current_ma": round(current_ma, 2),
        "power_w": round(power_w, 4),
        "cumulative_energy_wh": round(cum_wh, 2),
        "cumulative_energy_kwh": round(cum_wh / 1000.0, 5),
        "timestamp": raw_ts,
        "timestamp_tunis": dt_record.astimezone(TUNIS_TZ).strftime("%Y-%m-%d %H:%M:%S") if 'dt_record' in locals() else raw_ts,
        "age_seconds": age_seconds,
    }


# ─────────────────────────────────────────────────────────────────────────────
# 3. Trapezoidal Energy Integration with Interruption Management
# ─────────────────────────────────────────────────────────────────────────────
def integrate_energy_wh(rows: list[Any], max_gap_seconds: float = 60.0) -> float:
    """
    Computes total energy in Watt-hours (Wh) via trapezoidal integration over time:
    E = sum( (P_{i-1} + P_i) / 2 * delta_t_hours )
    
    If delta_t > max_gap_seconds (interruption, night, simulation stopped),
    the gap is not integrated (zero extrapolation during disconnections).
    """
    if len(rows) < 2:
        return 0.0

    total_wh = 0.0
    prev_dt: Optional[datetime] = None
    prev_p: float = 0.0

    for r in rows:
        ts_str = r["timestamp"]
        p = float(r["power_w"] or 0.0)
        try:
            dt = datetime.fromisoformat(ts_str)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
        except Exception:
            continue

        if prev_dt is not None:
            delta_s = (dt - prev_dt).total_seconds()
            if 0 < delta_s <= max_gap_seconds:
                # Trapezoidal slice
                avg_p = (prev_p + p) / 2.0
                slice_wh = avg_p * (delta_s / 3600.0)
                total_wh += slice_wh
            # Gaps > max_gap_seconds are treated as downtime / connection pause

        prev_dt = dt
        prev_p = p

    return total_wh


# ─────────────────────────────────────────────────────────────────────────────
# 4. Energy History & Aggregations (Timezone: Africa/Tunis)
# ─────────────────────────────────────────────────────────────────────────────
def get_energy_history(
    range_type: str = "minute",
    limit: int = 60
) -> dict[str, Any]:
    """
    Returns time-series measurements aggregated by:
    - 'second' : raw individual points
    - 'minute' : 1-minute grouped averages and energy Wh
    - 'hour'   : 1-hour grouped averages and energy Wh
    - 'day'    : 1-day grouped totals and energy kWh
    - 'month'  : monthly totals
    """
    with get_db_connection() as conn:
        rows = conn.execute("""
            SELECT id, device_id, timestamp, voltage_v, current_ma, power_w, source
            FROM solar_measurements
            ORDER BY id DESC LIMIT 1000
        """).fetchall()

    if not rows:
        return {"range": range_type, "count": 0, "points": [], "summary": {}}

    # Convert to chronological order
    data = list(reversed([dict(r) for r in rows]))

    if range_type == "second":
        points = []
        for d in data[-limit:]:
            try:
                dt = datetime.fromisoformat(d["timestamp"]).astimezone(TUNIS_TZ)
                lbl = dt.strftime("%H:%M:%S")
            except Exception:
                lbl = d["timestamp"][-8:]
            points.append({
                "time": lbl,
                "voltage_v": d["voltage_v"],
                "current_ma": d["current_ma"],
                "power_w": d["power_w"],
            })
        return {
            "range": "second",
            "count": len(points),
            "points": points,
            "summary": {
                "avg_power_w": round(sum(p["power_w"] for p in points) / len(points), 3) if points else 0,
                "peak_power_w": round(max((p["power_w"] for p in points), default=0), 3),
            }
        }

    # Group by buckets in Africa/Tunis
    buckets: dict[str, list[dict[str, Any]]] = {}
    for d in data:
        try:
            dt = datetime.fromisoformat(d["timestamp"]).astimezone(TUNIS_TZ)
        except Exception:
            continue

        if range_type == "minute":
            key = dt.strftime("%H:%M")
        elif range_type == "hour":
            key = dt.strftime("%Y-%m-%d %H:00")
        elif range_type == "day":
            key = dt.strftime("%Y-%m-%d")
        elif range_type == "month":
            key = dt.strftime("%Y-%m")
        else:
            key = dt.strftime("%H:%M")

        if key not in buckets:
            buckets[key] = []
        buckets[key].append(d)

    # Compute aggregation per bucket
    points = []
    keys = list(buckets.keys())[-limit:]
    for k in keys:
        b_rows = buckets[k]
        avg_v = round(sum(r["voltage_v"] for r in b_rows) / len(b_rows), 3)
        avg_i = round(sum(r["current_ma"] for r in b_rows) / len(b_rows), 2)
        avg_p = round(sum(r["power_w"] for r in b_rows) / len(b_rows), 4)
        max_p = round(max(r["power_w"] for r in b_rows), 4)
        b_wh = round(integrate_energy_wh(b_rows), 3)

        points.append({
            "bucket": k,
            "avg_voltage_v": avg_v,
            "avg_current_ma": avg_i,
            "avg_power_w": avg_p,
            "peak_power_w": max_p,
            "energy_wh": b_wh,
            "energy_kwh": round(b_wh / 1000.0, 5),
            "sample_count": len(b_rows)
        })

    total_wh = sum(p["energy_wh"] for p in points)
    peak_p = max((p["peak_power_w"] for p in points), default=0)
    avg_p_overall = round(sum(p["avg_power_w"] for p in points) / len(points), 4) if points else 0

    return {
        "range": range_type,
        "count": len(points),
        "points": points,
        "summary": {
            "total_energy_wh": round(total_wh, 2),
            "total_energy_kwh": round(total_wh / 1000.0, 4),
            "average_power_w": avg_p_overall,
            "peak_power_w": peak_p,
            "timezone": "Africa/Tunis"
        }
    }


# ─────────────────────────────────────────────────────────────────────────────
# 5. Smart Prediction Engine (Deterministic & Proactive)
# ─────────────────────────────────────────────────────────────────────────────
def calculate_consumption_prediction(
    monthly_target_kwh: float = 1200.0,
    current_consumption_kwh: float = 900.0,
    current_day: Optional[int] = None,
    total_days_in_month: Optional[int] = None
) -> dict[str, Any]:
    """
    Deterministic Smart Consumption Prediction Engine.
    
    Formula:
    - Daily average = current_consumption / current_day
    - Forecast month end = daily_average * total_days
    - Expected overrun = forecast_month_end - monthly_target
    - Remaining allowed energy = max(0, monthly_target - current_consumption)
    - Max remaining daily consumption = remaining_allowed / remaining_days
    - Required reduction = (1 - max_remaining_daily / current_daily_avg) * 100
    
    Mandatory Test Case Spec Verification:
    Target = 1200 kWh, Current = 900 kWh, Day = 15, Total days = 30
    -> 75% consumed
    -> Daily avg = 60 kWh/day
    -> Forecast end = 1800 kWh
    -> Overrun = +600 kWh
    -> Remaining allowed = 300 kWh
    -> Remaining daily max = 20 kWh/day
    -> Required daily reduction = ~66.7%
    -> Proactive Alert Triggered!
    """
    # Use real month days and today's day if not provided
    now_tunis = datetime.now(TUNIS_TZ)
    if total_days_in_month is None or total_days_in_month <= 0:
        _, num_days = calendar.monthrange(now_tunis.year, now_tunis.month)
        total_days_in_month = num_days

    if current_day is None or current_day <= 0:
        current_day = min(total_days_in_month, max(1, now_tunis.day))

    current_day = min(total_days_in_month, max(1, current_day))
    remaining_days = max(1, total_days_in_month - current_day)

    # 1. Percentage of target already consumed
    consumed_pct = round((current_consumption_kwh / monthly_target_kwh) * 100.0, 1)

    # 2. Daily average consumption so far
    daily_avg_kwh = round(current_consumption_kwh / float(current_day), 2)

    # 3. Linear month-end forecast
    forecast_month_end_kwh = round(daily_avg_kwh * float(total_days_in_month), 1)

    # 4. Overrun prediction
    forecast_overrun_kwh = round(forecast_month_end_kwh - monthly_target_kwh, 1)
    is_overrun_risk = forecast_overrun_kwh > 0

    # 5. Remaining allowed energy
    remaining_allowed_kwh = max(0.0, round(monthly_target_kwh - current_consumption_kwh, 1))

    # 6. Max daily allowed for the remaining days
    if remaining_allowed_kwh > 0:
        max_remaining_daily_kwh = round(remaining_allowed_kwh / float(remaining_days), 2)
    else:
        max_remaining_daily_kwh = 0.0

    # 7. Required daily reduction percentage to stay within goal
    if daily_avg_kwh > 0:
        if daily_avg_kwh > max_remaining_daily_kwh:
            reduction_req_pct = round(((daily_avg_kwh - max_remaining_daily_kwh) / daily_avg_kwh) * 100.0, 1)
        else:
            reduction_req_pct = 0.0
    else:
        reduction_req_pct = 0.0

    # 8. Alert determination (Green, Orange, Red)
    if current_consumption_kwh >= monthly_target_kwh:
        alert_level = "red"
        alert_title = "Objectif mensuel de consommation dépassé"
        alert_message = (
            f"Vous avez atteint {current_consumption_kwh} kWh sur votre limite de {monthly_target_kwh} kWh "
            f"({consumed_pct}%). Risque de passage dans la tranche STEG supérieure."
        )
    elif is_overrun_risk:
        alert_level = "orange"
        alert_title = "Alerte préventive : Risque de dépassement d'objectif"
        alert_message = (
            f"Au rythme actuel ({daily_avg_kwh} kWh/jour), vous consommerez {forecast_month_end_kwh} kWh à la fin du mois, "
            f"soit un dépassement prévu de {forecast_overrun_kwh} kWh. "
            f"Pour respecter votre objectif de {monthly_target_kwh} kWh, limitez votre consommation à {max_remaining_daily_kwh} kWh/jour "
            f"(réduction de {reduction_req_pct}% requise)."
        )
    else:
        alert_level = "green"
        alert_title = "Consommation maîtrisée"
        alert_message = (
            f"Rythme idéal ({daily_avg_kwh} kWh/jour). Prévision de {forecast_month_end_kwh} kWh pour un objectif de {monthly_target_kwh} kWh."
        )

    return {
        "monthly_target_kwh": monthly_target_kwh,
        "current_consumption_kwh": current_consumption_kwh,
        "current_day": current_day,
        "total_days_in_month": total_days_in_month,
        "remaining_days": remaining_days,
        "consumed_pct": consumed_pct,
        "daily_avg_kwh": daily_avg_kwh,
        "forecast_month_end_kwh": forecast_month_end_kwh,
        "forecast_overrun_kwh": forecast_overrun_kwh,
        "remaining_allowed_kwh": remaining_allowed_kwh,
        "max_remaining_daily_kwh": max_remaining_daily_kwh,
        "reduction_req_pct": reduction_req_pct,
        "is_overrun_risk": is_overrun_risk,
        "alert_level": alert_level,
        "alert_title": alert_title,
        "alert_message": alert_message,
    }


# ─────────────────────────────────────────────────────────────────────────────
# 6. Smart Alerts Manager & Objectives Storage
# ─────────────────────────────────────────────────────────────────────────────
def get_user_objectives() -> dict[str, Any]:
    """Retrieve user-configured energy goals."""
    with get_db_connection() as conn:
        row = conn.execute("SELECT * FROM iot_user_objectives WHERE user_id = 'default'").fetchone()
        if row:
            return dict(row)
    return {
        "monthly_consumption_target_kwh": 1200.0,
        "monthly_budget_tnd": 350.0,
        "monthly_solar_target_kwh": 380.0,
        "reduction_target_pct": 15.0,
    }

def update_user_objectives(
    consumption_target_kwh: float,
    budget_tnd: float,
    solar_target_kwh: float,
    reduction_pct: float = 15.0
) -> dict[str, Any]:
    """Save updated energy goals."""
    now_str = datetime.now(timezone.utc).isoformat()
    with get_db_connection() as conn:
        conn.execute("""
            UPDATE iot_user_objectives
            SET monthly_consumption_target_kwh = ?,
                monthly_budget_tnd = ?,
                monthly_solar_target_kwh = ?,
                reduction_target_pct = ?,
                updated_at = ?
            WHERE user_id = 'default'
        """, (consumption_target_kwh, budget_tnd, solar_target_kwh, reduction_pct, now_str))
    return get_user_objectives()

def record_alert(level: str, alert_type: str, title: str, message: str) -> dict[str, Any]:
    """Record an alert if not already logged recently (rate-limit prevention)."""
    now_str = datetime.now(timezone.utc).isoformat()
    with get_db_connection() as conn:
        # Check if an identical alert was recorded in the last 15 minutes
        recent = conn.execute("""
            SELECT id FROM iot_alerts
            WHERE type = ? AND timestamp > datetime('now', '-15 minutes')
            LIMIT 1
        """, (alert_type,)).fetchone()
        if not recent:
            cur = conn.execute("""
                INSERT INTO iot_alerts (timestamp, level, type, title, message, is_read)
                VALUES (?, ?, ?, ?, ?, 0)
            """, (now_str, level, alert_type, title, message))
            return {"id": cur.lastrowid, "created": True}
    return {"created": False}

def get_alerts_history(limit: int = 20) -> list[dict[str, Any]]:
    """Get active and historical smart alerts."""
    with get_db_connection() as conn:
        rows = conn.execute("""
            SELECT * FROM iot_alerts
            ORDER BY id DESC LIMIT ?
        """, (limit,)).fetchall()
        return [dict(r) for r in rows]

def mark_alert_read(alert_id: int):
    """Mark alert as acknowledged."""
    with get_db_connection() as conn:
        conn.execute("UPDATE iot_alerts SET is_read = 1 WHERE id = ?", (alert_id,))
    return {"success": True}
