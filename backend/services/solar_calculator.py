"""Deterministic Solar & Financial Calculator for Smart Solar Tunisia.

All mathematical, physical, and financial calculations are 100% deterministic,
strictly respecting physical coherence:
- Installed power = nb_panels * panel_wattage_w / 1000.
- Annual consumption = (kwh / months) * 12.
- Annual bill = (amount / months) * 12.
- ROI = investment / annual_savings.
- Realistic specific yield per Tunisian region (PVGIS integration + documented fallback).
"""
from __future__ import annotations
import math
import time
import logging
from typing import Any, Optional
import httpx

logger = logging.getLogger("solar_calculator")

# ─────────────────────────────────────────────────────────────────────────────
# 1. Documented Solar Yields & Coordinates per Tunisian Governorate / Region
# Source: ANME / Solar Radiation Atlas of Tunisia / PVGIS-5 SARAH2 dataset.
# Specific yield in kWh / kWp / year (optimal south inclination ~30°-32°).
# ─────────────────────────────────────────────────────────────────────────────
TUNISIAN_REGIONS_SOLAR_DATABASE: dict[str, dict[str, Any]] = {
    "metlaoui": {
        "governorate": "Gafsa",
        "name": "Metlaoui",
        "lat": 34.32,
        "lon": 8.40,
        "specific_yield_kwh_kwp": 1820.0,
        "ghi_kwh_m2_year": 2080.0,
        "optimal_tilt_deg": 31,
    },
    "gafsa": {
        "governorate": "Gafsa",
        "name": "Gafsa",
        "lat": 34.43,
        "lon": 8.79,
        "specific_yield_kwh_kwp": 1810.0,
        "ghi_kwh_m2_year": 2070.0,
        "optimal_tilt_deg": 31,
    },
    "tunis": {
        "governorate": "Tunis",
        "name": "Tunis (Grand Tunis)",
        "lat": 36.80,
        "lon": 10.18,
        "specific_yield_kwh_kwp": 1650.0,
        "ghi_kwh_m2_year": 1860.0,
        "optimal_tilt_deg": 33,
    },
    "ariana": {
        "governorate": "Ariana",
        "name": "Ariana",
        "lat": 36.86,
        "lon": 10.19,
        "specific_yield_kwh_kwp": 1650.0,
        "ghi_kwh_m2_year": 1860.0,
        "optimal_tilt_deg": 33,
    },
    "ben arous": {
        "governorate": "Ben Arous",
        "name": "Ben Arous",
        "lat": 36.75,
        "lon": 10.22,
        "specific_yield_kwh_kwp": 1655.0,
        "ghi_kwh_m2_year": 1865.0,
        "optimal_tilt_deg": 33,
    },
    "manouba": {
        "governorate": "Manouba",
        "name": "Manouba",
        "lat": 36.81,
        "lon": 10.10,
        "specific_yield_kwh_kwp": 1650.0,
        "ghi_kwh_m2_year": 1860.0,
        "optimal_tilt_deg": 33,
    },
    "sousse": {
        "governorate": "Sousse",
        "name": "Sousse (Sahel)",
        "lat": 35.83,
        "lon": 10.64,
        "specific_yield_kwh_kwp": 1680.0,
        "ghi_kwh_m2_year": 1920.0,
        "optimal_tilt_deg": 32,
    },
    "monastir": {
        "governorate": "Monastir",
        "name": "Monastir",
        "lat": 35.77,
        "lon": 10.83,
        "specific_yield_kwh_kwp": 1690.0,
        "ghi_kwh_m2_year": 1930.0,
        "optimal_tilt_deg": 32,
    },
    "mahdia": {
        "governorate": "Mahdia",
        "name": "Mahdia",
        "lat": 35.50,
        "lon": 11.06,
        "specific_yield_kwh_kwp": 1700.0,
        "ghi_kwh_m2_year": 1940.0,
        "optimal_tilt_deg": 32,
    },
    "sfax": {
        "governorate": "Sfax",
        "name": "Sfax",
        "lat": 34.74,
        "lon": 10.76,
        "specific_yield_kwh_kwp": 1720.0,
        "ghi_kwh_m2_year": 1970.0,
        "optimal_tilt_deg": 31,
    },
    "tozeur": {
        "governorate": "Tozeur",
        "name": "Tozeur (Djerid)",
        "lat": 33.92,
        "lon": 8.13,
        "specific_yield_kwh_kwp": 1900.0,
        "ghi_kwh_m2_year": 2180.0,
        "optimal_tilt_deg": 30,
    },
    "kebili": {
        "governorate": "Kebili",
        "name": "Kebili / Douz",
        "lat": 33.70,
        "lon": 8.97,
        "specific_yield_kwh_kwp": 1890.0,
        "ghi_kwh_m2_year": 2160.0,
        "optimal_tilt_deg": 30,
    },
    "gabes": {
        "governorate": "Gabes",
        "name": "Gabes",
        "lat": 33.88,
        "lon": 10.10,
        "specific_yield_kwh_kwp": 1780.0,
        "ghi_kwh_m2_year": 2040.0,
        "optimal_tilt_deg": 31,
    },
    "medenine": {
        "governorate": "Medenine",
        "name": "Medenine / Djerba / Zarzis",
        "lat": 33.35,
        "lon": 10.49,
        "specific_yield_kwh_kwp": 1850.0,
        "ghi_kwh_m2_year": 2120.0,
        "optimal_tilt_deg": 30,
    },
    "tataouine": {
        "governorate": "Tataouine",
        "name": "Tataouine",
        "lat": 32.93,
        "lon": 10.45,
        "specific_yield_kwh_kwp": 1920.0,
        "ghi_kwh_m2_year": 2210.0,
        "optimal_tilt_deg": 29,
    },
    "bizerte": {
        "governorate": "Bizerte",
        "name": "Bizerte",
        "lat": 37.27,
        "lon": 9.87,
        "specific_yield_kwh_kwp": 1600.0,
        "ghi_kwh_m2_year": 1810.0,
        "optimal_tilt_deg": 34,
    },
    "nabeul": {
        "governorate": "Nabeul",
        "name": "Nabeul / Hammamet (Cap Bon)",
        "lat": 36.45,
        "lon": 10.73,
        "specific_yield_kwh_kwp": 1650.0,
        "ghi_kwh_m2_year": 1880.0,
        "optimal_tilt_deg": 33,
    },
    "kairouan": {
        "governorate": "Kairouan",
        "name": "Kairouan",
        "lat": 35.68,
        "lon": 10.10,
        "specific_yield_kwh_kwp": 1740.0,
        "ghi_kwh_m2_year": 1990.0,
        "optimal_tilt_deg": 32,
    },
    "kasserine": {
        "governorate": "Kasserine",
        "name": "Kasserine",
        "lat": 35.17,
        "lon": 8.83,
        "specific_yield_kwh_kwp": 1770.0,
        "ghi_kwh_m2_year": 2020.0,
        "optimal_tilt_deg": 32,
    },
    "sidi bouzid": {
        "governorate": "Sidi Bouzid",
        "name": "Sidi Bouzid",
        "lat": 35.04,
        "lon": 9.49,
        "specific_yield_kwh_kwp": 1760.0,
        "ghi_kwh_m2_year": 2010.0,
        "optimal_tilt_deg": 32,
    },
    "beja": {
        "governorate": "Beja",
        "name": "Beja",
        "lat": 36.73,
        "lon": 9.18,
        "specific_yield_kwh_kwp": 1620.0,
        "ghi_kwh_m2_year": 1830.0,
        "optimal_tilt_deg": 33,
    },
    "jendouba": {
        "governorate": "Jendouba",
        "name": "Jendouba / Tabarka",
        "lat": 36.50,
        "lon": 8.78,
        "specific_yield_kwh_kwp": 1610.0,
        "ghi_kwh_m2_year": 1820.0,
        "optimal_tilt_deg": 33,
    },
    "kef": {
        "governorate": "Le Kef",
        "name": "Le Kef",
        "lat": 36.17,
        "lon": 8.70,
        "specific_yield_kwh_kwp": 1670.0,
        "ghi_kwh_m2_year": 1890.0,
        "optimal_tilt_deg": 33,
    },
    "siliana": {
        "governorate": "Siliana",
        "name": "Siliana",
        "lat": 36.08,
        "lon": 9.37,
        "specific_yield_kwh_kwp": 1660.0,
        "ghi_kwh_m2_year": 1880.0,
        "optimal_tilt_deg": 33,
    },
    "zaghouan": {
        "governorate": "Zaghouan",
        "name": "Zaghouan",
        "lat": 36.40,
        "lon": 10.14,
        "specific_yield_kwh_kwp": 1660.0,
        "ghi_kwh_m2_year": 1880.0,
        "optimal_tilt_deg": 33,
    },
}

# Cache for PVGIS API calls: key = f"{lat:.2f}_{lon:.2f}", value = (yield, timestamp)
_PVGIS_CACHE: dict[str, tuple[float, float]] = {}


# ─────────────────────────────────────────────────────────────────────────────
# 2. Consumption and Bill Analysis
# ─────────────────────────────────────────────────────────────────────────────
def calculate_consumption(
    kwh: float,
    months: int = 2,
    bill_amount_tnd: Optional[float] = None
) -> dict[str, Any]:
    """
    Deterministic calculation of monthly and annual consumption and expenses.
    
    Strict rules:
    - Never confuse monthly and bimonthly!
    - Monthly kWh = kwh / months
    - Annual kWh = (kwh / months) * 12
    - Monthly bill = bill_amount_tnd / months (if provided)
    - Annual bill = (bill_amount_tnd / months) * 12 (if provided)
    """
    if months <= 0:
        months = 2
    if kwh < 0:
        kwh = 0.0

    monthly_kwh = round(kwh / months, 2)
    annual_kwh = round(monthly_kwh * 12, 2)

    monthly_bill: Optional[float] = None
    annual_bill: Optional[float] = None

    if bill_amount_tnd is not None and bill_amount_tnd >= 0:
        monthly_bill = round(bill_amount_tnd / months, 2)
        annual_bill = round(monthly_bill * 12, 2)

    return {
        "period_months": months,
        "billed_kwh": round(kwh, 2),
        "monthly_kwh": monthly_kwh,
        "annual_kwh": annual_kwh,
        "billed_amount_tnd": round(bill_amount_tnd, 2) if bill_amount_tnd is not None else None,
        "monthly_amount_tnd": monthly_bill,
        "annual_amount_tnd": annual_bill,
    }


# ─────────────────────────────────────────────────────────────────────────────
# 3. Solar Yield & PVGIS Integration
# ─────────────────────────────────────────────────────────────────────────────
def get_solar_yield(
    location: str,
    lat: Optional[float] = None,
    lon: Optional[float] = None,
    use_pvgis_live: bool = True
) -> dict[str, Any]:
    """
    Retrieve specific solar yield (kWh / kWp / year) for a given location.
    
    1. Looks up the location in the curated Tunisian database.
    2. Attempts a real query to European Commission PVGIS API if internet accessible and cached.
    3. If PVGIS is unavailable or offline, uses the documented reference table with clear attribution.
    """
    loc_clean = (location or "Tunis").strip().lower()
    
    # Fuzzy match with Tunisian regions
    region_data: Optional[dict[str, Any]] = None
    for key, data in TUNISIAN_REGIONS_SOLAR_DATABASE.items():
        if key in loc_clean or data["name"].lower() in loc_clean or data["governorate"].lower() in loc_clean:
            region_data = data
            break
            
    if not region_data:
        # Default to Tunis national baseline
        region_data = TUNISIAN_REGIONS_SOLAR_DATABASE["tunis"]

    final_lat = lat if lat is not None else region_data["lat"]
    final_lon = lon if lon is not None else region_data["lon"]
    base_yield = region_data["specific_yield_kwh_kwp"]
    optimal_tilt = region_data["optimal_tilt_deg"]

    # Try PVGIS API
    is_live_pvgis = False
    source = f"Base de référence documentée ANME/Smart Solar ({region_data['name']})"

    if use_pvgis_live and final_lat and final_lon:
        cache_key = f"{final_lat:.2f}_{final_lon:.2f}"
        now = time.time()
        if cache_key in _PVGIS_CACHE and (now - _PVGIS_CACHE[cache_key][1]) < 86400:
            base_yield = _PVGIS_CACHE[cache_key][0]
            is_live_pvgis = True
            source = "PVGIS-5 (JRC Commission Européenne - Cache validé)"
        else:
            try:
                # PVGIS-5 non-interactive REST endpoint
                pvgis_url = (
                    f"https://re.jrc.ec.europa.eu/api/v5_2/PVcalc?"
                    f"lat={final_lat:.4f}&lon={final_lon:.4f}&peakpower=1&loss=14&optimalinclination=1&outputformat=json"
                )
                with httpx.Client(timeout=3.5) as client:
                    resp = client.get(pvgis_url)
                    if resp.status_code == 200:
                        data = resp.json()
                        pvgis_yield = data.get("outputs", {}).get("totals", {}).get("fixed", {}).get("E_y")
                        if pvgis_yield and pvgis_yield > 1000:
                            base_yield = round(float(pvgis_yield), 1)
                            _PVGIS_CACHE[cache_key] = (base_yield, now)
                            is_live_pvgis = True
                            source = "PVGIS-5 (JRC Commission Européenne - Requête en temps réel)"
            except Exception as e:
                logger.debug(f"PVGIS live lookup skipped or timed out: {e}")
                # Clean fallback to documented dataset

    return {
        "location": region_data["name"],
        "governorate": region_data["governorate"],
        "lat": final_lat,
        "lon": final_lon,
        "specific_yield_kwh_kwp": base_yield,
        "optimal_tilt_deg": optimal_tilt,
        "is_live_pvgis": is_live_pvgis,
        "source": source,
        "is_estimate": not is_live_pvgis,
    }


# ─────────────────────────────────────────────────────────────────────────────
# 4. Deterministic Solar Sizing Engine
# ─────────────────────────────────────────────────────────────────────────────
def calculate_solar_sizing(
    annual_kwh: float,
    location: str,
    panel_wattage_w: int = 450,
    target_coverage: float = 1.0
) -> dict[str, Any]:
    """
    Calculates deterministic, physically coherent solar installation parameters.
    
    Rules:
    - Never invent installed power!
    - Installed power (kWc) = nb_panels * (panel_wattage_w / 1000).
    - Production (kWh/an) = installed_power_kwc * specific_yield.
    - Coverage (%) = (production / annual_kwh) * 100.
    - Surface needed = nb_panels * 2.0 m².
    """
    if annual_kwh <= 0:
        annual_kwh = 2400.0
    if panel_wattage_w <= 0:
        panel_wattage_w = 450

    yield_info = get_solar_yield(location)
    specific_yield = yield_info["specific_yield_kwh_kwp"]

    # Target kWp to cover annual consumption exactly
    target_kwp = (annual_kwh * target_coverage) / specific_yield
    panel_kwp = panel_wattage_w / 1000.0

    # Calculate integer number of panels
    # Minimum 2 panels for grid-tied inverter in residential
    exact_panels = target_kwp / panel_kwp
    nb_panels_main = max(2, round(exact_panels))
    
    # Calculate exact installed kWp strictly tied to panel count
    installed_kwp_main = round(nb_panels_main * panel_kwp, 2)
    annual_prod_main = round(installed_kwp_main * specific_yield, 1)
    coverage_pct_main = round((annual_prod_main / annual_kwh) * 100, 1)
    surface_m2_main = round(nb_panels_main * 2.0, 1)

    # Alternative configuration (e.g., +1 panel or -1 panel depending on rounding)
    nb_panels_alt = nb_panels_main + (1 if nb_panels_main <= exact_panels else -1)
    if nb_panels_alt < 2:
        nb_panels_alt = nb_panels_main + 1
    installed_kwp_alt = round(nb_panels_alt * panel_kwp, 2)
    annual_prod_alt = round(installed_kwp_alt * specific_yield, 1)
    coverage_pct_alt = round((annual_prod_alt / annual_kwh) * 100, 1)
    surface_m2_alt = round(nb_panels_alt * 2.0, 1)

    return {
        "location": yield_info["location"],
        "annual_consumption_kwh": round(annual_kwh, 2),
        "specific_yield_kwh_kwp": specific_yield,
        "yield_source": yield_info["source"],
        "panel_wattage_w": panel_wattage_w,
        "main_configuration": {
            "nb_panels": nb_panels_main,
            "panel_wattage_w": panel_wattage_w,
            "installed_kwp": installed_kwp_main,
            "estimated_production_kwh_year": annual_prod_main,
            "coverage_percentage": coverage_pct_main,
            "required_area_m2": surface_m2_main,
        },
        "alternative_configuration": {
            "nb_panels": nb_panels_alt,
            "panel_wattage_w": panel_wattage_w,
            "installed_kwp": installed_kwp_alt,
            "estimated_production_kwh_year": annual_prod_alt,
            "coverage_percentage": coverage_pct_alt,
            "required_area_m2": surface_m2_alt,
        },
    }


# ─────────────────────────────────────────────────────────────────────────────
# 5. Financial Cost Estimation & ROI (Tunisia Market 2024-2026)
# ─────────────────────────────────────────────────────────────────────────────
def estimate_installation_cost(
    installed_kwp: float,
    nb_panels: int,
    panel_wattage_w: int = 450
) -> dict[str, Any]:
    """
    Deterministic cost estimate based on verified Tunisian turnkey quotes:
    - Tier 1 panels: ~520 TND / 450W panel
    - STEG certified grid-tied inverter:
        <= 2 kWp -> 1,900 TND (Growatt 2000TL-X)
        2.1 - 4 kWp -> 2,400 TND (Growatt 3000TL-X / Huawei 3KTL)
        > 4 kWp -> 2,900 TND (Huawei / Sungrow 5KTL)
    - Anodized aluminum rooftop mounting structure: 80 TND / panel
    - Solar AC/DC safety box, surge protectors, cabling: 450 TND
    - Engineering, ANME administrative file, labor & commissioning: 750 TND
    - Prosol Élec Subsidy (FTE): 500 TND / kWp up to max 1,500 TND.
    """
    if installed_kwp <= 0:
        installed_kwp = round(nb_panels * (panel_wattage_w / 1000.0), 2)

    panels_cost = nb_panels * 520
    
    if installed_kwp <= 2.0:
        inverter_cost = 1900
        inverter_model = "Growatt MIN 2000TL-X (Monophasé agréé STEG)"
    elif installed_kwp <= 4.0:
        inverter_cost = 2400
        inverter_model = "Growatt MIN 3000TL-X / Huawei SUN2000-3KTL"
    else:
        inverter_cost = 2900
        inverter_model = "Huawei SUN2000-5KTL / Sungrow 5kW"

    structure_cost = nb_panels * 80
    electrical_protection_cost = 450
    labor_admin_cost = 750

    gross_total_tnd = panels_cost + inverter_cost + structure_cost + electrical_protection_cost + labor_admin_cost

    # Prosol Élec Subsidy (Fonds de Transition Énergétique - FTE)
    # 500 TND per kWp capped at 1,500 TND
    prosol_subsidy_tnd = min(round(installed_kwp * 500.0, 0), 1500.0)
    net_total_tnd = gross_total_tnd - prosol_subsidy_tnd

    # Prosol Élec on-bill financing (over 5 years / 60 months or 7 years / 84 months)
    # Interest rate subsidized (~7% annual), divided into bimonthly bills (30 or 42 bimonthly bills)
    bimonthly_payment_5y = round((net_total_tnd * 1.15) / 30, 1)  # 30 bimonthly bills over 5 years
    monthly_payment_5y = round(bimonthly_payment_5y / 2, 1)

    return {
        "installed_kwp": installed_kwp,
        "nb_panels": nb_panels,
        "panel_model": f"Tier 1 Monocristallin {panel_wattage_w} Wc",
        "inverter_model": inverter_model,
        "breakdown_tnd": {
            "panels": panels_cost,
            "inverter": inverter_cost,
            "mounting_structure": structure_cost,
            "electrical_safety_cables": electrical_protection_cost,
            "installation_admin_commissioning": labor_admin_cost,
        },
        "gross_total_tnd": gross_total_tnd,
        "prosol_subsidy_tnd": prosol_subsidy_tnd,
        "net_total_tnd": net_total_tnd,
        "financing_prosol": {
            "is_eligible": True,
            "duration_years": 5,
            "estimated_bimonthly_payment_tnd": bimonthly_payment_5y,
            "estimated_monthly_payment_tnd": monthly_payment_5y,
            "payment_channel": "Prélèvement automatique échelonné sur facture STEG",
        },
    }


def calculate_roi(
    total_investment_tnd: float,
    annual_savings_tnd: float,
    bill_amount_annual_tnd: Optional[float] = None
) -> dict[str, Any]:
    """
    Deterministic ROI (Return on Investment) calculation.
    
    Formula:
    ROI (years) = total_investment_tnd / annual_savings_tnd
    
    Rules:
    - Never promise that STEG bill will drop to exactly 0 TND.
    - There are mandatory fixed grid fees (redevance compteur, taxes TCL/RTT) ~6 TND/month (~72 TND/year).
    - If annual bill is known, maximum achievable savings = annual_bill - fixed_fees.
    """
    fixed_annual_grid_fees_tnd = 72.0  # ~6 DT/month

    if bill_amount_annual_tnd is not None and bill_amount_annual_tnd > fixed_annual_grid_fees_tnd:
        max_possible_savings = bill_amount_annual_tnd - fixed_annual_grid_fees_tnd
        if annual_savings_tnd > max_possible_savings:
            annual_savings_tnd = max_possible_savings

    if annual_savings_tnd <= 0:
        annual_savings_tnd = 400.0  # reasonable fallback

    simple_payback_years = round(total_investment_tnd / annual_savings_tnd, 1)

    # 25 years cumulative savings
    cumulative_25y_savings = round(annual_savings_tnd * 25 - total_investment_tnd, 0)

    return {
        "total_investment_tnd": round(total_investment_tnd, 2),
        "annual_savings_tnd": round(annual_savings_tnd, 2),
        "simple_payback_years": simple_payback_years,
        "cumulative_net_savings_25y_tnd": cumulative_25y_savings,
        "mandatory_fixed_steg_fees_year_tnd": fixed_annual_grid_fees_tnd,
        "zero_bill_warning": "Attention : La facture STEG ne sera jamais de 0 DT car les redevances fixes de compteur et taxes municipales restent légalement dues.",
    }
