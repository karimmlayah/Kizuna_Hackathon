"""Smart Solar — Independent FastAPI Backend for AI Rooftop Planning & Solar AI.

Runs on port 8003. Serves SAM ViT-B (via port 8004), real U-Net inference,
deterministic sizing, financial ROI, and Google Gemini multimodal assistant.
"""
from __future__ import annotations
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import ALLOWED_ORIGINS, HOST, PORT
from .routers import rooftop, chat, iot, weather, voice

app = FastAPI(
    title="Smart Solar — AI Rooftop Planner & Solar AI Assistant",
    version="2.4.0",
    description="Meta SAM ViT-B rooftop segmentation, geometric solar placement, deterministic financial engine, Gemini multimodal assistant, Smart Energy Monitoring IoT, and Voice/Weather Intelligence",
)

# Enable CORS for Expo Router Web and mobile devices
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for LAN / Expo Go mobile testing
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(rooftop.router)
app.include_router(chat.router)
app.include_router(iot.router)
app.include_router(weather.router)
app.include_router(voice.router)

@app.get("/")
def root():
    return {
        "service": "Smart Solar AI Backend",
        "version": "2.2.0",
        "status": "online",
        "docs_url": "/docs",
        "endpoints": [
            "/api/chat",
            "/api/chat/status",
            "/roof/health",
            "/roof/segment",
            "/roof/select-mask",
            "/roof/plan",
            "/roof/validate",
            "/solar/sizing",
            "/solar/financial",
            "/api/rooftop/health",
            "/api/rooftop/segment",
            "/api/rooftop/plan",
            "/api/rooftop/validate",
            "/api/rooftop/analyze",
            "/api/rooftop/analyze-json",
            "/api/rooftop/advise",
            "/api/rooftop/samples"
        ]
    }

if __name__ == "__main__":
    uvicorn.run("backend.main:app", host=HOST, port=PORT, reload=False)
