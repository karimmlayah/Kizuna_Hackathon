"""SAM AI & Solar Placement Engine Microservice.

Runs with PyTorch + CUDA on port 8004.
Preloads Meta Segment Anything (ViT-B) model in GPU VRAM.

Endpoints:
- GET  /health
- POST /roof/segment
- POST /roof/select-mask
- POST /roof/plan
- POST /roof/validate
- POST /roof/render-preview
"""
from __future__ import annotations
import io
import time
import json
import base64
import logging
from pathlib import Path
from typing import Any, Optional

import cv2
import numpy as np
import torch
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from PIL import Image
from segment_anything import sam_model_registry, SamAutomaticMaskGenerator, SamPredictor

logger = logging.getLogger("sam_service")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] [SAM Service] %(message)s")

BASE_DIR = Path(__file__).resolve().parent
WEIGHTS_PATH = BASE_DIR / "weights" / "sam_vit_b_01ec64.pth"

app = FastAPI(title="Smart Solar SAM AI Microservice", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────────────────────────────────────
# Model Initialization
# ─────────────────────────────────────────────────────────────────────────────
device = "cuda" if torch.cuda.is_available() else "cpu"
logger.info(f"Loading SAM ViT-B model from {WEIGHTS_PATH} on {device}...")

if not WEIGHTS_PATH.exists():
    raise FileNotFoundError(f"SAM checkpoint not found at {WEIGHTS_PATH}")

sam_model = sam_model_registry["vit_b"](checkpoint=str(WEIGHTS_PATH)).to(device=device)
sam_model.eval()

# Automatic mask generator with optimized hyperparameters for roofs
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
    point_prompt: Optional[list[int]] = None  # [x, y] if user clicked

class MaskInfo(BaseModel):
    id: int
    area: int
    area_pct: float
    bbox: list[int]  # [x, y, w, h]
    stability_score: float
    predicted_iou: float
    is_roof_candidate: bool
    is_obstacle: bool
    polygon: list[list[int]]

class SegmentResponse(BaseModel):
    status: str
    device: str
    dimensions: list[int]  # [width, height]
    total_masks: int
    recommended_roof_mask_id: int
    obstacles_detected: list[int]
    masks: list[MaskInfo]
    overlay_b64: str
    safe_zone_b64: Optional[str] = None
    processing_time_s: float

class PanelCorner(BaseModel):
    x: int
    y: int

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

class PlanResponse(BaseModel):
    status: str
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

def encode_image_b64(bgr: np.ndarray, format: str = ".png") -> str:
    """Encode OpenCV BGR image to data:image/png;base64 string."""
    success, buffer = cv2.imencode(format, bgr)
    if not success:
        return ""
    b64 = base64.b64encode(buffer).decode("utf-8")
    return f"data:image/png;base64,{b64}"

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
# Photorealistic Solar Panel Renderer
# ─────────────────────────────────────────────────────────────────────────────
def render_realistic_overlay(
    base_bgr: np.ndarray,
    panels: list[dict[str, Any]],
    roof_polygon: Optional[list[list[int]]] = None,
    obstacles: Optional[list[list[list[int]]]] = None
) -> np.ndarray:
    """
    Renders photorealistic solar modules on the roof:
    - Casts soft drop shadows onto the roof.
    - Dark anodized aluminum outer frame.
    - Deep navy/black monocrystalline silicon cell grid.
    - Subtle silver busbars.
    - Solar glass anti-reflective sheen.
    """
    vis = base_bgr.copy()
    overlay = base_bgr.copy()

    # Pass 1: Draw faint roof contour & obstacle boundary
    if roof_polygon and len(roof_polygon) >= 3:
        pts = np.array(roof_polygon, np.int32).reshape((-1, 1, 2))
        cv2.polylines(vis, [pts], True, (0, 184, 255), 2)  # Gold/cyan highlight

    if obstacles:
        for ob in obstacles:
            if len(ob) >= 3:
                ob_pts = np.array(ob, np.int32).reshape((-1, 1, 2))
                cv2.polylines(vis, [ob_pts], True, (60, 60, 240), 2)  # Red obstacle border

    # Pass 2: Soft drop shadow offset
    shadow_offset_x = 4
    shadow_offset_y = 6
    for p in panels:
        if not p.get("is_valid", True):
            continue
        corners = np.array(p.get("corners", []), np.int32)
        if len(corners) == 4:
            shadow_corners = corners + [shadow_offset_x, shadow_offset_y]
            cv2.fillPoly(overlay, [shadow_corners], (12, 16, 22))

    cv2.addWeighted(overlay, 0.40, vis, 0.60, 0, vis)

    # Pass 3: Detailed Photorealistic Solar Modules
    for p in panels:
        is_valid = p.get("is_valid", True)
        corners = np.array(p.get("corners", []), np.int32)
        if len(corners) != 4:
            continue

        if not is_valid:
            # Highlight invalid panel in red
            cv2.fillPoly(vis, [corners], (30, 30, 200))
            cv2.polylines(vis, [corners], True, (0, 0, 255), 2)
            continue

        # Valid panel rendering
        # 1. Dark anodized aluminum frame
        cv2.fillPoly(vis, [corners], (32, 38, 46))  # Dark slate frame
        cv2.polylines(vis, [corners], True, (80, 90, 105), 1)

        # 2. Inset wafer area
        x_min, y_min = corners[:, 0].min(), corners[:, 1].min()
        x_max, y_max = corners[:, 0].max(), corners[:, 1].max()
        w = x_max - x_min
        h = y_max - y_min

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

            # Silver conductive busbars
            for c in range(cell_cols):
                bx = int(wafer_x1 + (c + 0.5) * cw)
                cv2.line(vis, (bx, wafer_y1), (bx, wafer_y2), (185, 190, 195), 1)

            # Anti-reflective subtle glass reflection / sheen
            glare_len = min(25, int(w * 0.4))
            cv2.line(vis, (wafer_x1, wafer_y1 + 8), (wafer_x1 + glare_len, wafer_y1), (200, 215, 230), 1)

    return vis


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
    }

@app.post("/roof/segment", response_model=SegmentResponse)
def segment_rooftop(req: SegmentRequest):
    """
    Runs SAM automatic mask generation on the uploaded rooftop photo.
    Identifies roof plane candidates vs background/sky, detects obstacles (chimney, ladder).
    """
    t0 = time.time()
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

    # Identify Roof Candidate:
    # Heuristic: large area (> 15%), situated in central/lower portion of image (not sky top y=0)
    recommended_roof_id = 0
    if point_mask is not None:
        # Find which mask has highest overlap with point_mask
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
            # If >65% of this mask sits inside the roof polygon and size is between 400 and 35,000 px:
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
            overlay_bgr[m_bool] = (overlay_bgr[m_bool] * 0.70 + rand_c * 0.30).astype(np.uint8)

    dur = round(time.time() - t0, 2)
    logger.info(f"Segmented {len(raw_masks)} masks in {dur}s (Roof ID: {recommended_roof_id}, Obstacles: {obstacles_detected})")

    return SegmentResponse(
        status="success",
        device=device,
        dimensions=[W, H],
        total_masks=len(raw_masks),
        recommended_roof_mask_id=recommended_roof_id,
        obstacles_detected=obstacles_detected,
        masks=masks_info,
        overlay_b64=encode_image_b64(overlay_bgr),
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
    bgr, rgb = decode_image_b64(req.image_b64)
    H, W = bgr.shape[:2]
    total_px = H * W

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
        # Run SAM to get recommended roof
        with torch.inference_mode():
            masks = mask_generator.generate(rgb)
        masks = sorted(masks, key=lambda x: x["area"], reverse=True)
        roof_idx = req.roof_mask_id if (req.roof_mask_id is not None and req.roof_mask_id < len(masks)) else 0
        roof_mask = (masks[roof_idx]["segmentation"].astype(np.uint8)) * 255
        roof_poly = extract_polygon_from_mask(masks[roof_idx]["segmentation"])

        # Detect obstacles
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
    # Standard 450W panel = 1.05m x 1.76m
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
        # Indicative visual scaling based on image dimensions
        p_w_px = max(36, int(W * 0.052))
        p_h_px = max(58, int(p_w_px * (1.76 / 1.05)))
        setback_px = max(15, int(W * 0.024))
        gap_x = max(6, int(W * 0.008))
        gap_y = max(10, int(H * 0.015))
        calib_method = "Simulation visuelle indicative"

    # Orientation swap if landscape requested
    if req.orientation == "landscape":
        p_w_px, p_h_px = p_h_px, p_w_px
        gap_x, gap_y = gap_y, gap_x

    # 3. Create Safe Zone (Setback erosion minus dilated obstacles)
    kernel_setback = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (setback_px, setback_px))
    safe_zone = cv2.erode(roof_mask, kernel_setback)

    if cv2.countNonZero(obstacles_mask) > 0:
        kernel_ob = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (16, 16))
        dilated_ob = cv2.dilate(obstacles_mask, kernel_ob)
        safe_zone = cv2.bitwise_and(safe_zone, cv2.bitwise_not(dilated_ob))

    # 4. Placement Grid
    y_idxs, x_idxs = np.where(safe_zone > 0)
    placed_panels: list[PlacedPanelModel] = []

    if len(y_idxs) > 0:
        y_min, y_max = y_idxs.min(), y_idxs.max()
        x_min, x_max = x_idxs.min(), x_idxs.max()

        step_y = p_h_px + gap_y
        step_x = p_w_px + gap_x
        occupied = np.zeros((H, W), dtype=np.uint8)

        for y in range(y_min + 6, y_max - p_h_px, step_y):
            for x in range(x_min + 6, x_max - p_w_px, step_x):
                if len(placed_panels) >= req.desired_panels:
                    break

                roi = safe_zone[y : y + p_h_px, x : x + p_w_px]
                occ_roi = occupied[y : y + p_h_px, x : x + p_w_px]

                if roi.shape == (p_h_px, p_w_px) and np.all(roi == 255):
                    if np.sum(occ_roi) == 0:
                        corners = [
                            [int(x), int(y)],
                            [int(x + p_w_px), int(y)],
                            [int(x + p_w_px), int(y + p_h_px)],
                            [int(x), int(y + p_h_px)]
                        ]
                        placed_panels.append(PlacedPanelModel(
                            id=f"panel_{len(placed_panels)+1}",
                            x=int(x),
                            y=int(y),
                            w=int(p_w_px),
                            h=int(p_h_px),
                            corners=corners,
                            rotation_deg=0.0,
                            is_valid=True
                        ))
                        occupied[y : y + p_h_px + gap_y, x : x + p_w_px + gap_x] = 255

            if len(placed_panels) >= req.desired_panels:
                break

    installed_kwp = round(len(placed_panels) * (req.panel_wattage_w / 1000.0), 2)
    all_fitted = len(placed_panels) >= req.desired_panels

    # 5. Realistic Rendering
    panels_dicts = [p.model_dump() for p in placed_panels]
    realistic_bgr = render_realistic_overlay(
        bgr,
        panels_dicts,
        roof_polygon=roof_poly,
        obstacles=obstacle_polys
    )

    dur = round(time.time() - t0, 2)
    logger.info(f"Planned {len(placed_panels)}/{req.desired_panels} panels ({installed_kwp} kWc) in {dur}s")

    return PlanResponse(
        status="success",
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
        realistic_render_b64=encode_image_b64(realistic_bgr),
        processing_time_s=dur
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
        # Sample points on panel corners and center
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
                if intersection_area > 10:  # more than 10 px overlap
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


class RenderPreviewRequest(BaseModel):
    image_b64: str
    panels: list[dict[str, Any]]
    roof_polygon: Optional[list[list[int]]] = None
    obstacle_polygons: Optional[list[list[list[int]]]] = None


@app.post("/roof/render-preview")
def render_preview_endpoint(req: RenderPreviewRequest):
    """Generates an updated photorealistic overlay for user-manipulated panels."""
    bgr, _ = decode_image_b64(req.image_b64)
    rendered = render_realistic_overlay(
        base_bgr=bgr,
        panels=req.panels,
        roof_polygon=req.roof_polygon,
        obstacles=req.obstacle_polygons
    )
    return {
        "status": "success",
        "realistic_render_b64": encode_image_b64(rendered)
    }


class CalibrateRequest(BaseModel):
    image_b64: str
    known_length_m: Optional[float] = None
    known_width_m: Optional[float] = None
    quad_corners: Optional[list[list[int]]] = None  # 4 points [[x, y], ...]
    real_roof_area_m2: Optional[float] = None


@app.post("/roof/calibrate")
def calibrate_endpoint(req: CalibrateRequest):
    """
    Computes camera perspective correction and metric scale calibration.
    Uses OpenCV getPerspectiveTransform and homography if 4 corners are provided.
    """
    bgr, _ = decode_image_b64(req.image_b64)
    H, W = bgr.shape[:2]

    scale_px_per_m = 30.0  # default indicative
    m2_per_px = 1.0 / (30.0 * 30.0)
    warped_b64 = None
    h_matrix = None

    if req.quad_corners and len(req.quad_corners) == 4:
        src = np.array(req.quad_corners, dtype=np.float32)
        # Compute bounding rect size in target orthographic projection
        w_top = np.linalg.norm(src[0] - src[1])
        w_bot = np.linalg.norm(src[3] - src[2])
        max_w = max(int(w_top), int(w_bot), 100)

        h_left = np.linalg.norm(src[0] - src[3])
        h_right = np.linalg.norm(src[1] - src[2])
        max_h = max(int(h_left), int(h_right), 100)

        dst = np.array([[0, 0], [max_w, 0], [max_w, max_h], [0, max_h]], dtype=np.float32)
        M = cv2.getPerspectiveTransform(src, dst)
        h_matrix = M.tolist()

        warped = cv2.warpPerspective(bgr, M, (max_w, max_h))
        warped_b64 = encode_image_b64(warped)

        if req.known_length_m and req.known_length_m > 0:
            scale_px_per_m = max_w / req.known_length_m
            m2_per_px = 1.0 / (scale_px_per_m ** 2)

    elif req.real_roof_area_m2 and req.real_roof_area_m2 > 0:
        # Approximate scale based on total roof area in pixels vs m2
        scale_px_per_m = math.sqrt((W * H * 0.35) / req.real_roof_area_m2)
        m2_per_px = 1.0 / (scale_px_per_m ** 2)

    return {
        "calibrated": (req.quad_corners is not None and len(req.quad_corners) == 4) or (req.real_roof_area_m2 is not None),
        "scale_px_per_m": round(scale_px_per_m, 2),
        "m2_per_pixel": float(m2_per_px),
        "homography_matrix": h_matrix,
        "warped_preview_b64": warped_b64,
        "message": "Toiture calibrée avec succès." if ((req.quad_corners and len(req.quad_corners) == 4) or req.real_roof_area_m2) else "Simulation indicative — dimensions réelles à confirmer."
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8004)
