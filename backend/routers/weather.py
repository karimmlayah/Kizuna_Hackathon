"""FastAPI Router for Open-Meteo Weather, Solar Score & PV Production Forecast."""
from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, HTTPException, Query

from ..services.weather_service import (
    get_current_weather,
    get_weather_forecast,
    calculate_solar_score,
    calculate_pv_forecast,
    get_today_solar_overview,
    fetch_open_meteo_raw,
    resolve_coordinates,
)

router = APIRouter(tags=["weather", "energy"])

# ─────────────────────────────────────────────────────────────────────────────
# Current Weather
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/api/weather/current")
@router.get("/weather/current")
def weather_current(
    lat: Optional[float] = Query(None, description="Latitude"),
    lon: Optional[float] = Query(None, description="Longitude"),
    city: Optional[str] = Query(None, description="City name (e.g. Tunis, Métlaoui)")
):
    """Instantaneous weather observations and daytime/nighttime status."""
    try:
        return get_current_weather(lat=lat, lon=lon, city=city)
    except Exception as e:
        raise HTTPException(500, f"Erreur lecture météo actuelle: {str(e)}")


# ─────────────────────────────────────────────────────────────────────────────
# Weather Forecast
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/api/weather/forecast")
@router.get("/weather/forecast")
def weather_forecast(
    lat: Optional[float] = Query(None),
    lon: Optional[float] = Query(None),
    city: Optional[str] = Query(None)
):
    """Full weather and solar radiation forecast including hourly and 7-day."""
    try:
        return get_weather_forecast(lat=lat, lon=lon, city=city)
    except Exception as e:
        raise HTTPException(500, f"Erreur prévisions météo: {str(e)}")


# ─────────────────────────────────────────────────────────────────────────────
# Solar Score
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/api/energy/solar-score")
@router.get("/energy/solar-score")
def energy_solar_score(
    lat: Optional[float] = Query(None),
    lon: Optional[float] = Query(None),
    city: Optional[str] = Query(None)
):
    """Transparent Solar Potential Score (0-100) with explanation."""
    try:
        resolved_lat, resolved_lon, city_name = resolve_coordinates(lat, lon, city)
        raw = fetch_open_meteo_raw(resolved_lat, resolved_lon)
        score = calculate_solar_score(raw)
        score["city"] = city_name
        return score
    except Exception as e:
        raise HTTPException(500, f"Erreur calcul Solar Score: {str(e)}")


# ─────────────────────────────────────────────────────────────────────────────
# Production Forecast
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/api/energy/production-forecast")
@router.get("/energy/production-forecast")
def energy_production_forecast(
    lat: Optional[float] = Query(None),
    lon: Optional[float] = Query(None),
    city: Optional[str] = Query(None),
    kwp: float = Query(3.0, ge=0.5, le=100.0, description="Installed solar power in kWc")
):
    """Photovoltaic production forecast (today, tomorrow, 7-day, hourly curve)."""
    try:
        resolved_lat, resolved_lon, city_name = resolve_coordinates(lat, lon, city)
        raw = fetch_open_meteo_raw(resolved_lat, resolved_lon)
        pv = calculate_pv_forecast(raw, kwp=kwp)
        pv["city"] = city_name
        return pv
    except Exception as e:
        raise HTTPException(500, f"Erreur prévision production solaire: {str(e)}")


# ─────────────────────────────────────────────────────────────────────────────
# Unified Overview
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/api/energy/overview")
@router.get("/energy/overview")
def energy_today_overview(
    lat: Optional[float] = Query(None),
    lon: Optional[float] = Query(None),
    city: Optional[str] = Query(None),
    kwp: float = Query(3.0, ge=0.5, le=100.0)
):
    """Unified payload for 'Today's Solar Overview' dashboard card."""
    try:
        return get_today_solar_overview(lat=lat, lon=lon, city=city, kwp=kwp)
    except Exception as e:
        raise HTTPException(500, f"Erreur overview solaire: {str(e)}")
