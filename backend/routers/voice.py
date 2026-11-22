"""FastAPI Router for Voice Transcription (STT) and Natural Speech Preparation (TTS)."""
from __future__ import annotations
import base64
from typing import Optional
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Body
from pydantic import BaseModel

from ..services.voice_service import (
    transcribe_audio_bytes,
    prepare_spoken_response,
)

router = APIRouter(tags=["voice"])

class TranscribeBase64Request(BaseModel):
    audio_base64: str
    format: Optional[str] = "webm"
    language: Optional[str] = None

class SynthesizeRequest(BaseModel):
    text: str
    target_language: Optional[str] = "ar-TN"

# ─────────────────────────────────────────────────────────────────────────────
# 1. Voice Transcription (STT)
# ─────────────────────────────────────────────────────────────────────────────
@router.post("/api/voice/transcribe")
@router.post("/voice/transcribe")
async def voice_transcribe(
    file: Optional[UploadFile] = File(None),
    format_form: Optional[str] = Form(None),
    body: Optional[TranscribeBase64Request] = Body(None),
):
    """
    Transcribes spoken voice into text (Tunisian Arabizi, Arabic, French, English, Japanese).
    Accepts multipart file upload or JSON with base64 audio.
    """
    try:
        audio_bytes = b""
        audio_format = "webm"
        pref_lang = None

        if file:
            audio_bytes = await file.read()
            audio_format = file.filename.split(".")[-1] if file.filename and "." in file.filename else "webm"
            if format_form:
                audio_format = format_form
        elif body and body.audio_base64:
            # Handle potential data URL prefix: data:audio/webm;base64,...
            raw_b64 = body.audio_base64
            if "," in raw_b64:
                raw_b64 = raw_b64.split(",", 1)[1]
            audio_bytes = base64.b64decode(raw_b64)
            audio_format = body.format or "webm"
            pref_lang = body.language
        else:
            raise HTTPException(400, "Aucun flux audio fourni (fichier multipart ou audio_base64 requis).")

        if len(audio_bytes) < 32:
            raise HTTPException(400, "Flux audio trop court ou vide.")

        result = transcribe_audio_bytes(
            audio_bytes=audio_bytes,
            file_format=audio_format,
            preferred_language=pref_lang
        )
        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Erreur lors de la transcription vocale: {str(e)}")


# ─────────────────────────────────────────────────────────────────────────────
# 2. Text-to-Speech Phonetic Processing (TTS)
# ─────────────────────────────────────────────────────────────────────────────
@router.post("/api/voice/synthesize")
@router.post("/voice/synthesize")
def voice_synthesize(req: SynthesizeRequest):
    """
    Processes Solar AI text for natural Text-to-Speech synthesis.
    Converts Arabizi numerals (3->ع, 7->ح, 9->ق) into phonetic Arabic,
    removes Markdown/URLs/tags, and returns concise spoken phrasing.
    """
    try:
        if not req.text or not req.text.strip():
            raise HTTPException(400, "Le texte à synthétiser ne peut pas être vide.")

        return prepare_spoken_response(req.text)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Erreur préparation vocale TTS: {str(e)}")
