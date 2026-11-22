
import json
import random
from datetime import date, timedelta
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
OUTPUT = BASE_DIR / "monthly_data.json"

PANEL_COUNT = 6
PANEL_POWER_KW = 0.55
SYSTEM_POWER_KW = PANEL_COUNT * PANEL_POWER_KW

DAYS = 30
THRESHOLD = 80

random.seed(42)

daily_data = []

start_date = date.today() - timedelta(days=DAYS)

for i in range(DAYS):

    day = start_date + timedelta(days=i)

    # Ensoleillement journalier simule
    sun_hours = random.uniform(3.5, 6.0)

    # Estimation avec pertes normales
    expected = round(
        SYSTEM_POWER_KW * sun_hours * 0.8, 2
    )

    # Sous-performance a partir du jour 16
    if i < 15:
        factor = random.uniform(0.92, 1.0)
    else:
        factor = random.uniform(0.35, 0.50)

    actual = round(expected * factor, 2)

    performance = round(actual / expected * 100, 2)

    daily_data.append({
        "date": day.isoformat(),
        "sun_hours": round(sun_hours, 2),
        "expected_energy_kwh": expected,
        "actual_energy_kwh": actual,
        "performance_pct": performance,
        "energy_loss_kwh": round(expected - actual, 2),
        "alert": performance < THRESHOLD
    })

total_expected = round(
    sum(d["expected_energy_kwh"] for d in daily_data), 2
)

total_actual = round(
    sum(d["actual_energy_kwh"] for d in daily_data), 2
)

total_loss = round(total_expected - total_actual, 2)

performance = round(
    total_actual / total_expected * 100, 2
)

consecutive_anomalies = 0

for day in reversed(daily_data):
    if day["alert"]:
        consecutive_anomalies += 1
    else:
        break

maintenance_alert = consecutive_anomalies >= 3

result = {
    "device_id": "SOLAR-001",
    "source": "simulation",
    "panel_count": PANEL_COUNT,
    "installed_power_kw": SYSTEM_POWER_KW,
    "period_start": daily_data[0]["date"],
    "period_end": daily_data[-1]["date"],
    "period_days": DAYS,
    "expected_energy_kwh": total_expected,
    "actual_energy_kwh": total_actual,
    "energy_loss_kwh": total_loss,
    "performance_pct": performance,
    "anomaly_days": sum(d["alert"] for d in daily_data),
    "consecutive_anomaly_days": consecutive_anomalies,
    "maintenance_alert": maintenance_alert,
    "message": (
        "Sous-performance persistante. Maintenance recommandee."
        if maintenance_alert
        else "Installation normale."
    ),
    "daily_measurements": daily_data
}

with open(OUTPUT, "w", encoding="utf-8") as file:
    json.dump(result, file, indent=4)

print("=" * 50)
print("SMART SOLAR - BILAN 30 JOURS")
print("=" * 50)
print("Nombre de panneaux :", PANEL_COUNT)
print("Puissance installee :", SYSTEM_POWER_KW, "kWc")
print("Production attendue :", total_expected, "kWh")
print("Production simulee  :", total_actual, "kWh")
print("Energie manquante   :", total_loss, "kWh")
print("Performance         :", performance, "%")
print("Jours en anomalie   :", result["anomaly_days"])
print("Anomalies consecutives :", consecutive_anomalies)
print("Alerte maintenance  :", maintenance_alert)
print("Message :", result["message"])
print("Fichier :", OUTPUT)
