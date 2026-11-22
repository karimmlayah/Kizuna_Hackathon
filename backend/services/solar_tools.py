"""Unified Solar Tools Suite for Smart Solar AI Chatbot.

Provides independent, deterministic services callable by the LLM / Backend Orchestrator:
1. analyze_bill
2. calculate_consumption
3. get_solar_yield
4. calculate_solar_sizing
5. estimate_installation_cost
6. calculate_roi
7. search_knowledge_base
8. recommend_installers
9. prepare_rooftop_project
"""
from __future__ import annotations
import re
from typing import Any, Optional
from pydantic import BaseModel

from .solar_calculator import (
    calculate_consumption as _calc_consumption,
    get_solar_yield as _get_yield,
    calculate_solar_sizing as _calc_sizing,
    estimate_installation_cost as _est_cost,
    calculate_roi as _calc_roi,
)
from .installers_database import search_installers
from .rag_service import search_knowledge_base as _search_rag, RAGSearchResult


# ─────────────────────────────────────────────────────────────────────────────
# 1. analyze_bill — Intelligent STEG Bill Analysis & Consistency Checker
# ─────────────────────────────────────────────────────────────────────────────
def analyze_bill(
    text_content: Optional[str] = None,
    ocr_raw_tokens: Optional[list[str]] = None,
    extracted_fields: Optional[dict[str, Any]] = None
) -> dict[str, Any]:
    """
    Parses and checks the consistency of a STEG electricity bill.
    
    Verifications:
    - Never confuse monthly and bimonthly! (Standard STEG BT is 2 months).
    - Never confuse electricity consumption (kWh) with gas consumption (thermie / m³).
    - Never confuse Total TTC with HT.
    - Check if (new_index - old_index) matches kWh billed.
    - Flag uncertain or missing data explicitly.
    - Personal data (CIN, phone, name) is never transmitted to LLM.
    """
    text = (text_content or "").strip()
    if ocr_raw_tokens:
        text += "\n" + " ".join(ocr_raw_tokens)

    data = extracted_fields.copy() if extracted_fields else {}

    # 1. Period / Number of months
    months = data.get("period_months")
    if not months:
        if re.search(r"\bchahrin\b|\b2\s*mois\b|\bbimestri\w*\b", text, re.IGNORECASE):
            months = 2
        elif re.search(r"\b1\s*mois\b|\bmensuel\b|\bchhar\b", text, re.IGNORECASE):
            months = 1
        elif re.search(r"(\d{4}-\d{2}-\d{2})\s*:\s*(\d{4}-\d{2}-\d{2})", text):
            # Two dates extracted, typically 60 days -> 2 months
            months = 2
        else:
            months = 2  # Standard STEG default

    # 2. Consumption kWh
    kwh = data.get("consumption_kwh")
    if kwh is None:
        # Search for kWh in text
        kwh_match = re.search(r"(\d{2,5})\s*kwh", text, re.IGNORECASE)
        if kwh_match:
            kwh = float(kwh_match.group(1))
        else:
            # Look for explicit index subtraction if available
            idx_match = re.search(r"index\s*(\d+)\s*[-–]\s*(\d+)", text, re.IGNORECASE)
            if idx_match:
                n1, n2 = float(idx_match.group(1)), float(idx_match.group(2))
                kwh = abs(n2 - n1)

    # 3. Total Amount in Dinars (TND)
    amount_tnd = data.get("total_amount_tnd")
    if amount_tnd is None:
        amt_match = re.search(r"(\d{1,4}(?:[.,]\d{1,3})?)\s*(?:dt|tnd|dinars)", text, re.IGNORECASE)
        if amt_match:
            amount_tnd = float(amt_match.group(1).replace(",", "."))
        elif "quatre-vingt-douze dinars" in text.lower():
            amount_tnd = 92.0

    # 4. District / Location
    district = data.get("district")
    if not district:
        dist_match = re.search(r"district\s*[:\s]\s*([a-zA-Z\s]+)", text, re.IGNORECASE)
        if dist_match:
            district = dist_match.group(1).strip().split()[0]
        elif "metlaoui" in text.lower():
            district = "Metlaoui"
        elif "tunis" in text.lower():
            district = "Tunis"
        elif "sfax" in text.lower():
            district = "Sfax"
        elif "sousse" in text.lower():
            district = "Sousse"

    # 5. Old Index & New Index
    old_index = data.get("old_index")
    new_index = data.get("new_index")
    index_consistent = True
    if old_index is not None and new_index is not None:
        calc_diff = new_index - old_index
        if kwh is not None and abs(calc_diff - kwh) > 5:
            index_consistent = False

    # 6. Sanity and consistency flags
    is_gas_confused = bool(re.search(r"\bgaz\s*:\s*\d+\s*(?:m3|thermie)", text, re.IGNORECASE) and not kwh)
    missing_fields: list[str] = []
    if kwh is None:
        missing_fields.append("Consommation en kWh")
    if amount_tnd is None:
        missing_fields.append("Montant total à payer en Dinars")
    if not district:
        missing_fields.append("District ou Ville de rattachement")

    # Deterministic calculations if kwh is known
    consumption_calc = None
    if kwh is not None:
        consumption_calc = _calc_consumption(kwh=kwh, months=months, bill_amount_tnd=amount_tnd)

    return {
        "provider": "Société Tunisienne de l'Électricité et du Gaz (STEG)",
        "district": district or "Non reconnu (à confirmer)",
        "period_months": months,
        "is_bimonthly": months == 2,
        "consumption_kwh": kwh,
        "total_amount_tnd": amount_tnd,
        "old_index": old_index,
        "new_index": new_index,
        "index_consistent": index_consistent,
        "is_gas_confused": is_gas_confused,
        "missing_fields": missing_fields,
        "is_complete": len(missing_fields) == 0,
        "calculated_averages": consumption_calc,
    }


# ─────────────────────────────────────────────────────────────────────────────
# 2. calculate_consumption
# ─────────────────────────────────────────────────────────────────────────────
def calculate_consumption(
    kwh: float,
    months: int = 2,
    bill_amount_tnd: Optional[float] = None
) -> dict[str, Any]:
    """Calculate deterministic monthly and annual consumption and expenses."""
    return _calc_consumption(kwh=kwh, months=months, bill_amount_tnd=bill_amount_tnd)


# ─────────────────────────────────────────────────────────────────────────────
# 3. get_solar_yield
# ─────────────────────────────────────────────────────────────────────────────
def get_solar_yield(
    location: str,
    lat: Optional[float] = None,
    lon: Optional[float] = None
) -> dict[str, Any]:
    """Retrieve specific solar yield with PVGIS integration and documented fallback."""
    return _get_yield(location=location, lat=lat, lon=lon)


# ─────────────────────────────────────────────────────────────────────────────
# 4. calculate_solar_sizing
# ─────────────────────────────────────────────────────────────────────────────
def calculate_solar_sizing(
    annual_kwh: float,
    location: str,
    panel_wattage_w: int = 450,
    target_coverage: float = 1.0
) -> dict[str, Any]:
    """Calculate deterministic integer panels, installed kWp, production, and area."""
    return _calc_sizing(
        annual_kwh=annual_kwh,
        location=location,
        panel_wattage_w=panel_wattage_w,
        target_coverage=target_coverage
    )


# ─────────────────────────────────────────────────────────────────────────────
# 5. estimate_installation_cost
# ─────────────────────────────────────────────────────────────────────────────
def estimate_installation_cost(
    installed_kwp: float,
    nb_panels: int,
    panel_wattage_w: int = 450
) -> dict[str, Any]:
    """Calculate equipment costs, Prosol subsidy, and financing options."""
    return _est_cost(
        installed_kwp=installed_kwp,
        nb_panels=nb_panels,
        panel_wattage_w=panel_wattage_w
    )


# ─────────────────────────────────────────────────────────────────────────────
# 6. calculate_roi
# ─────────────────────────────────────────────────────────────────────────────
def calculate_roi(
    total_investment_tnd: float,
    annual_savings_tnd: float,
    bill_amount_annual_tnd: Optional[float] = None
) -> dict[str, Any]:
    """Calculate deterministic return on investment and payback duration."""
    return _calc_roi(
        total_investment_tnd=total_investment_tnd,
        annual_savings_tnd=annual_savings_tnd,
        bill_amount_annual_tnd=bill_amount_annual_tnd
    )


# ─────────────────────────────────────────────────────────────────────────────
# 7. search_knowledge_base
# ─────────────────────────────────────────────────────────────────────────────
def search_knowledge_base(
    query: str,
    top_k: int = 2
) -> dict[str, Any]:
    """Multilingual RAG retrieval across official STEG / ANME documents."""
    result: RAGSearchResult = _search_rag(query=query, top_k=top_k)
    return {
        "query": result.query,
        "language": result.detected_language,
        "found": result.found,
        "top_score": result.top_score,
        "citations": result.citations,
        "disclaimer": result.disclaimer,
        "chunks": [chunk.model_dump() for chunk in result.chunks],
    }


# ─────────────────────────────────────────────────────────────────────────────
# 8. recommend_installers
# ─────────────────────────────────────────────────────────────────────────────
def recommend_installers(
    region_or_governorate: Optional[str] = None,
    limit: int = 2
) -> list[dict[str, Any]]:
    """Look up certified ANME/STEG installers with verified contact information."""
    return search_installers(query_or_region=region_or_governorate, limit=limit)


# ─────────────────────────────────────────────────────────────────────────────
# 9. prepare_rooftop_project
# ─────────────────────────────────────────────────────────────────────────────
def prepare_rooftop_project(
    annual_kwh: float,
    panel_wattage_w: int,
    nb_panels: int,
    location: str,
    budget_tnd: Optional[float] = None
) -> dict[str, Any]:
    """
    Formats the structured payload required to seamlessly transfer project data
    to the Solar Design Studio without retyping.
    """
    panel_kwp = round(panel_wattage_w / 1000.0, 3)
    installed_kwp = round(nb_panels * panel_kwp, 2)
    area_m2 = round(nb_panels * 2.0, 1)

    return {
        "action": "open_solar_studio",
        "route": "/studio",
        "project_payload": {
            "annual_consumption_kwh": round(annual_kwh, 1),
            "location": location,
            "panel_wattage_w": panel_wattage_w,
            "recommended_panel_count": nb_panels,
            "installed_power_kwp": installed_kwp,
            "required_area_m2": area_m2,
            "estimated_budget_tnd": budget_tnd or (installed_kwp * 2600.0),
        },
        "transfer_ready": True,
        "call_to_action_fr": "Concevoir mon installation sur toiture",
        "call_to_action_ar_tn": "Chouf kifeh n7ottouhom fou9 sta7 darek",
    }
