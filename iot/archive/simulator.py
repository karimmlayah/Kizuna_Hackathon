
import time
import json
import random
import sys
from pathlib import Path
from datetime import datetime

BASE_DIR = Path(__file__).resolve().parent

sys.path.insert(0, str(BASE_DIR.parent / "database"))

from storage import init_db, save_measurement

init_db()

DATA_FILE = BASE_DIR / "latest_data.json"
EXPECTED_ENERGY = 1200
ALERT_THRESHOLD = 80


def generate_data(actual_energy):
    performance = actual_energy / EXPECTED_ENERGY * 100
    loss = max(0, EXPECTED_ENERGY - actual_energy)

    return {
        "device_id": "SOLAR-001",
        "timestamp": datetime.now().isoformat(),
        "source": "simulation",
        "panel_count": 6,
        "expected_energy_kwh": EXPECTED_ENERGY,
        "actual_energy_kwh": actual_energy,
        "performance_pct": round(performance, 2),
        "energy_loss_kwh": round(loss, 2),
        "alert": performance < ALERT_THRESHOLD,
        "status": (
            "UNDERPERFORMANCE"
            if performance < ALERT_THRESHOLD
            else "NORMAL"
        )
    }


print("SMART SOLAR IoT SIMULATOR V2")
print("SQLite : CONNECTED")
print("1 - Production normale")
print("2 - Sous-performance")
print("3 - Simulation automatique")

mode = input("Choisir le mode : ")

try:
    while True:

        if mode == "1":
            actual = random.uniform(1100, 1200)

        elif mode == "2":
            actual = random.uniform(450, 550)

        else:
            actual = random.uniform(450, 1200)

        data = generate_data(round(actual, 2))

        # Sauvegarde SQLite
        save_measurement(data)

        # Mise a jour JSON
        temp_file = DATA_FILE.with_suffix(".tmp")

        with open(temp_file, "w") as file:
            json.dump(data, file, indent=4)

        temp_file.replace(DATA_FILE)

        print(json.dumps(data, indent=4))
        print("SQLite : mesure enregistree")

        if data["alert"]:
            print("ALERTE : Sous-performance solaire !")
            print("Verification technique recommandee.")
        else:
            print("Production normale.")

        print("--------------------------------")
        time.sleep(3)

except KeyboardInterrupt:
    print("Simulation arretee.")
