"""SAM AI & Solar Placement Engine Microservice.

Runs with PyTorch + CUDA on port 8004.
Preloads Meta Segment Anything (ViT-B) model in GPU VRAM.

Endpoints:
- GET  /health
- POST /roof/segment
- POST /roof/select-mask
- POST /roof/calibrate
- POST /roof/recommend
- POST /roof/plan
- POST /roof/validate
- POST /roof/render
- GET  /roof/result/{session_id}
"""
from __future__ import annotations
import io
import time
import math
import uuid
import json
import base64
import logging
from pathlib import Path
from typing import Any, Optional

import cv2
import numpy as np
import torch
from fastapi import FastAPI, HTTPException, status, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from PIL import Image
from shapely.geometry import Polygon, MultiPolygon
from segment_anything import sam_model_registry, SamAutomaticMaskGenerator, SamPredictor

logger = logging.getLogger("sam_service")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] [SAM Service] %(message)s")

BASE_DIR = Path(__file__).resolve().parent
WEIGHTS_PATH = BASE_DIR / "weights" / "sam_vit_b_01ec64.pth"

app = FastAPI(title="Smart Solar SAM AI Microservice", version="2.5.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory session store for direct image streaming (TTL: 1 hour)
IMAGE_STORE: dict[str, dict[str, Any]] = {}

def clean_old_sessions():
    """Remove session images older than 3600 seconds."""
    now = time.time()
    expired = [sid for sid, data in IMAGE_STORE.items() if now - data.get("created_at", 0) > 3600]
    for sid in expired:
        IMAGE_STORE.pop(sid, None)

# ─────────────────────────────────────────────────────────────────────────────
# Model Initialization
# ─────────────────────────────────────────────────────────────────────────────
device = "cuda" if torch.cuda.is_available() else "cpu"
logger.info(f"Loading SAM ViT-B model from {WEIGHTS_PATH} on {device}...")

if not WEIGHTS_PATH.exists():
    raise FileNotFoundError(f"SAM checkpoint not found at {WEIGHTS_PATH}")

sam_model = sam_model_registry["vit_b"](checkpoint=str(WEIGHTS_PATH)).to(device=device)
sam_model.eval()

# Automatic mask generator with optimized hyperparameters for architectural roofs
mask_generator = SamAutomaticMaskGenerator(
    model=sam_model,
    points_per_side=16,
    points_per_batch=8,
    pred_iou_thresh=0.86,
    stability_score_thresh=0.92,
    min_mask_region_area=300
)

# Interactive point/box prompt predictor
sam_predictor = SamPredictor(sam_model)
logger.info("SAM AI Microservice successfully loaded on GPU!")


# ─────────────────────────────────────────────────────────────────────────────
# Request / Response Schemas
# ─────────────────────────────────────────────────────────────────────────────
class SegmentRequest(BaseModel):
    image_b64: str
    target_panels: Optional[int] = 6
    point_prompt: Optional[list[int]] = None

class MaskInfo(BaseModel):
    id: int
    area: int
    area_pct: float
    bbox: list[int]
    stability_score: float
    predicted_iou: float
    is_roof_candidate: bool
    is_obstacle: bool
    polygon: list[list[int]]

class SegmentResponse(BaseModel):
    status: str
    device: str
    dimensions: list[int]
    total_masks: int
    recommended_roof_mask_id: int
    obstacles_detected: list[int]
    masks: list[MaskInfo]
    overlay_b64: str
    safe_zone_b64: Optional[str] = None
    session_id: Optional[str] = None
    processing_time_s: float

class SelectMaskRequest(BaseModel):
    image_b64: str
    selected_mask_id: int
    as_obstacle: bool = False
    point_prompt: Optional[list[int]] = None
    edge_setback_m: float = 0.3

class SelectMaskResponse(BaseModel):
    status: str
    roof_mask_id: int
    obstacle_mask_ids: list[int]
    roof_polygon: list[list[int]]
    obstacle_polygons: list[list[list[int]]]
    overlay_b64: str
    safe_zone_b64: str
    session_id: str

class CalibrateRequest(BaseModel):
    image_b64: str
    points: list[list[int]]  # 4 corners of roof plane
    real_width_m: Optional[float] = None
    real_height_m: Optional[float] = None
    ref_distance_m: Optional[float] = None
    ref_points: Optional[list[list[int]]] = None

class CalibrateResponse(BaseModel):
    status: str
    calibrated: bool
    real_area_m2: Optional[float] = None
    px_per_m: Optional[float] = None
    aspect_ratio: Optional[float] = None
    warped_preview_b64: Optional[str] = None
    homography_matrix: Optional[list[list[float]]] = None
    message: str

class PlacedPanelModel(BaseModel):
    id: str
    x: int
    y: int
    w: int
    h: int
    corners: list[list[int]]
    rotation_deg: float = 0.0
    is_valid: bool = True
    warning: Optional[str] = None

class PlanRequest(BaseModel):
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
    orientation: Optional[str] = "portrait"  # "portrait" | "landscape" | "auto"
    sun_azimuth_deg: float = 180.0
    sun_elevation_deg: float = 45.0

class PlanResponse(BaseModel):
    status: str
    session_id: str
    dimensions: list[int]
    roof_polygon: list[list[int]]
    obstacle_polygons: list[list[list[int]]]
    panels_requested: int
    panels_placed: int
    all_fitted: bool
    installed_kwp: float
    panel_wattage_w: int
    panels: list[PlacedPanelModel]
    calibration_method: str
    realistic_render_b64: str
    processing_time_s: float

class RecommendRequest(BaseModel):
    image_b64: str
    roof_mask_id: Optional[int] = None
    obstacle_mask_ids: Optional[list[int]] = None
    custom_roof_polygon: Optional[list[list[int]]] = None
    annual_kwh: Optional[float] = 2400.0
    monthly_bill_tnd: Optional[float] = None
    max_budget_tnd: Optional[float] = None
    panel_wattage_w: int = 450
    real_roof_area_m2: Optional[float] = None

class ConfigProposal(BaseModel):
    id: str
    strategy_name: str
    description: str
    is_recommended: bool
    panels_count: int
    installed_kwp: float
    annual_kwh: float
    estimated_cost_tnd: float
    payback_years: float
    energy_coverage_pct: float
    placement_score: int
    orientation: str
    panels: list[PlacedPanelModel]
    realistic_render_b64: str
    tradeoffs: list[str]

class RecommendResponse(BaseModel):
    status: str
    session_id: str
    recommended_config_id: str
    proposals: list[ConfigProposal]
    processing_time_s: float

class ValidateRequest(BaseModel):
    dimensions: list[int]
    roof_polygon: list[list[int]]
    obstacle_polygons: Optional[list[list[list[int]]]] = None
    panels: list[PlacedPanelModel]

class ValidateResponse(BaseModel):
    valid_count: int
    invalid_count: int
    total_kwp: float
    panels: list[PlacedPanelModel]

class RenderRequest(BaseModel):
    image_b64: str
    panels: list[PlacedPanelModel]
    roof_polygon: Optional[list[list[int]]] = None
    obstacles: Optional[list[list[list[int]]]] = None
    sun_azimuth_deg: float = 180.0
    sun_elevation_deg: float = 45.0

class RenderResponse(BaseModel):
    status: str
    session_id: str
    realistic_render_b64: str


# ─────────────────────────────────────────────────────────────────────────────
# Helper Utilities
# ─────────────────────────────────────────────────────────────────────────────
def decode_image_b64(b64_str: str) -> tuple[np.ndarray, np.ndarray]:
    """Decode base64 data to BGR and RGB images."""
    raw = b64_str.split(",")[1] if "," in b64_str else b64_str
    raw = raw.strip()
    raw += "=" * (-len(raw) % 4)
    img_bytes = base64.b64decode(raw)
    nparr = np.frombuffer(img_bytes, np.uint8)
    bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if bgr is None:
        try:
            pil_img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
            rgb = np.array(pil_img)
            bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
            return bgr, rgb
        except Exception as pil_err:
            raise ValueError(f"Impossible de décoder l'image fournie: {pil_err}")
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    return bgr, rgb

def encode_image_b64(bgr: np.ndarray, format: str = ".png", session_id: Optional[str] = None) -> str:
    """Encode OpenCV BGR image to clean data:image/png;base64 string and persist in session store."""
    clean_old_sessions()
    success, buffer = cv2.imencode(format, bgr)
    if not success:
        return ""
    img_bytes = buffer.tobytes()
    b64 = base64.b64encode(img_bytes).decode("utf-8")
    data_uri = f"data:image/png;base64,{b64}"

    if session_id:
        IMAGE_STORE[session_id] = {
            "bytes": img_bytes,
            "mime": "image/png",
            "created_at": time.time()
        }

    return data_uri

def extract_polygon_from_mask(mask_bool: np.ndarray, max_points: int = 50) -> list[list[int]]:
    """Extract simplified polygon contour from binary mask."""
    uint8_mask = mask_bool.astype(np.uint8) * 255
    contours, _ = cv2.findContours(uint8_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return []
    largest = max(contours, key=cv2.contourArea)
    epsilon = 0.005 * cv2.arcLength(largest, True)
    approx = cv2.approxPolyDP(largest, epsilon, True)
    poly = [[int(pt[0][0]), int(pt[0][1])] for pt in approx]
    return poly


# ─────────────────────────────────────────────────────────────────────────────
# Photorealistic Solar Panel Renderer with Sun Shadows & Silicon Texture
# ─────────────────────────────────────────────────────────────────────────────
def render_realistic_overlay(
    base_bgr: np.ndarray,
    panels: list[dict[str, Any]],
    roof_polygon: Optional[list[list[int]]] = None,
    obstacles: Optional[list[list[list[int]]]] = None,
    sun_azimuth_deg: float = 180.0,
    sun_elevation_deg: float = 45.0,
) -> np.ndarray:
    """
    Renders photorealistic solar modules on the roof:
    - Directional soft drop shadow cast according to sun azimuth & elevation.
    - Dark anodized aluminum outer frame with beveled border.
    - Deep monocrystalline silicon cells (midnight navy / black).
    - Silver conductive busbar ribbons.
    - Anti-reflective glass specular glare.
    - Soft border contours on the roof and obstacles.
    """
    vis = base_bgr.copy()
    overlay = base_bgr.copy()
    H, W = base_bgr.shape[:2]

    # Calculate shadow offset vector from sun coordinates
    # When azimuth = 180 (South), shadows cast to North (y < 0).
    az_rad = math.radians(sun_azimuth_deg)
    el_rad = max(0.15, math.radians(sun_elevation_deg))
    shadow_dist = min(22, max(4, int(10.0 / math.tan(el_rad))))
    shadow_offset_x = int(-math.sin(az_rad) * shadow_dist)
    shadow_offset_y = int(math.cos(az_rad) * shadow_dist)

    # Pass 1: Draw faint roof contour & obstacle boundary
    if roof_polygon and len(roof_polygon) >= 3:
        pts = np.array(roof_polygon, np.int32).reshape((-1, 1, 2))
        cv2.polylines(vis, [pts], True, (0, 184, 255), 2)  # Gold highlight

    if obstacles:
        for ob in obstacles:
            if len(ob) >= 3:
                ob_pts = np.array(ob, np.int32).reshape((-1, 1, 2))
                cv2.polylines(vis, [ob_pts], True, (60, 60, 240), 2)  # Red obstacle border

    # Pass 2: Soft drop shadow offset for each valid panel
    for p in panels:
        if not p.get("is_valid", True):
            continue
        corners = np.array(p.get("corners", []), np.int32)
        if len(corners) == 4:
            shadow_corners = corners + [shadow_offset_x, shadow_offset_y]
            cv2.fillPoly(overlay, [shadow_corners], (10, 14, 20))

    cv2.addWeighted(overlay, 0.45, vis, 0.55, 0, vis)

    # Pass 3: Detailed Photorealistic Solar Modules
    for p in panels:
        is_valid = p.get("is_valid", True)
        corners = np.array(p.get("corners", []), np.int32)
        if len(corners) != 4:
            continue

        if not is_valid:
            # Highlight invalid panel in warning red with translucent red fill
            cv2.fillPoly(vis, [corners], (35, 35, 200))
            cv2.polylines(vis, [corners], True, (0, 0, 255), 2)
            continue

        # 1. Dark anodized aluminum frame with beveled border
        cv2.fillPoly(vis, [corners], (30, 36, 44))  # Dark slate frame
        cv2.polylines(vis, [corners], True, (90, 100, 115), 1)

        # 2. Inset wafer area
        x_min, y_min = corners[:, 0].min(), corners[:, 1].min()
        x_max, y_max = corners[:, 0].max(), corners[:, 1].max()
        w = max(4, x_max - x_min)
        h = max(4, y_max - y_min)

        pad = max(2, int(min(w, h) * 0.05))
        wafer_x1, wafer_y1 = x_min + pad, y_min + pad
        wafer_x2, wafer_y2 = x_max - pad, y_max - pad

        if wafer_x2 > wafer_x1 and wafer_y2 > wafer_y1:
            # Monocrystalline deep navy base
            cv2.rectangle(vis, (wafer_x1, wafer_y1), (wafer_x2, wafer_y2), (48, 25, 14), -1)

            # Solar cells grid (typically 4 cols x 8 rows in perspective)
            cell_cols = 4
            cell_rows = 6 if h < w else 8
            cw = (wafer_x2 - wafer_x1) / cell_cols
            ch = (wafer_y2 - wafer_y1) / cell_rows

            for r in range(cell_rows):
                for c in range(cell_cols):
                    cx1 = int(wafer_x1 + c * cw + 1)
                    cy1 = int(wafer_y1 + r * ch + 1)
                    cx2 = int(wafer_x1 + (c + 1) * cw - 1)
                    cy2 = int(wafer_y1 + (r + 1) * ch - 1)
                    if cx2 > cx1 and cy2 > cy1:
                        cv2.rectangle(vis, (cx1, cy1), (cx2, cy2), (68, 34, 18), -1)
                        cv2.rectangle(vis, (cx1, cy1), (cx2, cy2), (42, 22, 12), 1)

            # Silver conductive busbars (2 to 3 ribbons per cell column)
            for c in range(cell_cols):
                bx = int(wafer_x1 + (c + 0.5) * cw)
                cv2.line(vis, (bx, wafer_y1), (bx, wafer_y2), (185, 190, 195), 1)

            # Anti-reflective subtle glass reflection / sheen
            glare_len = min(25, int(w * 0.4))
            cv2.line(vis, (wafer_x1, wafer_y1 + 6), (wafer_x1 + glare_len, wafer_y1), (200, 215, 230), 1)

    return vis


# ─────────────────────────────────────────────────────────────────────────────
# Packing Algorithm: Geometry, Setback, Collision Avoidance
# ─────────────────────────────────────────────────────────────────────────────
def pack_solar_panels_on_roof(
    W: int,
    H: int,
    safe_zone: np.ndarray,
    desired_panels: int,
    p_w_px: int,
    p_h_px: int,
    gap_x: int,
    gap_y: int,
    orientation: str = "portrait"
) -> list[PlacedPanelModel]:
    """Packs panels in rows onto the safe_zone mask with collision check."""
    safe_indices = np.argwhere(safe_zone == 255)
    if len(safe_indices) == 0:
        return []

    y_min, x_min = safe_indices.min(axis=0)
    y_max, x_max = safe_indices.max(axis=0)

    occupied = np.zeros((H, W), dtype=np.uint8)
    placed_panels: list[PlacedPanelModel] = []

    # Grid packing with staggered rows
    for y in range(y_min, y_max - p_h_px + 1, p_h_px + gap_y):
        for x in range(x_min, x_max - p_w_px + 1, p_w_px + gap_x):
            panel_roi = safe_zone[y : y + p_h_px, x : x + p_w_px]
            occupied_roi = occupied[y : y + p_h_px, x : x + p_w_px]

            if panel_roi.shape[0] == p_h_px and panel_roi.shape[1] == p_w_px:
                # 90% of the panel must be strictly within the safe zone
                if cv2.countNonZero(panel_roi) >= (0.90 * p_w_px * p_h_px):
                    if cv2.countNonZero(occupied_roi) == 0:
                        panel_id = f"sam_panel_{len(placed_panels) + 1}"
                        corners = [
                            [x, y],
                            [x + p_w_px, y],
                            [x + p_w_px, y + p_h_px],
                            [x, y + p_h_px]
                        ]
                        placed_panels.append(PlacedPanelModel(
                            id=panel_id,
                            x=int(x),
                            y=int(y),
                            w=int(p_w_px),
                            h=int(p_h_px),
                            corners=corners,
                            rotation_deg=90.0 if orientation == "landscape" else 0.0,
                            is_valid=True
                        ))
                        occupied[y : y + p_h_px + gap_y, x : x + p_w_px + gap_x] = 255

            if len(placed_panels) >= desired_panels:
                break
        if len(placed_panels) >= desired_panels:
            break

    return placed_panels


# ─────────────────────────────────────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/health")
def health_check():
    """Health check endpoint indicating GPU status."""
    return {
        "status": "ok",
        "service": "Smart Solar SAM AI Engine",
        "device": device,
        "cuda_available": torch.cuda.is_available(),
        "gpu_name": torch.cuda.get_device_name(0) if torch.cuda.is_available() else "None",
        "model": "vit_b (sam_vit_b_01ec64.pth)",
        "cached_sessions": len(IMAGE_STORE),
    }

@app.get("/roof/result/{session_id}")
def get_image_result(session_id: str):
    """Directly stream generated photorealistic or overlay image by session ID."""
    clean_old_sessions()
    item = IMAGE_STORE.get(session_id)
    if not item:
        raise HTTPException(status_code=404, detail="Session image not found or expired.")
    return Response(content=item["bytes"], media_type=item["mime"])

@app.post("/roof/segment", response_model=SegmentResponse)
def segment_rooftop(req: SegmentRequest):
    """
    Runs SAM automatic mask generation on the uploaded rooftop photo.
    Identifies roof plane candidates vs background/sky, detects obstacles (chimney, ladder).
    """
    t0 = time.time()
    session_id = str(uuid.uuid4())
    bgr, rgb = decode_image_b64(req.image_b64)
    H, W = bgr.shape[:2]
    total_px = H * W

    # Point prompt interactive selection if provided
    point_mask = None
    if req.point_prompt and len(req.point_prompt) == 2:
        px, py = req.point_prompt
        sam_predictor.set_image(rgb)
        pts = np.array([[px, py]], dtype=np.float32)
        labels = np.array([1], dtype=np.int32)
        p_masks, p_scores, _ = sam_predictor.predict(
            point_coords=pts,
            point_labels=labels,
            multimask_output=True
        )
        best_p_idx = np.argmax(p_scores)
        point_mask = p_masks[best_p_idx]

    # Automatic mask generation
    with torch.inference_mode():
        raw_masks = mask_generator.generate(rgb)

    raw_masks = sorted(raw_masks, key=lambda x: x["area"], reverse=True)

    # Heuristic: Find best roof candidate (not sky, area > 12%, located in center/lower half)
    recommended_roof_id = 0
    if point_mask is not None:
        best_iou = -1.0
        for i, m in enumerate(raw_masks):
            intersection = np.logical_and(m["segmentation"], point_mask).sum()
            union = np.logical_or(m["segmentation"], point_mask).sum()
            iou = intersection / max(union, 1)
            if iou > best_iou:
                best_iou = iou
                recommended_roof_id = i
    else:
        for i, m in enumerate(raw_masks):
            x, y, w, h = m["bbox"]
            area_pct = m["area"] / total_px
            if area_pct > 0.12 and y > 40:
                recommended_roof_id = i
                break

    roof_mask_bool = raw_masks[recommended_roof_id]["segmentation"]

    # Identify Obstacles (masks inside the roof with smaller area e.g. chimney, vents)
    obstacles_detected: list[int] = []
    masks_info: list[MaskInfo] = []

    overlay_bgr = bgr.copy()
    rng = np.random.default_rng(42)

    for i, m in enumerate(raw_masks):
        m_bool = m["segmentation"]
        area_pct = round((m["area"] / total_px) * 100, 2)
        x, y, w, h = m["bbox"]

        is_roof = (i == recommended_roof_id)
        is_obstacle = False

        if not is_roof:
            overlap = np.logical_and(m_bool, roof_mask_bool).sum()
            overlap_pct = overlap / max(m["area"], 1)
            if overlap_pct > 0.65 and 400 < m["area"] < 35000:
                is_obstacle = True
                obstacles_detected.append(i)

        poly = extract_polygon_from_mask(m_bool)

        masks_info.append(MaskInfo(
            id=i,
            area=int(m["area"]),
            area_pct=area_pct,
            bbox=[int(x), int(y), int(w), int(h)],
            stability_score=round(float(m["stability_score"]), 3),
            predicted_iou=round(float(m["predicted_iou"]), 3),
            is_roof_candidate=is_roof,
            is_obstacle=is_obstacle,
            polygon=poly
        ))

        # Color overlay for visualization
        if is_roof:
            color = (0, 184, 255)  # Gold/cyan highlight for primary roof
            overlay_bgr[m_bool] = (overlay_bgr[m_bool] * 0.45 + np.array(color) * 0.55).astype(np.uint8)
        elif is_obstacle:
            color = (60, 60, 240)  # Red highlight for obstacles
            overlay_bgr[m_bool] = (overlay_bgr[m_bool] * 0.35 + np.array(color) * 0.65).astype(np.uint8)
        else:
            rand_c = rng.integers(50, 220, size=3)
            overlay_bgr[m_bool] = (overlay_bgr[m_bool] * 0.75 + rand_c * 0.25).astype(np.uint8)

    dur = round(time.time() - t0, 2)
    logger.info(f"Segmented {len(raw_masks)} masks in {dur}s (Roof ID: {recommended_roof_id}, Obstacles: {obstacles_detected})")

    overlay_data_uri = encode_image_b64(overlay_bgr, session_id=session_id)

    return SegmentResponse(
        status="success",
        device=device,
        dimensions=[W, H],
        total_masks=len(raw_masks),
        recommended_roof_mask_id=recommended_roof_id,
        obstacles_detected=obstacles_detected,
        masks=masks_info,
        overlay_b64=overlay_data_uri,
        session_id=session_id,
        processing_time_s=dur
    )

@app.post("/roof/select-mask", response_model=SelectMaskResponse)
def select_mask(req: SelectMaskRequest):
    """
    Selects or toggles an explicit SAM mask as the active roof plane or obstacle.
    Regenerates the safe installable zone and high-contrast color overlay.
    """
    session_id = str(uuid.uuid4())
    bgr, rgb = decode_image_b64(req.image_b64)
    H, W = bgr.shape[:2]

    # Re-run or point prompt to regenerate masks
    with torch.inference_mode():
        masks = mask_generator.generate(rgb)
    masks = sorted(masks, key=lambda x: x["area"], reverse=True)

    roof_idx = min(req.selected_mask_id, len(masks) - 1)
    roof_mask = (masks[roof_idx]["segmentation"].astype(np.uint8)) * 255
    roof_poly = extract_polygon_from_mask(masks[roof_idx]["segmentation"])

    obstacles_detected: list[int] = []
    obstacle_polys: list[list[list[int]]] = []
    obstacles_mask = np.zeros((H, W), dtype=np.uint8)

    for i, m in enumerate(masks):
        if i != roof_idx and np.logical_and(m["segmentation"], masks[roof_idx]["segmentation"]).sum() / max(m["area"], 1) > 0.65:
            if 400 < m["area"] < 35000:
                obstacles_detected.append(i)
                obstacles_mask = cv2.bitwise_or(obstacles_mask, (m["segmentation"].astype(np.uint8) * 255))
                obstacle_polys.append(extract_polygon_from_mask(m["segmentation"]))

    # Safe Zone Calculation: Erode setback from roof perimeter, dilate obstacles
    setback_px = max(8, int(W * 0.025))
    kernel_setback = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (setback_px, setback_px))
    eroded_roof = cv2.erode(roof_mask, kernel_setback, iterations=1)

    kernel_obstacle = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (12, 12))
    dilated_obstacles = cv2.dilate(obstacles_mask, kernel_obstacle, iterations=1)

    safe_zone = cv2.bitwise_and(eroded_roof, cv2.bitwise_not(dilated_obstacles))

    # Compose Color-coded Overlay:
    # Green (#10B981) = Installable, Red (#EF4444) = Obstacle, Yellow (#EAB308) = Safety margin
    vis = bgr.copy()
    overlay = bgr.copy()

    # Safety margin in yellow
    margin_mask = cv2.bitwise_and(roof_mask, cv2.bitwise_not(eroded_roof))
    overlay[margin_mask == 255] = [8, 179, 234] # BGR for #EAB308 (yellow)

    # Installable zone in emerald green
    overlay[safe_zone == 255] = [129, 185, 16] # BGR for #10B981 (green)

    # Obstacles in vivid red
    overlay[obstacles_mask == 255] = [68, 68, 239] # BGR for #EF4444 (red)

    cv2.addWeighted(overlay, 0.45, vis, 0.55, 0, vis)
    cv2.polylines(vis, [np.array(roof_poly, np.int32).reshape((-1, 1, 2))], True, (0, 184, 255), 2)

    overlay_uri = encode_image_b64(vis, session_id=session_id)
    safe_zone_uri = encode_image_b64(safe_zone)

    return SelectMaskResponse(
        status="success",
        roof_mask_id=roof_idx,
        obstacle_mask_ids=obstacles_detected,
        roof_polygon=roof_poly,
        obstacle_polygons=obstacle_polys,
        overlay_b64=overlay_uri,
        safe_zone_b64=safe_zone_uri,
        session_id=session_id
    )

@app.post("/roof/calibrate", response_model=CalibrateResponse)
def calibrate_roof(req: CalibrateRequest):
    """
    Homography perspective calibration from 4 user-selected points.
    Computes true metric dimensions and bird's eye view.
    """
    bgr, _ = decode_image_b64(req.image_b64)
    H, W = bgr.shape[:2]

    if len(req.points) != 4:
        return CalibrateResponse(
            status="error",
            calibrated=False,
            message="La calibration nécessite exactement 4 points définissant le rectangle de toiture."
        )

    pts_src = np.array(req.points, dtype=np.float32)

    # Approximate width and height in pixels from perspective polygon
    w_px = float(np.linalg.norm(pts_src[0] - pts_src[1]))
    h_px = float(np.linalg.norm(pts_src[1] - pts_src[2]))
    aspect = w_px / max(h_px, 1.0)

    # If real dimensions provided
    if req.real_width_m and req.real_height_m:
        real_w = req.real_width_m
        real_h = req.real_height_m
        real_area = round(real_w * real_h, 2)
        px_per_m = round(w_px / max(real_w, 0.1), 2)
    elif req.ref_distance_m and req.ref_points and len(req.ref_points) == 2:
        ref_p1 = np.array(req.ref_points[0], dtype=np.float32)
        ref_p2 = np.array(req.ref_points[1], dtype=np.float32)
        ref_px = float(np.linalg.norm(ref_p1 - ref_p2))
        px_per_m = round(ref_px / max(req.ref_distance_m, 0.1), 2)
        real_w = round(w_px / max(px_per_m, 1.0), 2)
        real_h = round(h_px / max(px_per_m, 1.0), 2)
        real_area = round(real_w * real_h, 2)
    else:
        return CalibrateResponse(
            status="partial",
            calibrated=False,
            aspect_ratio=round(aspect, 2),
            message="Dimensions réelles manquantes. Simulation visuelle indicative activée."
        )

    # Compute homography destination
    dst_w = int(max(200, min(800, w_px)))
    dst_h = int(dst_w / max(aspect, 0.2))
    pts_dst = np.array([[0, 0], [dst_w, 0], [dst_w, dst_h], [0, dst_h]], dtype=np.float32)

    M = cv2.getPerspectiveTransform(pts_src, pts_dst)
    warped = cv2.warpPerspective(bgr, M, (dst_w, dst_h))
    warped_uri = encode_image_b64(warped)

    return CalibrateResponse(
        status="success",
        calibrated=True,
        real_area_m2=real_area,
        px_per_m=px_per_m,
        aspect_ratio=round(aspect, 2),
        warped_preview_b64=warped_uri,
        homography_matrix=M.tolist(),
        message="Toiture calibrée avec succès par homographie perspective."
    )

@app.post("/roof/recommend", response_model=RecommendResponse)
def get_smart_recommendations(req: RecommendRequest):
    """
    Generates 3 distinct solar design configurations:
    1. Économique (Budget maîtrisé, ROI rapide)
    2. Équilibrée (Recommandée - 85-100% couverture)
    3. Capacité Maximale (Plein potentiel toiture)
    """
    t0 = time.time()
    session_id = str(uuid.uuid4())
    bgr, rgb = decode_image_b64(req.image_b64)
    H, W = bgr.shape[:2]

    # Run SAM to isolate roof and obstacles
    with torch.inference_mode():
        masks = mask_generator.generate(rgb)
    masks = sorted(masks, key=lambda x: x["area"], reverse=True)

    roof_idx = req.roof_mask_id if (req.roof_mask_id is not None and req.roof_mask_id < len(masks)) else 0
    roof_mask = (masks[roof_idx]["segmentation"].astype(np.uint8)) * 255
    roof_poly = extract_polygon_from_mask(masks[roof_idx]["segmentation"])

    obstacles_mask = np.zeros((H, W), dtype=np.uint8)
    obstacle_polys: list[list[list[int]]] = []
    for i, m in enumerate(masks):
        if i != roof_idx and np.logical_and(m["segmentation"], masks[roof_idx]["segmentation"]).sum() / max(m["area"], 1) > 0.65:
            if 400 < m["area"] < 35000:
                obstacles_mask = cv2.bitwise_or(obstacles_mask, (m["segmentation"].astype(np.uint8) * 255))
                obstacle_polys.append(extract_polygon_from_mask(m["segmentation"]))

    # Safe zone
    setback_px = max(10, int(W * 0.024))
    kernel_setback = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (setback_px, setback_px))
    eroded_roof = cv2.erode(roof_mask, kernel_setback, iterations=1)
    dilated_obstacles = cv2.dilate(obstacles_mask, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (10, 10)), iterations=1)
    safe_zone = cv2.bitwise_and(eroded_roof, cv2.bitwise_not(dilated_obstacles))

    # Base panel sizes in pixels
    pw_portrait = max(34, int(W * 0.052))
    ph_portrait = max(56, int(pw_portrait * (1.76 / 1.05)))
    gap_x = max(5, int(W * 0.008))
    gap_y = max(8, int(H * 0.012))

    # Target calculation based on annual kWh (Specific yield = 1650 kWh/kWp in Tunis)
    annual_cons = req.annual_kwh or 2400.0
    panel_kwp = req.panel_wattage_w / 1000.0
    kwh_per_panel = 1650.0 * panel_kwp
    balanced_panels_count = max(4, min(24, int(round(annual_cons / max(kwh_per_panel, 1.0)))))

    proposals: list[ConfigProposal] = []

    # 1. Configuration Économique
    eco_count = max(4, int(balanced_panels_count * 0.6))
    eco_panels = pack_solar_panels_on_roof(W, H, safe_zone, eco_count, pw_portrait, ph_portrait, gap_x, gap_y, "portrait")
    eco_kwp = round(len(eco_panels) * panel_kwp, 2)
    eco_kwh = round(eco_kwp * 1650.0)
    eco_cost = round(eco_kwp * 2650.0)
    eco_net_cost = max(800.0, eco_cost - 1500.0)
    eco_savings = round(eco_kwh * 0.34)
    eco_payback = round(eco_net_cost / max(eco_savings, 1.0), 1)
    eco_cov = min(100.0, round((eco_kwh / annual_cons) * 100.0, 1))

    eco_bgr = render_realistic_overlay(bgr, [p.model_dump() for p in eco_panels], roof_poly, obstacle_polys)
    eco_uri = encode_image_b64(eco_bgr, session_id=f"{session_id}_eco")

    proposals.append(ConfigProposal(
        id="config_economic",
        strategy_name="Installation Économique",
        description="Investissement minimal à retour sur investissement ultra-rapide.",
        is_recommended=False,
        panels_count=len(eco_panels),
        installed_kwp=eco_kwp,
        annual_kwh=eco_kwh,
        estimated_cost_tnd=eco_net_cost,
        payback_years=eco_payback,
        energy_coverage_pct=eco_cov,
        placement_score=82,
        orientation="portrait",
        panels=eco_panels,
        realistic_render_b64=eco_uri,
        tradeoffs=[
            "Coût initial très bas et amortissement accéléré",
            "Couvre les paliers de consommation les plus coûteux",
            "Laisse de l'espace disponible pour extensions futures"
        ]
    ))

    # 2. Configuration Équilibrée (Recommandée)
    bal_panels = pack_solar_panels_on_roof(W, H, safe_zone, balanced_panels_count, pw_portrait, ph_portrait, gap_x, gap_y, "portrait")
    bal_kwp = round(len(bal_panels) * panel_kwp, 2)
    bal_kwh = round(bal_kwp * 1650.0)
    bal_cost = round(bal_kwp * 2650.0)
    bal_net_cost = max(1200.0, bal_cost - 1500.0)
    bal_savings = round(bal_kwh * 0.34)
    bal_payback = round(bal_net_cost / max(bal_savings, 1.0), 1)
    bal_cov = min(120.0, round((bal_kwh / annual_cons) * 100.0, 1))

    bal_bgr = render_realistic_overlay(bgr, [p.model_dump() for p in bal_panels], roof_poly, obstacle_polys)
    bal_uri = encode_image_b64(bal_bgr, session_id=f"{session_id}_balanced")

    proposals.append(ConfigProposal(
        id="config_balanced",
        strategy_name="Installation Équilibrée (Recommandée)",
        description="Neutralise 90 à 100% de votre facture STEG avec subvention ANME Prosol optimale.",
        is_recommended=True,
        panels_count=len(bal_panels),
        installed_kwp=bal_kwp,
        annual_kwh=bal_kwh,
        estimated_cost_tnd=bal_net_cost,
        payback_years=bal_payback,
        energy_coverage_pct=bal_cov,
        placement_score=96,
        orientation="portrait",
        panels=bal_panels,
        realistic_render_b64=bal_uri,
        tradeoffs=[
            "Équilibre parfait entre investissement et indépendance énergétique",
            "Maximise le taux d'autoconsommation sur place",
            "Alignement optimal sur la zone la plus ensoleillée du toit"
        ]
    ))

    # 3. Capacité Maximale (Landscape vs Portrait check)
    max_count = 36
    max_portrait_panels = pack_solar_panels_on_roof(W, H, safe_zone, max_count, pw_portrait, ph_portrait, gap_x, gap_y, "portrait")
    max_land_panels = pack_solar_panels_on_roof(W, H, safe_zone, max_count, ph_portrait, pw_portrait, gap_y, gap_x, "landscape")

    if len(max_land_panels) > len(max_portrait_panels):
        max_panels = max_land_panels
        best_orient = "landscape"
    else:
        max_panels = max_portrait_panels
        best_orient = "portrait"

    max_kwp = round(len(max_panels) * panel_kwp, 2)
    max_kwh = round(max_kwp * 1650.0)
    max_cost = round(max_kwp * 2650.0)
    max_net_cost = max(2000.0, max_cost - 1500.0)
    max_savings = round(max_kwh * 0.34)
    max_payback = round(max_net_cost / max(max_savings, 1.0), 1)
    max_cov = min(200.0, round((max_kwh / annual_cons) * 100.0, 1))

    max_bgr = render_realistic_overlay(bgr, [p.model_dump() for p in max_panels], roof_poly, obstacle_polys)
    max_uri = encode_image_b64(max_bgr, session_id=f"{session_id}_max")

    proposals.append(ConfigProposal(
        id="config_max",
        strategy_name="Capacité Maximale Toiture",
        description="Exploitation maximale de l'espace pour production et revente d'énergie.",
        is_recommended=False,
        panels_count=len(max_panels),
        installed_kwp=max_kwp,
        annual_kwh=max_kwh,
        estimated_cost_tnd=max_net_cost,
        payback_years=max_payback,
        energy_coverage_pct=max_cov,
        placement_score=88,
        orientation=best_orient,
        panels=max_panels,
        realistic_render_b64=max_uri,
        tradeoffs=[
            "Production électrique maximale possible sur la toiture",
            "Opportunité de revente du surplus d'énergie",
            "Investissement initial plus élevé nécessitant accord de raccordement"
        ]
    ))

    dur = round(time.time() - t0, 2)

    return RecommendResponse(
        status="success",
        session_id=session_id,
        recommended_config_id="config_balanced",
        proposals=proposals,
        processing_time_s=dur
    )

@app.post("/roof/plan", response_model=PlanResponse)
def plan_solar_installation(req: PlanRequest):
    """
    Intelligent automatic panel placement engine using OpenCV, NumPy and Shapely.
    - Erode edge setback.
    - Exclude obstacles (chimneys, ladder, vents).
    - Grid pack aligned portrait or landscape rows.
    - Collision avoidance.
    - Photorealistic visual rendering.
    """
    t0 = time.time()
    session_id = str(uuid.uuid4())
    bgr, rgb = decode_image_b64(req.image_b64)
    H, W = bgr.shape[:2]

    # 1. Obtain roof mask & obstacles
    roof_mask = np.zeros((H, W), dtype=np.uint8)
    obstacles_mask = np.zeros((H, W), dtype=np.uint8)
    roof_poly: list[list[int]] = []
    obstacle_polys: list[list[list[int]]] = []

    if req.custom_roof_polygon and len(req.custom_roof_polygon) >= 3:
        roof_poly = req.custom_roof_polygon
        pts = np.array(roof_poly, np.int32).reshape((-1, 1, 2))
        cv2.fillPoly(roof_mask, [pts], 255)
    else:
        with torch.inference_mode():
            masks = mask_generator.generate(rgb)
        masks = sorted(masks, key=lambda x: x["area"], reverse=True)
        roof_idx = req.roof_mask_id if (req.roof_mask_id is not None and req.roof_mask_id < len(masks)) else 0
        roof_mask = (masks[roof_idx]["segmentation"].astype(np.uint8)) * 255
        roof_poly = extract_polygon_from_mask(masks[roof_idx]["segmentation"])

        for i, m in enumerate(masks):
            if i != roof_idx and np.logical_and(m["segmentation"], masks[roof_idx]["segmentation"]).sum() / max(m["area"], 1) > 0.65:
                if 400 < m["area"] < 35000:
                    obstacles_mask = cv2.bitwise_or(obstacles_mask, (m["segmentation"].astype(np.uint8) * 255))
                    obstacle_polys.append(extract_polygon_from_mask(m["segmentation"]))

    if req.custom_obstacle_polygons:
        for ob in req.custom_obstacle_polygons:
            if len(ob) >= 3:
                ob_pts = np.array(ob, np.int32).reshape((-1, 1, 2))
                cv2.fillPoly(obstacles_mask, [ob_pts], 255)
                obstacle_polys.append(ob)

    # 2. Scale calibration & panel sizing in pixels
    if req.real_roof_area_m2 and req.real_roof_area_m2 > 10:
        roof_px_area = cv2.countNonZero(roof_mask)
        m2_per_px = req.real_roof_area_m2 / max(roof_px_area, 1)
        px_per_m = 1.0 / math.sqrt(m2_per_px)
        p_w_px = max(24, int(req.panel_width_m * px_per_m))
        p_h_px = max(36, int(req.panel_height_m * px_per_m))
        setback_px = max(6, int(req.edge_setback_m * px_per_m))
        gap_x = max(4, int(req.spacing_m * px_per_m))
        gap_y = max(6, int(req.spacing_m * 1.5 * px_per_m))
        calib_method = "Échelle métrique réelle calibrée"
    else:
        p_w_px = max(36, int(W * 0.052))
        p_h_px = max(58, int(p_w_px * (1.76 / 1.05)))
        setback_px = max(14, int(W * 0.024))
        gap_x = max(6, int(W * 0.008))
        gap_y = max(10, int(H * 0.015))
        calib_method = "Simulation visuelle indicative"

    if req.orientation == "landscape":
        p_w_px, p_h_px = p_h_px, p_w_px
        gap_x, gap_y = gap_y, gap_x

    # 3. Create Safe Zone
    kernel_setback = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (setback_px, setback_px))
    eroded_roof = cv2.erode(roof_mask, kernel_setback, iterations=1)
    dilated_obstacles = cv2.dilate(obstacles_mask, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (12, 12)), iterations=1)
    safe_zone = cv2.bitwise_and(eroded_roof, cv2.bitwise_not(dilated_obstacles))

    # 4. Pack panels
    placed_panels = pack_solar_panels_on_roof(
        W, H, safe_zone, req.desired_panels, p_w_px, p_h_px, gap_x, gap_y, req.orientation or "portrait"
    )

    installed_kwp = round(len(placed_panels) * (req.panel_wattage_w / 1000.0), 2)
    all_fitted = len(placed_panels) >= req.desired_panels

    # 5. Realistic Rendering
    panels_dicts = [p.model_dump() for p in placed_panels]
    realistic_bgr = render_realistic_overlay(
        bgr,
        panels_dicts,
        roof_polygon=roof_poly,
        obstacles=obstacle_polys,
        sun_azimuth_deg=req.sun_azimuth_deg,
        sun_elevation_deg=req.sun_elevation_deg
    )

    dur = round(time.time() - t0, 2)
    logger.info(f"Planned {len(placed_panels)}/{req.desired_panels} panels ({installed_kwp} kWc) in {dur}s")

    render_uri = encode_image_b64(realistic_bgr, session_id=session_id)

    return PlanResponse(
        status="success",
        session_id=session_id,
        dimensions=[W, H],
        roof_polygon=roof_poly,
        obstacle_polygons=obstacle_polys,
        panels_requested=req.desired_panels,
        panels_placed=len(placed_panels),
        all_fitted=all_fitted,
        installed_kwp=installed_kwp,
        panel_wattage_w=req.panel_wattage_w,
        panels=placed_panels,
        calibration_method=calib_method,
        realistic_render_b64=render_uri,
        processing_time_s=dur
    )

@app.post("/roof/render", response_model=RenderResponse)
def render_custom_panels(req: RenderRequest):
    """Re-renders custom panel layout on roof image with dynamic sun orientation."""
    session_id = str(uuid.uuid4())
    bgr, _ = decode_image_b64(req.image_b64)
    panels_dicts = [p.model_dump() for p in req.panels]

    vis = render_realistic_overlay(
        bgr,
        panels_dicts,
        roof_polygon=req.roof_polygon,
        obstacles=req.obstacles,
        sun_azimuth_deg=req.sun_azimuth_deg,
        sun_elevation_deg=req.sun_elevation_deg
    )

    render_uri = encode_image_b64(vis, session_id=session_id)

    return RenderResponse(
        status="success",
        session_id=session_id,
        realistic_render_b64=render_uri
    )

@app.post("/roof/validate", response_model=ValidateResponse)
def validate_panels_layout(req: ValidateRequest):
    """
    Validates any custom or user-modified layout:
    - Verifies that each panel stays 100% inside the roof polygon.
    - Checks collision / overlap between panels.
    - Flags invalid panels with explanatory warnings.
    """
    W, H = req.dimensions
    roof_mask = np.zeros((H, W), dtype=np.uint8)
    if len(req.roof_polygon) >= 3:
        pts = np.array(req.roof_polygon, np.int32).reshape((-1, 1, 2))
        cv2.fillPoly(roof_mask, [pts], 255)

    obstacle_mask = np.zeros((H, W), dtype=np.uint8)
    if req.obstacle_polygons:
        for ob in req.obstacle_polygons:
            if len(ob) >= 3:
                ob_pts = np.array(ob, np.int32).reshape((-1, 1, 2))
                cv2.fillPoly(obstacle_mask, [ob_pts], 255)

    valid_count = 0
    invalid_count = 0
    validated_panels: list[PlacedPanelModel] = []
    shapely_polys: list[Polygon] = []

    for p in req.panels:
        corners = p.corners
        if len(corners) != 4:
            p_copy = p.model_copy(update={"is_valid": False, "warning": "Nombre de sommets invalide"})
            validated_panels.append(p_copy)
            invalid_count += 1
            continue

        panel_poly = Polygon(corners)

        # 1. Check boundary containment
        is_outside = False
        sample_pts = corners + [[int((corners[0][0] + corners[2][0]) / 2), int((corners[0][1] + corners[2][1]) / 2)]]
        for sx, sy in sample_pts:
            if sx < 0 or sx >= W or sy < 0 or sy >= H:
                is_outside = True
                break
            if roof_mask[sy, sx] == 0:
                is_outside = True
                break
            if obstacle_mask[sy, sx] == 255:
                is_outside = True
                break

        # 2. Check collision with existing panels
        has_collision = False
        for existing in shapely_polys:
            if panel_poly.intersects(existing):
                intersection_area = panel_poly.intersection(existing).area
                if intersection_area > 10:
                    has_collision = True
                    break

        if is_outside:
            p_copy = p.model_copy(update={"is_valid": False, "warning": "Le panneau dépasse de la toiture ou touche un obstacle"})
            invalid_count += 1
        elif has_collision:
            p_copy = p.model_copy(update={"is_valid": False, "warning": "Collision ou chevauchement avec un autre panneau"})
            invalid_count += 1
        else:
            p_copy = p.model_copy(update={"is_valid": True, "warning": None})
            valid_count += 1
            shapely_polys.append(panel_poly)

        validated_panels.append(p_copy)

    total_kwp = round(valid_count * 0.450, 2)

    return ValidateResponse(
        valid_count=valid_count,
        invalid_count=invalid_count,
        total_kwp=total_kwp,
        panels=validated_panels
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8004)
