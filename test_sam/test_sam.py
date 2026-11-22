import time
import cv2
import torch
import numpy as np
from pathlib import Path
from segment_anything import (
    sam_model_registry,
    SamAutomaticMaskGenerator
)

BASE = Path(__file__).resolve().parent

MODEL_PATH = BASE / "weights/sam_vit_b_01ec64.pth"
IMAGE_PATH = BASE / "test_images/roof.jpg"
OUTPUT_PATH = BASE / "outputs"

OUTPUT_PATH.mkdir(exist_ok=True)

device = "cuda" if torch.cuda.is_available() else "cpu"

print("Device:", device)
print("Chargement de SAM...")

sam = sam_model_registry["vit_b"](
    checkpoint=str(MODEL_PATH)
)

sam.to(device=device)
sam.eval()

image = cv2.imread(str(IMAGE_PATH))

if image is None:
    raise FileNotFoundError(IMAGE_PATH)

image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

generator = SamAutomaticMaskGenerator(
    model=sam,
    points_per_side=16,
    points_per_batch=8,
    pred_iou_thresh=0.86,
    stability_score_thresh=0.92,
    min_mask_region_area=300
)

print("Segmentation en cours...")
start = time.time()

with torch.inference_mode():
    masks = generator.generate(image)

print("Nombre de masques:", len(masks))
print("Temps:", round(time.time() - start, 2), "s")

overlay = image.copy()
rng = np.random.default_rng(42)

masks = sorted(
    masks,
    key=lambda x: x["area"],
    reverse=True
)

for i, mask in enumerate(masks):

    segmentation = mask["segmentation"]
    color = rng.integers(0, 256, size=3)

    overlay[segmentation] = (
        overlay[segmentation] * 0.5
        + color * 0.5
    ).astype(np.uint8)

    cv2.imwrite(
        str(OUTPUT_PATH / f"mask_{i:03d}.png"),
        segmentation.astype(np.uint8) * 255
    )

cv2.imwrite(
    str(OUTPUT_PATH / "roof_segmentation.png"),
    cv2.cvtColor(overlay, cv2.COLOR_RGB2BGR)
)

print("SEGMENTATION TERMINEE")
print("Resultats:", OUTPUT_PATH)