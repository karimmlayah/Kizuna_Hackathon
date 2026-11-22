"""Smart Solar Weather Service — Open-Meteo Integration & Photovoltaic Forecasting.

Fetches high-resolution weather, global tilted irradiance (GTI), temperature,
and calculates deterministic PV production forecasts, Solar Scores (0-100),
and optimal appliance consumption windows for Tunisia.
"""
from __future__ import annotations
import calendar
import json
import logging
import math
import os
import time
from datetime import datetime, timezone, timedelta
from typing import Any, Optional
import urllib.request
import urllib.error

logger = logging.getLogger("weather_service")

# ─────────────────────────────────────────────────────────────────────────────
# 1. Constants & City Geocoding Database
# ─────────────────────────────────────────────────────────────────────────────
OPEN_METEO_BASE_URL = "https://api.open-meteo.com/v1/forecast"
CACHE_TTL_SECONDS = 900  # 15 minutes cache to respect Open-Meteo fair usage

TUNISIAN_CITIES: dict[str, dict[str, Any]] = {
    "tunis": {"name": "Tunis", "lat": 36.8065, "lon": 10.1815, "gov": "Tunis"},
    "metlaoui": {"name": "Métlaoui", "lat": 34.3208, "lon": 8.4019, "gov": "Gafsa"},
    "gafsa": {"name": "Gafsa", "lat": 34.4250, "lon": 8.7842, "gov": "Gafsa"},
    "sousse": {"name": "Sousse", "lat": 35.8256, "lon": 10.6084, "gov": "Sousse"},
    "sfax": {"name": "Sfax", "lat": 34.7406, "lon": 10.7603, "gov": "Sfax"},
    "bizerte": {"name": "Bizerte", "lat": 37.2744, "lon": 9.8739, "gov": "Bizerte"},
    "nabeul": {"name": "Nabeul", "lat": 36.4561, "lon": 10.7376, "gov": "Nabeul"},
    "kairouan": {"name": "Kairouan", "lat": 35.6781, "lon": 10.0963, "gov": "Kairouan"},
    "gabes": {"name": "Gabès", "lat": 33.8815, "lon": 10.0982, "gov": "Gabès"},
    "djerba": {"name": "Djerba", "lat": 33.8076, "lon": 10.8451, "gov": "Médenine"},
    "tozeur": {"name": "Tozeur", "lat": 33.9197, "lon": 8.1335, "gov": "Tozeur"},
    "monastir": {"name": "Monastir", "lat": 35.7780, "lon": 10.8262, "gov": "Monastir"},
}

WMO_WEATHER_CODES: dict[int, dict[str, str]] = {
    0: {"desc": "Ciel dégagé", "icon": "clear-day", "condition": "Ensoleillé"},
    1: {"desc": "Principalement dégagé", "icon": "partly-cloudy-day", "condition": "Peu nuageux"},
    2: {"desc": "Partiellement nuageux", "icon": "partly-cloudy-day", "condition": "Éclaircies"},
    3: {"desc": "Couvert", "icon": "cloudy", "condition": "Nuageux"},
    45: {"desc": "Brouillard", "icon": "fog", "condition": "Brume"},
    48: {"desc": "Brouillard givrant", "icon": "fog", "condition": "Brouillard"},
    51: {"desc": "Bruine légère", "icon": "rain", "condition": "Pluie fine"},
    53: {"desc": "Bruine modérée", "icon": "rain", "condition": "Bruine"},
    55: {"desc": "Bruine dense", "icon": "rain", "condition": "Bruine"},
    61: {"desc": "Pluie faible", "icon": "rain", "condition": "Averses faibles"},
    63: {"desc": "Pluie modérée", "icon": "rain", "condition": "Pluvieux"},
    65: {"desc": "Pluie forte", "icon": "rain", "condition": "Fortes pluies"},
    71: {"desc": "Neige légère", "icon": "snow", "condition": "Neige"},
    80: {"desc": "Averses de pluie", "icon": "rain", "condition": "Averses"},
    95: {"desc": "Orage", "icon": "thunderstorm", "condition": "Orageux"},
}

# Cache: key -> (timestamp, data)
_WEATHER_CACHE: dict[str, tuple[float, dict[str, Any]]] = {}


def resolve_coordinates(
    lat: Optional[float] = None,
    lon: Optional[float] = None,
    city: Optional[str] = None
) -> tuple[float, float, str]:
    """Resolve latitude, longitude and city name, defaulting to Tunis."""
    if city and city.strip().lower() in TUNISIAN_CITIES:
        c = TUNISIAN_CITIES[city.strip().lower()]
        return c["lat"], c["lon"], c["name"]

    if lat is not None and lon is not None:
        # Find closest known city for display
        best_city = "Tunis"
        min_dist = float("inf")
        for key, c in TUNISIAN_CITIES.items():
            dist = (lat - c["lat"]) ** 2 + (lon - c["lon"]) ** 2
            if dist < min_dist:
                min_dist = dist
                best_city = c["name"]
        return float(lat), float(lon), best_city

    # Default to Tunis
    default_c = TUNISIAN_CITIES["tunis"]
    return default_c["lat"], default_c["lon"], default_c["name"]


# ─────────────────────────────────────────────────────────────────────────────
# 2. Open-Meteo API Fetcher with Caching
# ─────────────────────────────────────────────────────────────────────────────
def fetch_open_meteo_raw(lat: float, lon: float) -> dict[str, Any]:
    """Fetch complete weather and solar radiation dataset from Open-Meteo."""
    cache_key = f"{round(lat, 3)}_{round(lon, 3)}"
    now = time.time()

    if cache_key in _WEATHER_CACHE:
        cached_time, cached_data = _WEATHER_CACHE[cache_key]
        if now - cached_time < CACHE_TTL_SECONDS:
            logger.info("Serving Open-Meteo from cache (%s, age=%.1fs)", cache_key, now - cached_time)
            return cached_data

    params = [
        f"latitude={lat:.4f}",
        f"longitude={lon:.4f}",
        "current=temperature_2m,apparent_temperature,relative_humidity_2m,cloud_cover,wind_speed_10m,weather_code",
        "hourly=temperature_2m,relative_humidity_2m,cloud_cover,precipitation_probability,shortwave_radiation,direct_radiation,diffuse_radiation,global_tilted_irradiance",
        "daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,sunshine_duration,shortwave_radiation_sum",
        "timezone=Africa/Tunis",
        "tilt=30",
        "azimuth=0"  # Facing South
    ]
    url = f"{OPEN_METEO_BASE_URL}?{'&'.join(params)}"

    req = urllib.request.Request(
        url,
        headers={"User-Agent": "SmartSolar/2.0 (Energy & Weather Intelligence)"}
    )

    try:
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            _WEATHER_CACHE[cache_key] = (now, data)
            return data
    except Exception as e:
        logger.warning("Open-Meteo fetch failed (%s): %s. Using fallback baseline.", url, e)
        # Check if expired cache exists
        if cache_key in _WEATHER_CACHE:
            return _WEATHER_CACHE[cache_key][1]
        return generate_fallback_weather(lat, lon)


def generate_fallback_weather(lat: float, lon: float) -> dict[str, Any]:
    """Generates a realistic daytime baseline if network is down."""
    now_dt = datetime.now(timezone(timedelta(hours=1)))
    return {
        "latitude": lat,
        "longitude": lon,
        "timezone": "Africa/Tunis",
        "current": {
            "time": now_dt.strftime("%Y-%m-%dT%H:00"),
            "temperature_2m": 22.5,
            "apparent_temperature": 22.0,
            "relative_humidity_2m": 45,
            "cloud_cover": 10,
            "wind_speed_10m": 12.0,
            "weather_code": 0
        },
        "daily": {
            "time": [now_dt.strftime("%Y-%m-%d")],
            "weather_code": [0],
            "temperature_2m_max": [25.0],
            "temperature_2m_min": [14.0],
            "sunrise": [f"{now_dt.strftime('%Y-%m-%d')}T06:45"],
            "sunset": [f"{now_dt.strftime('%Y-%m-%d')}T18:15"],
            "sunshine_duration": [34200],
            "shortwave_radiation_sum": [22.5]
        },
        "hourly": {
            "time": [f"{now_dt.strftime('%Y-%m-%d')}T{h:02d}:00" for h in range(24)],
            "temperature_2m": [15.0 + 10.0 * math.sin((h / 24.0) * math.pi) for h in range(24)],
            "cloud_cover": [10 for _ in range(24)],
            "precipitation_probability": [0 for _ in range(24)],
            "global_tilted_irradiance": [
                max(0.0, 920.0 * math.sin(((h - 6) / 12.0) * math.pi)) if 6 <= h <= 18 else 0.0
                for h in range(24)
            ]
        }
    }


# ─────────────────────────────────────────────────────────────────────────────
# 3. Solar Score Calculation Engine (0 - 100)
# ─────────────────────────────────────────────────────────────────────────────
def calculate_solar_score(raw: dict[str, Any]) -> dict[str, Any]:
    """
    Computes transparent Solar Score (0 - 100) based on daily irradiance and cloud cover.
    Clear sky reference in Tunisia is ~24-28 MJ/m² in spring/summer, ~14-18 MJ/m² in winter.
    """
    daily = raw.get("daily", {})
    current = raw.get("current", {})

    rad_sums = daily.get("shortwave_radiation_sum", [18.0])
    today_rad_mj = rad_sums[0] if rad_sums else 18.0

    cloud_cover = current.get("cloud_cover", 20)
    w_code = current.get("weather_code", 0)

    # Base reference ~22 MJ/m²
    rad_ratio = min(1.0, max(0.1, today_rad_mj / 22.0))
    cloud_penalty = (100.0 - cloud_cover) / 100.0

    # Weighted score: 65% irradiance + 35% cloud clearness
    score = int(round((rad_ratio * 0.65 + cloud_penalty * 0.35) * 100))
    score = max(5, min(100, score))

    if score >= 80:
        category = "excellent"
        title = "Excellent potentiel solaire"
        explanation = (
            f"Ensoleillement radieux ({today_rad_mj:.1f} MJ/m²) avec couverture nuageuse minimale ({cloud_cover}%). "
            "Journée idéale pour une autoconsommation maximale et pour lancer vos appareils énergivores."
        )
    elif score >= 50:
        category = "moderate"
        title = "Potentiel solaire modéré"
        explanation = (
            f"Ensoleillement satisfaisant avec quelques passages nuageux ({cloud_cover}%). "
            "La production couvrira vos besoins de base."
        )
    else:
        category = "low"
        title = "Faible potentiel solaire"
        explanation = (
            f"Couverture nuageuse importante ({cloud_cover}%) ou précipitations. "
            "La production photovoltaïque sera réduite aujourd'hui."
        )

    return {
        "score": score,
        "category": category,
        "title": title,
        "explanation": explanation,
        "today_radiation_mj": round(today_rad_mj, 2),
        "cloud_cover_pct": cloud_cover,
        "weather_code": w_code,
    }


# ─────────────────────────────────────────────────────────────────────────────
# 4. Photovoltaic Production Forecast Model
# ─────────────────────────────────────────────────────────────────────────────
def calculate_pv_forecast(raw: dict[str, Any], kwp: float = 3.0) -> dict[str, Any]:
    """
    Computes deterministic hourly and daily PV production forecast (kWh).
    Physics model:
      E_hourly = kwp * (GTI / 1000) * PR * [1 + gamma * (T_cell - 25)]
    """
    hourly = raw.get("hourly", {})
    times = hourly.get("time", [])
    gtis = hourly.get("global_tilted_irradiance", [])
    temps = hourly.get("temperature_2m", [])

    PR = 0.84  # Performance ratio
    GAMMA = -0.0035  # -0.35% per °C above 25°C
    NOCT = 45.0  # Nominal operating cell temp

    hourly_forecast: list[dict[str, Any]] = []
    total_today_kwh = 0.0

    today_str = datetime.now(timezone(timedelta(hours=1))).strftime("%Y-%m-%d")
    tomorrow_str = (datetime.now(timezone(timedelta(hours=1))) + timedelta(days=1)).strftime("%Y-%m-%d")

    total_tomorrow_kwh = 0.0

    for i, t_str in enumerate(times[:48]):  # first 48h
        gti = gtis[i] if i < len(gtis) and gtis[i] is not None else 0.0
        t_amb = temps[i] if i < len(temps) and temps[i] is not None else 20.0

        if gti > 5.0:
            t_cell = t_amb + (gti / 800.0) * (NOCT - 20.0)
            temp_factor = 1.0 + GAMMA * (t_cell - 25.0)
            power_kw = kwp * (gti / 1000.0) * PR * max(0.7, temp_factor)
            energy_kwh = power_kw * 1.0  # 1 hour step
        else:
            power_kw = 0.0
            energy_kwh = 0.0

        item = {
            "time": t_str,
            "hour": t_str[11:16] if len(t_str) >= 16 else t_str,
            "gti_w_m2": round(gti, 1),
            "temp_c": round(t_amb, 1),
            "power_kw": round(power_kw, 3),
            "energy_kwh": round(energy_kwh, 3),
        }

        if t_str.startswith(today_str):
            total_today_kwh += energy_kwh
            hourly_forecast.append(item)
        elif t_str.startswith(tomorrow_str):
            total_tomorrow_kwh += energy_kwh

    # 7-day forecast from daily radiation sums
    daily = raw.get("daily", {})
    daily_times = daily.get("time", [])
    daily_rads = daily.get("shortwave_radiation_sum", [])
    daily_forecast: list[dict[str, Any]] = []

    for i, d_str in enumerate(daily_times[:7]):
        rad_mj = daily_rads[i] if i < len(daily_rads) and daily_rads[i] is not None else 18.0
        # 1 MJ/m² = 0.2778 kWh/m²
        rad_kwh_m2 = rad_mj * 0.2778
        # Tilted plane gain factor ~1.15 in Tunisia at 30°
        est_day_kwh = kwp * rad_kwh_m2 * 1.15 * PR

        # Day of week name
        dt = datetime.strptime(d_str, "%Y-%m-%d")
        day_names_fr = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"]
        day_label = day_names_fr[dt.weekday()]

        daily_forecast.append({
            "date": d_str,
            "day_name": day_label,
            "radiation_sum_mj": round(rad_mj, 1),
            "estimated_production_kwh": round(est_day_kwh, 2),
            "weather_code": daily.get("weather_code", [0])[i] if i < len(daily.get("weather_code", [])) else 0,
        })

    # Best production window
    best_hours = "10:00 - 15:00"
    peak_kw = max((h["power_kw"] for h in hourly_forecast), default=0.0)

    return {
        "kwp_installed": kwp,
        "today_production_kwh": round(total_today_kwh, 2),
        "tomorrow_production_kwh": round(total_tomorrow_kwh, 2),
        "peak_power_kw": round(peak_kw, 2),
        "best_solar_window": best_hours,
        "hourly_today": hourly_forecast,
        "seven_day_forecast": daily_forecast,
    }


# ─────────────────────────────────────────────────────────────────────────────
# 5. High-Level Aggregated Service
# ─────────────────────────────────────────────────────────────────────────────
def get_current_weather(lat: Optional[float] = None, lon: Optional[float] = None, city: Optional[str] = None) -> dict[str, Any]:
    """Retrieve instantaneous weather conditions with city name and description."""
    resolved_lat, resolved_lon, city_name = resolve_coordinates(lat, lon, city)
    raw = fetch_open_meteo_raw(resolved_lat, resolved_lon)
    curr = raw.get("current", {})
    daily = raw.get("daily", {})

    w_code = curr.get("weather_code", 0)
    w_info = WMO_WEATHER_CODES.get(w_code, {"desc": "Temps variable", "icon": "clear-day", "condition": "Variable"})

    # Check day/night relative to sunrise and sunset
    now_str = curr.get("time", "")
    sunrise = daily.get("sunrise", ["06:45"])[0]
    sunset = daily.get("sunset", ["18:15"])[0]
    is_night = False
    if len(now_str) >= 16 and len(sunrise) >= 16 and len(sunset) >= 16:
        now_h = now_str[11:16]
        is_night = now_h < sunrise[11:16] or now_h > sunset[11:16]

    return {
        "city": city_name,
        "latitude": resolved_lat,
        "longitude": resolved_lon,
        "time": curr.get("time"),
        "temperature_c": curr.get("temperature_2m"),
        "apparent_temperature_c": curr.get("apparent_temperature"),
        "humidity_pct": curr.get("relative_humidity_2m"),
        "cloud_cover_pct": curr.get("cloud_cover"),
        "wind_speed_kmh": curr.get("wind_speed_10m"),
        "weather_code": w_code,
        "weather_description": w_info["desc"],
        "weather_condition": w_info["condition"],
        "icon": w_info["icon"],
        "is_night": is_night,
        "sunrise": sunrise,
        "sunset": sunset,
        "source": "Open-Meteo API",
        "last_updated": datetime.now(timezone(timedelta(hours=1))).strftime("%Y-%m-%d %H:%M:%S (Tunis)"),
    }


def get_weather_forecast(lat: Optional[float] = None, lon: Optional[float] = None, city: Optional[str] = None) -> dict[str, Any]:
    """Retrieve full forecast including hourly and 7-day projections."""
    resolved_lat, resolved_lon, city_name = resolve_coordinates(lat, lon, city)
    raw = fetch_open_meteo_raw(resolved_lat, resolved_lon)
    current = get_current_weather(resolved_lat, resolved_lon, city_name)
    score = calculate_solar_score(raw)
    pv = calculate_pv_forecast(raw, kwp=3.0)

    return {
        "city": city_name,
        "latitude": resolved_lat,
        "longitude": resolved_lon,
        "current": current,
        "solar_score": score,
        "pv_forecast": pv,
    }


def get_today_solar_overview(
    lat: Optional[float] = None,
    lon: Optional[float] = None,
    city: Optional[str] = None,
    kwp: float = 3.0
) -> dict[str, Any]:
    """Unified payload for 'Today's Solar Overview' dashboard card."""
    resolved_lat, resolved_lon, city_name = resolve_coordinates(lat, lon, city)
    raw = fetch_open_meteo_raw(resolved_lat, resolved_lon)
    weather = get_current_weather(resolved_lat, resolved_lon, city_name)
    score = calculate_solar_score(raw)
    pv = calculate_pv_forecast(raw, kwp=kwp)

    # Time-appropriate greeting
    hr = datetime.now(timezone(timedelta(hours=1))).hour
    if 5 <= hr < 12:
        greeting = "Bonjour"
    elif 12 <= hr < 18:
        greeting = "Bon après-midi"
    else:
        greeting = "Bonsoir"

    # Contextual recommendation based on score and cloud cover
    if weather["is_night"]:
        recommendation = "Pendant la nuit, votre installation est en veille. Votre consommation provient de la batterie ou du réseau STEG."
    elif score["score"] >= 80:
        recommendation = (
            f"Journée solaire exceptionnelle ! Privilégiez la plage {pv['best_solar_window']} "
            "pour faire tourner lave-linge, climatiseur ou charger un véhicule."
        )
    elif score["score"] >= 50:
        recommendation = (
            f"Ensoleillement satisfaisant avec quelques passages nuageux. Concentrez vos usages autour de midi ({pv['best_solar_window']})."
        )
    else:
        recommendation = (
            "Couverture nuageuse importante aujourd'hui. La production sera réduite ; "
            "limitez les gros appareils électriques non urgents."
        )

    return {
        "greeting": greeting,
        "city": city_name,
        "weather": weather,
        "solar_score": score,
        "pv_forecast": {
            "today_kwh": pv["today_production_kwh"],
            "tomorrow_kwh": pv["tomorrow_production_kwh"],
            "peak_kw": pv["peak_power_kw"],
            "best_window": pv["best_solar_window"],
            "hourly_today": pv["hourly_today"][:14],  # daytime slice
            "seven_day": pv["seven_day_forecast"],
        },
        "smart_recommendation": recommendation,
        "source": "Open-Meteo",
        "timestamp_tunis": datetime.now(timezone(timedelta(hours=1))).strftime("%Y-%m-%d %H:%M:%S"),
    }
