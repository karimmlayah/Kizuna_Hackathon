from pathlib import Path
from PIL import Image
from paddleocr import PaddleOCR
import time

BASE_DIR = Path(__file__).resolve().parent

IMAGE_PATH = (
    BASE_DIR.parent.parent
    / "datasets"
    / "bills"
    / "facture_01.webp"
)

OUTPUT_DIR = BASE_DIR / "outputs"
OUTPUT_DIR.mkdir(exist_ok=True)

if not IMAGE_PATH.exists():
    raise FileNotFoundError(IMAGE_PATH)

# Conversion WebP vers PNG
image = Image.open(IMAGE_PATH).convert("RGB")

png_path = OUTPUT_DIR / "facture_01.png"
image.save(png_path)

print("===== SMART SOLAR OCR =====")
print("Chargement du modele...")

ocr = PaddleOCR(
    lang="fr",
    ocr_version="PP-OCRv5",
    device="cpu",
    use_doc_orientation_classify=False,
    use_doc_unwarping=False,
    use_textline_orientation=False,
    enable_mkldnn=False
)

print("Modele charge avec succes !")
print("Analyse de la facture...")

start = time.time()

results = ocr.predict(str(png_path))

for result in results:

    result.print()

    result.save_to_img(
        str(OUTPUT_DIR)
    )

    result.save_to_json(
        str(OUTPUT_DIR)
    )

elapsed = time.time() - start

print("==========================")
print("ANALYSE TERMINEE")
print(f"Temps : {elapsed:.2f} secondes")
print(f"Resultats : {OUTPUT_DIR}")