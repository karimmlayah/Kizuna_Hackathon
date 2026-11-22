"""Rooftop Segmentation & Intelligent Solar Placement Service.

Integrates real U-Net model: unet_rooftop_best.keras
Geometric panel placement engine + Manual layout advisor.
"""
from __future__ import annotations
import os
import io
import json
import base64
from pathlib import Path
from typing import Any, Optional

import numpy as np
import cv2
from PIL import Image

from ..config import ROOFTOP_MODEL_PATH, ROOFTOP_META_PATH

# Global cached model and metadata
_model = None
_meta = None

def dice_coef(y_true, y_pred, smooth=1e-6):
    import tensorflow as tf
    y_true_f = tf.reshape(y_true, [-1])
    y_pred_f = tf.reshape(y_pred, [-1])
    intersection = tf.reduce_sum(y_true_f * y_pred_f)
    return (2.0 * intersection + smooth) / (
        tf.reduce_sum(y_true_f) + tf.reduce_sum(y_pred_f) + smooth
    )

def iou_metric(y_true, y_pred, smooth=1e-6):
    import tensorflow as tf
    y_pred = tf.cast(y_pred > 0.5, tf.float32)
    y_true_f = tf.reshape(y_true, [-1])
    y_pred_f = tf.reshape(y_pred, [-1])
    intersection = tf.reduce_sum(y_true_f * y_pred_f)
    union = tf.reduce_sum(y_true_f) + tf.reduce_sum(y_pred_f) - intersection
    return (intersection + smooth) / (union + smooth)

def load_meta() -> dict:
    global _meta
    if _meta is None:
        if ROOFTOP_META_PATH.exists():
            with open(ROOFTOP_META_PATH, "r", encoding="utf-8") as f:
                _meta = json.load(f)
        else:
            _meta = {
                "business_logic": {
                    "panel_dimensions_m": [1.0, 1.7],
                    "panel_area_m2": 1.7,
                    "panel_power_kwp": 0.40,
                    "annual_kwh_per_kwp": 1650,
                    "gsd_effective_m_per_px": 0.1406
                }
            }
    return _meta

def get_model():
    global _model
    if _model is None:
        import tensorflow as tf
        if not ROOFTOP_MODEL_PATH.exists():
            raise FileNotFoundError(f"Model not found at {ROOFTOP_MODEL_PATH}")
        _model = tf.keras.models.load_model(
            str(ROOFTOP_MODEL_PATH),
            custom_objects={"dice_coef": dice_coef, "iou_metric": iou_metric},
            compile=False,
        )
    return _model

IMG_SIZE = 256

def preprocess_image(image_bytes: bytes) -> tuple[np.ndarray, tuple[int, int]]:
    """Decode bytes, convert to RGB, resize to 256x256, normalize [0, 1]."""
    import tensorflow as tf
    try:
        img = Image.open(io.BytesIO(image_bytes))
    except Exception:
        # Fallback to OpenCV if PIL cannot identify format directly
        nparr = np.frombuffer(image_bytes, np.uint8)
        bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if bgr is not None:
            rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
            img = Image.fromarray(rgb)
        else:
            raise ValueError("Impossible d'identifier le format du fichier image.")

    if img.mode != "RGB":
        img = img.convert("RGB")
    orig_w, orig_h = img.size
    arr = np.array(img, dtype=np.float32)
    arr = tf.image.resize(arr, (IMG_SIZE, IMG_SIZE)).numpy()
    if arr.max() > 1.0:
        arr = arr / 255.0
    return np.expand_dims(arr, axis=0), (orig_w, orig_h)

def clean_mask(pred_mask: np.ndarray) -> np.ndarray:
    """Morphological CLOSE + OPEN with 5x5 ellipse kernel."""
    mask = (pred_mask > 0.5).astype(np.uint8)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
    return mask

def extract_contours(mask: np.ndarray) -> list[list[dict[str, float]]]:
    """Extract polygon contours from binary mask. Returns normalized coordinates."""
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    polygons = []
    H, W = mask.shape
    for cnt in contours:
        if cv2.contourArea(cnt) < 40:
            continue
        poly = []
        for pt in cnt:
            x, y = pt[0]
            poly.append({
                "x_px": int(x),
                "y_px": int(y),
                "x_pct": round(float(x) / W * 100, 2),
                "y_pct": round(float(y) / H * 100, 2),
            })
        if len(poly) >= 3:
            polygons.append(poly)
    return polygons

def np_to_b64_png(arr: np.ndarray) -> str:
    if arr.ndim == 2:
        img = Image.fromarray(arr, mode="L")
    else:
        img = Image.fromarray(arr, mode="RGB")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()

def grid_pack_panels(
    mask: np.ndarray,
    panel_h_px: int,
    panel_w_px: int,
    row_gap_px: int = 1,
    col_gap_px: int = 1,
    max_panels: Optional[int] = None
) -> list[dict[str, Any]]:
    H, W = mask.shape
    if panel_h_px > H or panel_w_px > W:
        return []

    placed = []
    occupied = np.zeros_like(mask, dtype=bool)
    step_y = panel_h_px + row_gap_px
    step_x = panel_w_px + col_gap_px

    for y in range(0, H - panel_h_px + 1, step_y):
        for x in range(0, W - panel_w_px + 1, step_x):
            if max_panels is not None and len(placed) >= max_panels:
                break
            region_mask = mask[y:y + panel_h_px, x:x + panel_w_px]
            region_occ = occupied[y:y + panel_h_px, x:x + panel_w_px]
            # Must be completely inside the safe roof mask and not overlapping
            if region_mask.all() and not region_occ.any():
                placed.append({
                    "id": f"p_{len(placed)+1}",
                    "y_px": int(y),
                    "x_px": int(x),
                    "w_px": int(panel_w_px),
                    "h_px": int(panel_h_px),
                    "x_pct": round(float(x) / W * 100, 2),
                    "y_pct": round(float(y) / H * 100, 2),
                    "w_pct": round(float(panel_w_px) / W * 100, 2),
                    "h_pct": round(float(panel_h_px) / H * 100, 2),
                    "rotation": 0,
                    "valid": True
                })
                # Mark occupied with gap
                y_end = min(H, y + step_y)
                x_end = min(W, x + step_x)
                occupied[y:y_end, x:x_end] = True
        if max_panels is not None and len(placed) >= max_panels:
            break

    return placed

def place_panels_geometric(
    mask: np.ndarray,
    gsd_m_per_px: float,
    panel_w_m: float = 1.0,
    panel_h_m: float = 1.7,
    edge_margin_m: float = 0.40,
    target_panels: Optional[int] = None,
    obstacles: Optional[list[dict]] = None
) -> dict[str, Any]:
    """Test portrait and landscape placements and generate ranked configurations."""
    margin_px = max(1, int(round(edge_margin_m / gsd_m_per_px)))
    kernel = cv2.getStructuringElement(
        cv2.MORPH_ELLIPSE, (margin_px * 2 + 1, margin_px * 2 + 1)
    )
    safe_mask = cv2.erode(mask.astype(np.uint8), kernel, iterations=1)

    # Apply obstacles if provided
    if obstacles:
        H, W = mask.shape
        for obs in obstacles:
            ox = int(obs.get("x_pct", 0) * W / 100)
            oy = int(obs.get("y_pct", 0) * H / 100)
            ow = int(obs.get("w_pct", 0) * W / 100)
            oh = int(obs.get("h_pct", 0) * H / 100)
            safe_mask[oy:min(H, oy + oh), ox:min(W, ox + ow)] = 0

    pw_px = max(2, int(round(panel_w_m / gsd_m_per_px)))
    ph_px = max(2, int(round(panel_h_m / gsd_m_per_px)))
    gap_px = max(1, int(round(0.08 / gsd_m_per_px)))

    # Portrait: height = ph, width = pw
    portrait_all = grid_pack_panels(safe_mask, ph_px, pw_px, gap_px, gap_px)
    # Landscape: height = pw, width = ph
    landscape_all = grid_pack_panels(safe_mask, pw_px, ph_px, gap_px, gap_px)

    # Fit target panels if specified
    if target_panels and target_panels > 0:
        portrait_target = grid_pack_panels(safe_mask, ph_px, pw_px, gap_px, gap_px, max_panels=target_panels)
        landscape_target = grid_pack_panels(safe_mask, pw_px, ph_px, gap_px, gap_px, max_panels=target_panels)
    else:
        portrait_target = portrait_all
        landscape_target = landscape_all

    # Primary recommendation: maximize panel fit or match target
    if len(portrait_all) >= len(landscape_all):
        primary_panels = portrait_target
        primary_orient = "portrait"
        alt_panels = landscape_target
        alt_orient = "landscape"
    else:
        primary_panels = landscape_target
        primary_orient = "landscape"
        alt_panels = portrait_target
        alt_orient = "portrait"

    return {
        "primary": {
            "orientation": primary_orient,
            "panels": primary_panels,
            "count": len(primary_panels),
            "max_possible": max(len(portrait_all), len(landscape_all)),
        },
        "alternative": {
            "orientation": alt_orient,
            "panels": alt_panels,
            "count": len(alt_panels),
            "max_possible": len(landscape_all) if alt_orient == "landscape" else len(portrait_all),
        },
        "max_capacity_portrait": len(portrait_all),
        "max_capacity_landscape": len(landscape_all),
    }

def analyze_rooftop(
    image_bytes: bytes,
    declared_area_m2: Optional[float] = None,
    target_panels: Optional[int] = None,
    panel_power_kwp: float = 0.40,
    obstacles: Optional[list[dict]] = None
) -> dict[str, Any]:
    """Full execution: preprocessing, U-Net inference, geometric placement, financial estimates."""
    meta = load_meta()
    biz = meta.get("business_logic", {})
    annual_kwh_per_kwp = biz.get("annual_kwh_per_kwp", 1650)
    panel_w_m, panel_h_m = biz.get("panel_dimensions_m", [1.0, 1.7])
    panel_area_m2 = panel_w_m * panel_h_m

    model = get_model()
    img_batch, orig_dims = preprocess_image(image_bytes)
    image_norm = img_batch[0]

    # Predict via U-Net
    pred_prob = model.predict(img_batch, verbose=0)[0, ..., 0]
    cleaned = clean_mask(pred_prob)

    # Compute GSD
    n_roof_pixels = int(cleaned.sum())
    if declared_area_m2 and declared_area_m2 > 5 and n_roof_pixels > 100:
        # Calibrated scale from user declared area
        pixel_area = declared_area_m2 / n_roof_pixels
        gsd_m_per_px = np.sqrt(pixel_area)
        total_roof_area_m2 = round(declared_area_m2, 1)
    else:
        gsd_m_per_px = biz.get("gsd_effective_m_per_px", 0.1406)
        total_roof_area_m2 = round(n_roof_pixels * (gsd_m_per_px ** 2), 1)

    usable_roof_area_m2 = round(total_roof_area_m2 * 0.70, 1)

    # Placement
    placement_results = place_panels_geometric(
        cleaned,
        gsd_m_per_px=gsd_m_per_px,
        panel_w_m=panel_w_m,
        panel_h_m=panel_h_m,
        target_panels=target_panels,
        obstacles=obstacles
    )

    primary = placement_results["primary"]
    placed_count = primary["count"]
    installed_kwp = round(placed_count * panel_power_kwp, 2)
    annual_prod_kwh = int(round(installed_kwp * annual_kwh_per_kwp))
    occupied_area_m2 = round(placed_count * panel_area_m2, 1)

    # Financial estimates (Tunisian Dinars: 0.35 TND/kWh savings, ~2400 TND/kWc turnkey cost)
    cost_tnd = int(round(installed_kwp * 2400))
    savings_tnd = int(round(annual_prod_kwh * 0.35))
    roi_years = round(cost_tnd / max(1, savings_tnd), 1) if savings_tnd > 0 else 0.0

    # Contours for vector rendering
    contours = extract_contours(cleaned)

    # Explanation string
    explanation = (
        f"L'analyse U-Net a détecté {total_roof_area_m2} m² de toiture exploitable. "
        f"La disposition en {primary['orientation']} optimise l'ensoleillement tout en respectant une marge de sécurité de 40 cm. "
        f"{placed_count} modules de {int(panel_power_kwp*1000)} W ({installed_kwp} kWc) s'intègrent sans chevauchement, "
        f"produisant environ {annual_prod_kwh:,} kWh/an.".replace(",", " ")
    )

    return {
        "status": "success",
        "metrics": {
            "total_roof_area_m2": total_roof_area_m2,
            "usable_roof_area_m2": usable_roof_area_m2,
            "occupied_area_m2": occupied_area_m2,
            "recommended_panels": target_panels or placed_count,
            "placed_panels": placed_count,
            "max_possible_panels": primary["max_possible"],
            "orientation": primary["orientation"],
            "installed_kwp": installed_kwp,
            "annual_production_kwh": annual_prod_kwh,
            "cost_tnd": cost_tnd,
            "annual_savings_tnd": savings_tnd,
            "roi_years": roi_years,
            "confidence": round(float(pred_prob[cleaned > 0].mean()) * 100, 1) if n_roof_pixels > 0 else 0.0,
        },
        "contours": contours,
        "primary_placement": primary["panels"],
        "alternative_placement": placement_results["alternative"]["panels"],
        "explanation": explanation,
        "images": {
            "mask": np_to_b64_png((cleaned * 255).astype(np.uint8)),
            "original_preview": np_to_b64_png((image_norm * 255).astype(np.uint8)),
        }
    }

def evaluate_manual_layout(
    panels: list[dict],
    mask: np.ndarray,
    target_panels: int = 10,
    panel_power_kwp: float = 0.40
) -> dict[str, Any]:
    """AI Advisor: Evaluates manual panel placement for overlaps, out-of-boundary, and energy coverage."""
    H, W = mask.shape
    suggestions = []
    invalid_panels = []
    overlapping_panels = set()

    # 1. Boundary check
    for p in panels:
        px = int(p.get("x_pct", 0) * W / 100)
        py = int(p.get("y_pct", 0) * H / 100)
        pw = int(p.get("w_pct", 10) * W / 100)
        ph = int(p.get("h_pct", 10) * H / 100)

        # Sample 5 points (4 corners + center)
        pts = [
            (px, py),
            (min(W-1, px + pw), py),
            (px, min(H-1, py + ph)),
            (min(W-1, px + pw), min(H-1, py + ph)),
            (min(W-1, px + pw//2), min(H-1, py + ph//2))
        ]
        inside_count = sum(1 for (x, y) in pts if 0 <= y < H and 0 <= x < W and mask[y, x] > 0)
        if inside_count < 3:
            invalid_panels.append(p.get("id"))

    if invalid_panels:
        suggestions.append({
            "type": "out_of_boundary",
            "message": f"{len(invalid_panels)} panneau(x) sont positionnés hors de la toiture détectée (marqués en rouge).",
            "affected_ids": invalid_panels
        })

    # 2. Overlap check
    for i in range(len(panels)):
        p1 = panels[i]
        x1, y1 = p1.get("x_pct", 0), p1.get("y_pct", 0)
        w1, h1 = p1.get("w_pct", 10), p1.get("h_pct", 10)
        for j in range(i + 1, len(panels)):
            p2 = panels[j]
            x2, y2 = p2.get("x_pct", 0), p2.get("y_pct", 0)
            w2, h2 = p2.get("w_pct", 10), p2.get("h_pct", 10)

            # Intersection test
            if not (x1 + w1 <= x2 or x2 + w2 <= x1 or y1 + h1 <= y2 or y2 + h2 <= y1):
                overlapping_panels.add(p1.get("id"))
                overlapping_panels.add(p2.get("id"))

    if overlapping_panels:
        suggestions.append({
            "type": "overlap",
            "message": f"Chevauchement détecté sur {len(overlapping_panels)} panneau(x). Maintenez un espacement minimal de 5 cm pour la ventilation.",
            "affected_ids": list(overlapping_panels)
        })

    # 3. Target comparison
    current_count = len(panels) - len(invalid_panels)
    if current_count < target_panels:
        diff = target_panels - current_count
        suggestions.append({
            "type": "under_capacity",
            "message": f"Votre dimensionnement recommande {target_panels} panneaux. Vous pouvez ajouter {diff} panneau(x) pour couvrir 100 % de votre besoin.",
            "recommended_add": diff
        })
    elif current_count > target_panels:
        suggestions.append({
            "type": "over_capacity",
            "message": f"Vous avez placé {current_count} panneaux valides, ce qui dépasse l'objectif d'autoconsommation ({target_panels} panneaux). Le surplus sera réinjecté au réseau.",
            "extra_panels": current_count - target_panels
        })
    else:
        suggestions.append({
            "type": "optimal_count",
            "message": f"Configuration idéale : les {current_count} panneaux couvrent exactement vos besoins énergétiques annuels.",
        })

    total_kwp = round(current_count * panel_power_kwp, 2)
    annual_kwh = int(round(total_kwp * 1650))
    savings_tnd = int(round(annual_kwh * 0.35))

    return {
        "valid_count": current_count,
        "total_count": len(panels),
        "invalid_panels": invalid_panels,
        "overlapping_panels": list(overlapping_panels),
        "installed_kwp": total_kwp,
        "annual_kwh": annual_kwh,
        "annual_savings_tnd": savings_tnd,
        "suggestions": suggestions
    }
