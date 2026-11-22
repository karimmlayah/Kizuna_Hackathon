import os
import requests
import json
from dotenv import load_dotenv

from pathlib import Path

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

api_key = os.getenv("NVIDIA_API_KEY")
base_url = os.getenv("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1")
model = os.getenv("NVIDIA_MODEL", "mistralai/mistral-large-4-1t-a52b")

headers = {
    "Authorization": f"Bearer {api_key}",
    "Accept": "application/json",
    "Content-Type": "application/json",
}

payload = {
    "model": model,
    "messages": [
        {"role": "system", "content": "Tu es Solar AI, conseiller en énergie solaire."},
        {"role": "user", "content": "Bonjour, teste court : réponds en une phrase."}
    ],
    "max_tokens": 150,
    "temperature": 0.3,
    "reasoning_effort": "high"
}

response = requests.post(f"{base_url}/chat/completions", headers=headers, json=payload, timeout=30)
print(json.dumps(response.json(), indent=2))
