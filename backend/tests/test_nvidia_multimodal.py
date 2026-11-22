import os
import requests
import json
import base64
import io
from PIL import Image, ImageDraw
from dotenv import load_dotenv

from pathlib import Path

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

api_key = os.getenv("NVIDIA_API_KEY")
base_url = os.getenv("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1")
model = os.getenv("NVIDIA_MODEL", "mistralai/mistral-large-4-1t-a52b")

# Create a small test image (bill mock: 300x200 with text)
img = Image.new("RGB", (300, 200), color=(255, 255, 255))
draw = ImageDraw.Draw(img)
draw.text((20, 30), "STEG - Facture d'electricite", fill=(0, 0, 0))
draw.text((20, 70), "Consommation: 850 kWh", fill=(0, 0, 0))
draw.text((20, 110), "Montant: 297.500 TND", fill=(0, 0, 0))

buf = io.BytesIO()
img.save(buf, format="JPEG")
b64_data_url = f"data:image/jpeg;base64,{base64.b64encode(buf.getvalue()).decode()}"

headers = {
    "Authorization": f"Bearer {api_key}",
    "Accept": "application/json",
    "Content-Type": "application/json",
}

payload = {
    "model": model,
    "messages": [
        {"role": "system", "content": "Tu es Solar AI, conseiller en énergie solaire."},
        {
            "role": "user",
            "content": [
                {"type": "text", "text": "Peux-tu analyser cette facture et me donner la consommation et le montant ?"},
                {"type": "image_url", "image_url": {"url": b64_data_url}}
            ]
        }
    ],
    "max_tokens": 500,
    "temperature": 0.3,
    "reasoning_effort": "high"
}

response = requests.post(f"{base_url}/chat/completions", headers=headers, json=payload, timeout=60)
print("Status code:", response.status_code)
if response.status_code == 200:
    data = response.json()
    msg = data["choices"][0]["message"]
    print("Content:\n", msg.get("content"))
else:
    print("Error:", response.text)
