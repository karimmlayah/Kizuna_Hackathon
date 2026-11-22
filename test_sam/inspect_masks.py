import cv2
import torch
import numpy as np
from pathlib import Path
from segment_anything import sam_model_registry, SamAutomaticMaskGenerator

model_path = Path("test_sam/weights/sam_vit_b_01ec64.pth")
img_path = Path("test_sam/test_images/roof.jpg")
device = "cuda" if torch.cuda.is_available() else "cpu"

print(f"Loading SAM ViT-B on {device}...")
sam = sam_model_registry["vit_b"](checkpoint=str(model_path)).to(device=device)
sam.eval()

img = cv2.imread(str(img_path))
img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

gen = SamAutomaticMaskGenerator(
    model=sam,
    points_per_side=16,
    points_per_batch=8,
    pred_iou_thresh=0.86,
    stability_score_thresh=0.92,
    min_mask_region_area=300
)

print("Generating masks...")
with torch.inference_mode():
    masks = gen.generate(img_rgb)

masks = sorted(masks, key=lambda x: x["area"], reverse=True)
print(f"Generated {len(masks)} masks on {device}")
H, W = img.shape[:2]
total_px = H * W

for i, m in enumerate(masks):
    area_pct = (m["area"] / total_px) * 100
    x, y, w, h = m["bbox"]
    print(f"Mask {i:02d}: area={m['area']} ({area_pct:.1f}%), bbox=[x={x}, y={y}, w={w}, h={h}], pred_iou={m['predicted_iou']:.3f}, stab={m['stability_score']:.3f}")
