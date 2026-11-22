import os
import json
import requests
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("GOOGLE_SOLAR_API_KEY")

if not API_KEY:
    raise RuntimeError("Cle API manquante dans .env")

# Coordonnees officielles de test Google (Californie)
latitude = 37.4450
longitude = -122.1390

url = "https://solar.googleapis.com/v1/buildingInsights:findClosest"

params = {
    "location.latitude": latitude,
    "location.longitude": longitude,
    "requiredQuality": "HIGH",
    "key": API_KEY
}

print("Analyse de la toiture en cours...")

response = requests.get(url, params=params, timeout=60)

print("HTTP Status:", response.status_code)

data = response.json()

if response.status_code != 200:
    print(json.dumps(data, indent=2, ensure_ascii=False))
    exit()

with open("solar_result.json", "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

solar = data.get("solarPotential", {})

print("\n===== GOOGLE SOLAR API =====")
print("Pays :", data.get("regionCode"))
print("Qualite :", data.get("imageryQuality"))
print("Surface toiture :", solar.get(
    "wholeRoofStats", {}
).get("areaMeters2"), "m2")

print("Nombre maximal de panneaux :",
      solar.get("maxArrayPanelsCount"))

print("Puissance unitaire :",
      solar.get("panelCapacityWatts"), "W")

print("Dimensions panneau :",
      solar.get("panelHeightMeters"), "x",
      solar.get("panelWidthMeters"), "m")

print("\n===== CONFIGURATIONS =====")

for config in solar.get("solarPanelConfigs", [])[:10]:
    print(
        config["panelsCount"], "panneaux |",
        round(config["yearlyEnergyDcKwh"], 2),
        "kWh DC/an"
    )

print("\n===== POSITIONS DES PANNEAUX =====")

for i, panel in enumerate(solar.get("solarPanels", [])[:6]):
    print(f"Panneau {i+1} :", panel)

print("\nResultat complet : solar_result.json")