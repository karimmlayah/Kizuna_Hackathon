"""FastAPI Router for Smart Energy Monitoring, Live IoT, and Predictions."""
from __future__ import annotations
from typing import Optional, Any
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from ..services.iot_service import (
    get_live_energy_data,
    get_energy_history,
    calculate_consumption_prediction,
    get_user_objectives,
    update_user_objectives,
    get_alerts_history,
    mark_alert_read,
    record_alert
)

router = APIRouter(prefix="/api/iot", tags=["iot"])

class ObjectivesUpdateRequest(BaseModel):
    monthly_consumption_target_kwh: float
    monthly_budget_tnd: float
    monthly_solar_target_kwh: float
    reduction_target_pct: float = 15.0

class RecordAlertRequest(BaseModel):
    level: str  # 'green', 'orange', 'red'
    type: str
    title: str
    message: str

@router.get("/live")
def get_live():
    """Live instantaneous readings from ESP32 DevKit V1 (Mokxi / physical)."""
    try:
        return get_live_energy_data()
    except Exception as e:
        raise HTTPException(500, f"Erreur lecture temps réel IoT: {str(e)}")

@router.get("/history")
def get_history(
    range_type: str = Query("minute", pattern="^(second|minute|hour|day|week|month|year)$"),
    limit: int = Query(60, ge=1, le=1000)
):
    """Historical time-series aggregated by time bucket in Africa/Tunis."""
    try:
        return get_energy_history(range_type=range_type, limit=limit)
    except Exception as e:
        raise HTTPException(500, f"Erreur historique IoT: {str(e)}")

@router.get("/prediction")
def get_prediction(
    target_kwh: Optional[float] = None,
    current_kwh: Optional[float] = None,
    current_day: Optional[int] = None,
    total_days: Optional[int] = None
):
    """Deterministic Smart Consumption Prediction with proactive alert."""
    try:
        objectives = get_user_objectives()
        target = target_kwh if target_kwh is not None else objectives.get("monthly_consumption_target_kwh", 1200.0)
        curr = current_kwh if current_kwh is not None else 900.0

        res = calculate_consumption_prediction(
            monthly_target_kwh=target,
            current_consumption_kwh=curr,
            current_day=current_day,
            total_days_in_month=total_days
        )

        # Record proactive alert if overrun risk exists
        if res.get("is_overrun_risk"):
            record_alert(
                level=res["alert_level"],
                alert_type="overrun_risk",
                title=res["alert_title"],
                message=res["alert_message"]
            )

        return res
    except Exception as e:
        raise HTTPException(500, f"Erreur calcul prédiction: {str(e)}")

@router.get("/objectives")
def get_objectives():
    """Get active energy objectives."""
    try:
        return get_user_objectives()
    except Exception as e:
        raise HTTPException(500, f"Erreur lecture objectifs: {str(e)}")

@router.post("/objectives")
def set_objectives(req: ObjectivesUpdateRequest):
    """Update user energy objectives."""
    try:
        return update_user_objectives(
            consumption_target_kwh=req.monthly_consumption_target_kwh,
            budget_tnd=req.monthly_budget_tnd,
            solar_target_kwh=req.monthly_solar_target_kwh,
            reduction_pct=req.reduction_target_pct
        )
    except Exception as e:
        raise HTTPException(500, f"Erreur mise à jour objectifs: {str(e)}")

@router.get("/alerts")
def list_alerts(limit: int = 20):
    """Get smart alerts history."""
    try:
        return {"alerts": get_alerts_history(limit=limit)}
    except Exception as e:
        raise HTTPException(500, f"Erreur alertes: {str(e)}")

@router.post("/alerts/read/{alert_id}")
def mark_read(alert_id: int):
    """Mark an alert as read."""
    try:
        return mark_alert_read(alert_id)
    except Exception as e:
        raise HTTPException(500, f"Erreur acquittement alerte: {str(e)}")

@router.get("/summary")
def get_monitoring_summary():
    """Comprehensive summary payload for initial dashboard loading."""
    try:
        live = get_live_energy_data()
        objs = get_user_objectives()
        pred = calculate_consumption_prediction(
            monthly_target_kwh=objs.get("monthly_consumption_target_kwh", 1200.0),
            current_consumption_kwh=900.0  # reference baseline or store
        )
        alerts = get_alerts_history(limit=5)

        return {
            "live": live,
            "objectives": objs,
            "prediction": pred,
            "recent_alerts": alerts
        }
    except Exception as e:
        raise HTTPException(500, f"Erreur résumé monitoring: {str(e)}")
