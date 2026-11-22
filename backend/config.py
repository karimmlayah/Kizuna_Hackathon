"""Configuration paths and constants for the Smart Solar backend."""
import os
from pathlib import Path
from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent

# Load environment variables from .env
load_dotenv(BACKEND_DIR / ".env")

MODELS_DIR = BACKEND_DIR / "models"
ROOFTOP_MODEL_PATH = MODELS_DIR / "rooftop" / "unet_rooftop_best.keras"
ROOFTOP_META_PATH = MODELS_DIR / "rooftop" / "meta.json"
ROOFTOP_SAMPLES_DIR = BACKEND_DIR / "samples"

# Google Gemini AI Chatbot Configuration
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_BASE_URL = os.getenv("GEMINI_BASE_URL", "https://generativelanguage.googleapis.com/v1beta")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash")

# NVIDIA AI Chatbot Configuration (Legacy / Fallback)
NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY", "")
NVIDIA_BASE_URL = os.getenv("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1")
NVIDIA_MODEL = os.getenv("NVIDIA_MODEL", "mistralai/mistral-large-4-1t-a52b")

# Default host and port
HOST = "0.0.0.0"
PORT = 8003

# Allowed origins for CORS (Expo web on localhost:8081, physical phone on LAN)
ALLOWED_ORIGINS = [
    "http://localhost:8081",
    "http://127.0.0.1:8081",
    "http://localhost:19006",
    "http://127.0.0.1:19006",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://172.17.12.112:8081",
    "*"
]
