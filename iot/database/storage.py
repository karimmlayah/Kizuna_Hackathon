
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent / "solar_iot.db"


def init_db():
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS measurements (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                device_id TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                source TEXT NOT NULL,
                panel_count INTEGER,
                expected_energy_kwh REAL,
                actual_energy_kwh REAL,
                performance_pct REAL,
                energy_loss_kwh REAL,
                alert INTEGER,
                status TEXT,
                UNIQUE(device_id, timestamp)
            )
        """)


def save_measurement(data):
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("""
            INSERT OR IGNORE INTO measurements (
                device_id,
                timestamp,
                source,
                panel_count,
                expected_energy_kwh,
                actual_energy_kwh,
                performance_pct,
                energy_loss_kwh,
                alert,
                status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            data["device_id"],
            data["timestamp"],
            data["source"],
            data["panel_count"],
            data["expected_energy_kwh"],
            data["actual_energy_kwh"],
            data["performance_pct"],
            data["energy_loss_kwh"],
            int(data["alert"]),
            data["status"]
        ))


def get_history(limit=100):
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row

        rows = conn.execute("""
            SELECT * FROM measurements
            ORDER BY id DESC
            LIMIT ?
        """, (limit,)).fetchall()

        return [dict(row) for row in rows]


if __name__ == "__main__":
    init_db()
    print("SQLite database initialized successfully")
    print(DB_PATH)
