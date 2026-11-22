"""FastAPI Router for Rooftop Segmentation and Intelligent Solar Placement.

Supports both:
1. Meta Segment Anything (SAM ViT-B) GPU microservice on port 8004.
2. Local U-Net fallback on port 8003.
3. Deterministic Solar Sizing and Financial calculations.
"""
from __future__ import annotations
import base64
import json
import logging
from typing import Optional, Any
from pathlib import Path

import httpx
from fastapi import APIRouter, File, UploadFile, Form, HTTPException, Request, Response
from pydantic import BaseModel

from ..services.rooftop_service import (
    analyze_rooftop,
    evaluate_manual_layout,
    load_meta,
    get_model
)
from ..services.solar_calculator import (
    calculate_solar_sizing,
    estimate_installation_cost,
    calculate_roi,
    calculate_consumption,
    get_solar_yield
)
from ..config import ROOFTOP_SAMPLES_DIR

logger = logging.getLogger("rooftop_router")
router = APIRouter(tags=["rooftop"])

SAM_MICROSERVICE_URL = "http://127.0.0.1:8004"

# ─────────────────────────────────────────────────────────────────────────────
# Pydantic Request Models
# ─────────────────────────────────────────────────────────────────────────────
class AnalyzeJsonRequest(BaseModel):
    image_base64: str
    declared_area_m2: Optional[float] = None
    target_panels: Optional[int] = None
    panel_power_kwp: Optional[float] = 0.40
    obstacles: Optional[list[dict]] = None

class AdviseRequest(BaseModel):
    panels: list[dict]
    target_panels: Optional[int] = 10
    panel_power_kwp: Optional[float] = 0.40
    mask_base64: Optional[str] = None

class SamSegmentRequest(BaseModel):
    image_b64: str
    target_panels: Optional[int] = 6
    point_prompt: Optional[list[int]] = None

class SamSelectMaskRequest(BaseModel):
    image_b64: str
    selected_mask_id: int
    as_obstacle: bool = False

class SamPlanRequest(BaseModel):
    image_b64: str
    roof_mask_id: Optional[int] = None
    obstacle_mask_ids: Optional[list[int]] = None
    custom_roof_polygon: Optional[list[list[int]]] = None
    custom_obstacle_polygons: Optional[list[list[list[int]]]] = None
    desired_panels: int = 6
    panel_wattage_w: int = 450
    panel_width_m: float = 1.05
    panel_height_m: float = 1.76
    edge_setback_m: float = 0.3
    spacing_m: float = 0.15
    real_roof_area_m2: Optional[float] = None
    orientation: Optional[str] = "portrait"

class SamValidateRequest(BaseModel):
    image_width: int
    image_height: int
    roof_polygon: list[list[int]]
    obstacle_polygons: Optional[list[list[list[int]]]] = None
    panels: list[dict]

class SolarSizingRequest(BaseModel):
    annual_kwh: float
    location: str = "Tunis"
    panel_wattage_w: int = 450
    target_coverage: float = 1.0

class SolarFinancialRequest(BaseModel):
    installed_kwp: float
    annual_consumption_kwh: float
    annual_production_kwh: Optional[float] = None
    location: str = "Tunis"
    annual_bill_tnd: Optional[float] = None
    custom_cost_tnd: Optional[float] = None
    custom_tariff_tnd: Optional[float] = None
    self_consumption_rate: float = 0.85


# ─────────────────────────────────────────────────────────────────────────────
# Health & Status Check
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/roof/health")
@router.get("/api/rooftop/health")
async def health_check():
    """Verify backend, SAM AI GPU engine, and U-Net model readiness."""
    sam_status = {"available": False}
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            resp = await client.get(f"{SAM_MICROSERVICE_URL}/health")
            if resp.status_code == 200:
                sam_status = resp.json()
                sam_status["available"] = True
    except Exception as e:
        sam_status = {"available": False, "error": str(e)}

    unet_status = {"available": False}
    try:
        model = get_model()
        meta = load_meta()
        unet_status = {
            "available": True,
            "architecture": "U-Net",
            "input_shape": [256, 256, 3],
            "metrics": meta.get("performance", {})
        }
    except Exception as e:
        unet_status = {"available": False, "error": str(e)}

    return {
        "status": "healthy" if (sam_status.get("available") or unet_status.get("available")) else "degraded",
        "sam_ai": sam_status,
        "unet_model": unet_status
    }


# ─────────────────────────────────────────────────────────────────────────────
# SAM AI Endpoints (with fallback to U-Net)
# ─────────────────────────────────────────────────────────────────────────────
@router.post("/roof/segment")
@router.post("/api/rooftop/segment")
async def segment_endpoint(req: SamSegmentRequest):
    """Segment rooftop with Meta SAM ViT-B on GPU (or U-Net fallback)."""
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(f"{SAM_MICROSERVICE_URL}/roof/segment", json=req.model_dump())
            if resp.status_code == 200:
                return resp.json()
            logger.warning(f"SAM service error ({resp.status_code}): {resp.text}")
    except Exception as e:
        logger.warning(f"SAM microservice connection failed ({e}), falling back to U-Net")

    # Fallback to local U-Net
    try:
        raw_b64 = req.image_b64
        if "," in raw_b64:
            raw_b64 = raw_b64.split(",")[1]
        img_bytes = base64.b64decode(raw_b64)
        unet_res = analyze_rooftop(image_bytes=img_bytes, target_panels=req.target_panels or 6)
        return {
            "status": "fallback_unet",
            "device": "cpu",
            "dimensions": [unet_res.get("metrics", {}).get("total_roof_area_m2", 50), 50],
            "total_masks": 1,
            "recommended_roof_mask_id": 0,
            "obstacles_detected": [],
            "masks": [{
                "id": 0,
                "area": 10000,
                "area_pct": 50.0,
                "bbox": [50, 50, 150, 150],
                "stability_score": 0.95,
                "predicted_iou": 0.90,
                "is_roof_candidate": True,
                "is_obstacle": False,
                "polygon": [[50, 50], [200, 50], [200, 200], [50, 200]]
            }],
            "overlay_b64": unet_res.get("images", {}).get("mask", ""),
            "processing_time_s": 0.8
        }
    except Exception as unet_err:
        raise HTTPException(500, f"Erreur de segmentation : {unet_err}")


@router.post("/roof/select-mask")
@router.post("/api/rooftop/select-mask")
async def select_mask_endpoint(req: SamSelectMaskRequest):
    """Interactive mask selection / toggle obstacle flag."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(f"{SAM_MICROSERVICE_URL}/roof/select-mask", json=req.model_dump())
            if resp.status_code == 200:
                return resp.json()
            raise HTTPException(resp.status_code, resp.text)
    except httpx.RequestError as e:
        raise HTTPException(503, f"SAM service non joignable: {e}")


@router.post("/roof/plan")
@router.post("/api/rooftop/plan")
async def plan_endpoint(req: SamPlanRequest):
    """Calepinage photovoltaïque automatique et rendu photoréaliste."""
    try:
        async with httpx.AsyncClient(timeout=45.0) as client:
            resp = await client.post(f"{SAM_MICROSERVICE_URL}/roof/plan", json=req.model_dump())
            if resp.status_code == 200:
                return resp.json()
            raise HTTPException(resp.status_code, resp.text)
    except httpx.RequestError as e:
        raise HTTPException(503, f"SAM placement engine non joignable: {e}")


@router.post("/roof/validate")
@router.post("/api/rooftop/validate")
async def validate_endpoint(req: SamValidateRequest):
    """Valide les contraintes physiques des panneaux placés manuellement."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(f"{SAM_MICROSERVICE_URL}/roof/validate", json=req.model_dump())
            if resp.status_code == 200:
                return resp.json()
            raise HTTPException(resp.status_code, resp.text)
    except httpx.RequestError as e:
        raise HTTPException(503, f"SAM service non joignable: {e}")


# ─────────────────────────────────────────────────────────────────────────────
# Deterministic Solar Sizing & Financial Endpoints
# ─────────────────────────────────────────────────────────────────────────────
@router.post("/solar/sizing")
@router.post("/api/solar/sizing")
def solar_sizing_endpoint(req: SolarSizingRequest):
    """Dimensionnement déterministe avec rendement régional PVGIS."""
    try:
        return calculate_solar_sizing(
            annual_kwh=req.annual_kwh,
            location=req.location,
            panel_wattage_w=req.panel_wattage_w,
            target_coverage=req.target_coverage
        )
    except Exception as e:
        raise HTTPException(500, f"Erreur calcul dimensionnement : {str(e)}")


@router.post("/solar/financial")
@router.post("/api/solar/financial")
def solar_financial_endpoint(req: SolarFinancialRequest):
    """Calcul de rentabilité financière, ROI et économies sur 25 ans."""
    try:
        kwp = req.installed_kwp if req.installed_kwp > 0 else 2.7
        nb_panels = max(2, round(kwp / 0.45))

        # 1. Estimation coût
        cost_info = estimate_installation_cost(
            installed_kwp=kwp,
            nb_panels=nb_panels,
            panel_wattage_w=450
        )
        total_inv = req.custom_cost_tnd or cost_info["net_total_tnd"]

        # 2. Production annuelle
        prod = req.annual_production_kwh
        if not prod or prod <= 0:
            yield_data = get_solar_yield(req.location)
            prod = kwp * yield_data["specific_yield_kwh_kwp"]

        # 3. Économies annuelles (valorisation au tarif basse tension ou custom)
        tariff = req.custom_tariff_tnd or 0.34
        annual_savings = round(prod * tariff * req.self_consumption_rate, 2)

        # 4. Calcul ROI
        roi_info = calculate_roi(
            total_investment_tnd=total_inv,
            annual_savings_tnd=annual_savings,
            bill_amount_annual_tnd=req.annual_bill_tnd
        )

        # 5. Projections cumulées sur 25 ans
        cashflow_25y = []
        cum = -total_inv
        for y in range(1, 26):
            cum += annual_savings * (1.04 ** (y - 1)) * (1 - (y - 1) * 0.005)
            cashflow_25y.append({"year": y, "net_cumulative_tnd": round(cum, 0)})

        return {
            "installed_kwp": kwp,
            "cost_breakdown": {
                "total_investment_tnd": cost_info["gross_total_tnd"],
                "modules_cost_tnd": cost_info["breakdown_tnd"]["panels"],
                "inverter_cost_tnd": cost_info["breakdown_tnd"]["inverter"],
                "mounting_cabling_cost_tnd": cost_info["breakdown_tnd"]["mounting_structure"] + cost_info["breakdown_tnd"]["electrical_safety_cables"],
                "labor_connection_cost_tnd": cost_info["breakdown_tnd"]["installation_admin_commissioning"],
                "anme_prosol_subsidy_tnd": cost_info["prosol_subsidy_tnd"],
                "net_investment_after_subsidy_tnd": total_inv,
            },
            "roi": {
                "investment_tnd": cost_info["gross_total_tnd"],
                "net_investment_tnd": total_inv,
                "annual_savings_tnd": annual_savings,
                "payback_years": roi_info["simple_payback_years"],
                "net_payback_years": roi_info["simple_payback_years"],
                "twenty_five_year_net_profit_tnd": roi_info["cumulative_net_savings_25y_tnd"],
                "co2_saved_tons_year": round(prod * 0.00065, 2),
                "cumulative_cashflow_25y": cashflow_25y,
                "zero_bill_warning": roi_info["zero_bill_warning"]
            },
        }
    except Exception as e:
        raise HTTPException(500, f"Erreur calcul financier : {str(e)}")


# ─────────────────────────────────────────────────────────────────────────────
# Existing U-Net & Manual Advisor Endpoints (Preserved for full compatibility)
# ─────────────────────────────────────────────────────────────────────────────
@router.post("/analyze")
@router.post("/api/rooftop/analyze")
async def analyze_endpoint(
    file: Optional[UploadFile] = File(None),
    data_json: Optional[str] = Form(None),
    declared_area_m2: Optional[float] = Form(None),
    target_panels: Optional[int] = Form(None),
):
    """Analyze rooftop image with real U-Net model. Supports both multipart and JSON."""
    try:
        image_bytes: bytes
        obstacles = None
        kwp = 0.40

        if file is not None:
            image_bytes = await file.read()
            if data_json:
                try:
                    payload = json.loads(data_json)
                    if declared_area_m2 is None:
                        declared_area_m2 = payload.get("declared_area_m2")
                    if target_panels is None:
                        target_panels = payload.get("target_panels")
                    obstacles = payload.get("obstacles")
                    kwp = payload.get("panel_power_kwp", 0.40)
                except Exception:
                    pass
        elif data_json:
            payload = json.loads(data_json)
            raw_b64 = payload.get("image_base64", "")
            if "," in raw_b64:
                raw_b64 = raw_b64.split(",")[1]
            image_bytes = base64.b64decode(raw_b64)
            declared_area_m2 = payload.get("declared_area_m2")
            target_panels = payload.get("target_panels")
            obstacles = payload.get("obstacles")
            kwp = payload.get("panel_power_kwp", 0.40)
        else:
            raise HTTPException(400, "Aucun fichier image ou base64 fourni.")

        result = analyze_rooftop(
            image_bytes=image_bytes,
            declared_area_m2=declared_area_m2,
            target_panels=target_panels,
            panel_power_kwp=kwp or 0.40,
            obstacles=obstacles
        )
        return result
    except Exception as e:
        raise HTTPException(500, f"Erreur lors de l'analyse U-Net : {str(e)}")

@router.post("/analyze-json")
@router.post("/api/rooftop/analyze-json")
def analyze_json_endpoint(req: AnalyzeJsonRequest):
    """Analyze rooftop from a direct JSON payload with base64 image."""
    try:
        raw_b64 = req.image_base64
        if "," in raw_b64:
            raw_b64 = raw_b64.split(",")[1]
        image_bytes = base64.b64decode(raw_b64)
        return analyze_rooftop(
            image_bytes=image_bytes,
            declared_area_m2=req.declared_area_m2,
            target_panels=req.target_panels,
            panel_power_kwp=req.panel_power_kwp or 0.40,
            obstacles=req.obstacles
        )
    except Exception as e:
        raise HTTPException(500, f"Erreur analyse JSON : {str(e)}")

@router.post("/advise")
@router.post("/api/rooftop/advise")
def advise_endpoint(req: AdviseRequest):
    """AI Advisor for manual mode: detects overlaps, boundary violations, and target balance."""
    import numpy as np
    from PIL import Image
    import io

    if req.mask_base64:
        raw_b64 = req.mask_base64
        if "," in raw_b64:
            raw_b64 = raw_b64.split(",")[1]
        mask_bytes = base64.b64decode(raw_b64)
        img = Image.open(io.BytesIO(mask_bytes)).convert("L")
        arr = np.array(img)
        mask = (arr > 100).astype(np.uint8)
    else:
        mask = np.zeros((256, 256), dtype=np.uint8)
        mask[25:230, 25:230] = 1

    return evaluate_manual_layout(
        panels=req.panels,
        mask=mask,
        target_panels=req.target_panels or 10,
        panel_power_kwp=req.panel_power_kwp or 0.40
    )

@router.get("/samples")
@router.get("/api/rooftop/samples")
def list_samples():
    """Returns bundled rooftop demonstration samples."""
    return {
        "samples": [
            {
                "id": "sample_villa",
                "label": "Villa Moderne — Toit Terrasse",
                "area_m2": 85,
                "recommended_panels": 12,
                "preview_url": "/api/rooftop/sample-preview/sample_villa"
            },
            {
                "id": "sample_sloped",
                "label": "Maison Individuelle — Double Pente",
                "area_m2": 65,
                "recommended_panels": 10,
                "preview_url": "/api/rooftop/sample-preview/sample_sloped"
            },
            {
                "id": "sample_commercial",
                "label": "Bâtiment Professionnel — Grande Surface",
                "area_m2": 180,
                "recommended_panels": 28,
                "preview_url": "/api/rooftop/sample-preview/sample_commercial"
            }
        ]
    }
