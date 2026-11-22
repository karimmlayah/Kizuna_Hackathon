"""Smart Solar Voice Service — Speech-to-Text, Multilingual Audio & TTS Phonetic Processing.

Features:
- Faster-Whisper on CPU (INT8 quantization, zero GPU VRAM impact on SAM).
- Domain-specific solar context prompt (STEG, ANME, Métlaoui, kWc, etc.).
- Gemini Multimodal Audio transcription fallback for complex Tunisian Arabizi.
- Arabizi phonetic cleaner & converter for natural Arabic Text-to-Speech (3->ع, 7->ح, 9->ق, etc.).
- Strips technical artifacts, Markdown, and generates concise spoken phrasing.
"""
from __future__ import annotations
import base64
import io
import json
import logging
import os
import re
import tempfile
import time
from pathlib import Path
from typing import Any, Optional
import httpx

from ..config import GEMINI_API_KEY, GEMINI_BASE_URL, GEMINI_MODEL

logger = logging.getLogger("voice_service")

# Solar Domain Transcription Prompt Context
SOLAR_VOICE_CONTEXT = (
    "STEG, ANME, photovoltaïque, kWh, kWc, facture, onduleur, consommation, "
    "production solaire, Métlaoui, Gafsa, Tunis, Sfax, Sousse, Bizerte, Nabeul, "
    "Kairouan, Gabès, Djerba, Tozeur, dinars, chams, dhaw, fatora, sta7, dar, "
    "kadeh, n7eb, chnowa, barème, Prosol, hybride, batterie, autoconsommation."
)

_WHISPER_MODEL = None

def get_whisper_model():
    """Lazy-loads Whisper tiny on CPU with INT8 quantization."""
    global _WHISPER_MODEL
    if _WHISPER_MODEL is None:
        try:
            from faster_whisper import WhisperModel
            logger.info("Initializing Faster-Whisper (tiny, CPU INT8)...")
            _WHISPER_MODEL = WhisperModel("tiny", device="cpu", compute_type="int8")
            logger.info("Faster-Whisper initialized successfully.")
        except Exception as e:
            logger.error("Failed to load Faster-Whisper: %s", e)
            _WHISPER_MODEL = False
    return _WHISPER_MODEL if _WHISPER_MODEL is not False else None


# ─────────────────────────────────────────────────────────────────────────────
# 1. Speech-to-Text (Local Whisper CPU INT8 + Gemini Multimodal Fallback)
# ─────────────────────────────────────────────────────────────────────────────
def transcribe_audio_bytes(
    audio_bytes: bytes,
    file_format: str = "webm",
    preferred_language: Optional[str] = None
) -> dict[str, Any]:
    """Transcribe audio bytes using local Whisper on CPU with Gemini fallback."""
    start_t = time.time()

    # Save to temporary file for Whisper
    suffix = f".{file_format.lstrip('.')}"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp_path = tmp.name
        tmp.write(audio_bytes)

    transcription_text = ""
    detected_lang = "fr"
    engine_used = "faster-whisper"

    # 1. Try local Whisper on CPU
    model = get_whisper_model()
    if model:
        try:
            segments, info = model.transcribe(
                tmp_path,
                beam_size=3,
                initial_prompt=SOLAR_VOICE_CONTEXT,
                language=preferred_language if preferred_language in ["ar", "fr", "en", "ja"] else None,
                vad_filter=True,
            )
            transcription_text = " ".join([s.text for s in segments]).strip()
            detected_lang = info.language if hasattr(info, "language") else "fr"
            logger.info("Whisper CPU transcribed (%s, %.2fs): '%s'", detected_lang, time.time() - start_t, transcription_text)
        except Exception as e:
            logger.warning("Whisper transcription error: %s. Falling back to Gemini.", e)
            transcription_text = ""

    # Clean up temp file
    try:
        os.remove(tmp_path)
    except Exception:
        pass

    # 2. If Whisper gave empty or poor result, use Gemini Multimodal Audio
    if not transcription_text or len(transcription_text.strip()) < 2:
        logger.info("Using Gemini Multimodal Audio for speech recognition...")
        gemini_res = transcribe_with_gemini(audio_bytes, file_format)
        if gemini_res.get("text"):
            transcription_text = gemini_res["text"]
            detected_lang = gemini_res.get("language", "ar_tn")
            engine_used = "gemini-multimodal"

    duration = round(time.time() - start_t, 2)
    return {
        "transcription": transcription_text,
        "detected_language": detected_lang,
        "engine": engine_used,
        "processing_time_s": duration,
        "domain_context_applied": True,
    }


def transcribe_with_gemini(audio_bytes: bytes, file_format: str) -> dict[str, Any]:
    """Transcribe audio using Google Gemini Multimodal Audio input."""
    if not GEMINI_API_KEY:
        return {"text": "", "language": "fr"}

    mime_types = {
        "webm": "audio/webm",
        "wav": "audio/wav",
        "mp3": "audio/mp3",
        "m4a": "audio/mp4",
        "ogg": "audio/ogg",
        "aac": "audio/aac",
    }
    mime = mime_types.get(file_format.lower().lstrip("."), "audio/webm")
    b64_audio = base64.b64encode(audio_bytes).decode("utf-8")

    prompt = (
        "Transcribe this user speech exactly as spoken. "
        "The speaker may be speaking in Tunisian spoken Arabic / Arabizi, French, Arabic, English, Japanese, or mixing Tunisian and French. "
        "Keep technical solar terms intact (STEG, ANME, kWh, kWc, panneaux, facture, dinars, Métlaoui, etc.). "
        "Output ONLY the transcribed words with no commentary, notes or translations."
    )

    url = f"{GEMINI_BASE_URL}/models/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"
    payload = {
        "contents": [
            {
                "parts": [
                    {"text": prompt},
                    {
                        "inline_data": {
                            "mime_type": mime,
                            "data": b64_audio
                        }
                    }
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.0,
            "maxOutputTokens": 300,
        }
    }

    try:
        with httpx.Client(timeout=20.0) as client:
            resp = client.post(url, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
                return {"text": text, "language": "ar_tn"}
            else:
                logger.warning("Gemini audio transcription failed: %d %s", resp.status_code, resp.text)
    except Exception as e:
        logger.error("Gemini audio transcription exception: %s", e)

    return {"text": "", "language": "fr"}


# ─────────────────────────────────────────────────────────────────────────────
# 2. Text-to-Speech (TTS) Natural Phonetic Processing & Cleaner
# ─────────────────────────────────────────────────────────────────────────────
# Arabizi numeral mapping for Arabic speech engines:
# 3 = ع (ain), 7 = ح (haa), 9 = ق (qaf), 5 = خ (khaa), 2 = ء/أ (hamza)
ARABIZI_NUMERAL_MAP = [
    (r"\b3lech\b", "علاش"),
    (r"\b3lech\b", "علاش"),
    (r"\bkadeh\b", "قداش"),
    (r"\bchnowa\b", "شنوة"),
    (r"\bfamma\b", "فمة"),
    (r"\bsta7\b", "سطح"),
    (r"\bdari\b", "داري"),
    (r"\bchams\b", "شمس"),
    (r"\bdhaw\b", "ضو"),
    (r"\bfatora\b", "فاتورة"),
    (r"\bmatar\b", "مطر"),
    (r"\bghodwa\b", "غدوة"),
    (r"\blyoum\b", "اليوم"),
    (r"\btaw\b", "توة"),
    (r"\btawwa\b", "توة"),
    (r"\btouwa\b", "توة"),
    (r"\bn7eb\b", "نحب"),
    (r"\bnrakeb\b", "نركب"),
    (r"\bmte3i\b", "متاعي"),
    (r"\bmte3ek\b", "متاعك"),
    (r"\btans7ni\b", "تنصحني"),
    (r"\bna9set\b", "نقصت"),
    (r"\bwa9tech\b", "وقتيش"),
    (r"\ba7sen\b", "أحسن"),
    (r"\bchahrin\b", "شهرين"),
    (r"\bchhar\b", "شهر"),
    (r"\b3am\b", "عام"),
]

def clean_text_for_speech(text: str) -> str:
    """Strips Markdown syntax, URLs, bullet points, and embedded comments."""
    if not text:
        return ""

    # Remove SOLAR_CARD comments
    cleaned = re.sub(r"<!--\s*SOLAR_CARD:\s*\{.*?\}\s*-->", "", text, flags=re.DOTALL)
    # Remove markdown links [title](url) -> title
    cleaned = re.sub(r"\[([^\]]+)\]\([^\)]+\)", r"\1", cleaned)
    # Remove URLs
    cleaned = re.sub(r"https?://\S+", "", cleaned)
    # Remove markdown bold/italics
    cleaned = re.sub(r"[*_]{1,3}([^*_]+)[*_]{1,3}", r"\1", cleaned)
    # Remove headers (# Title)
    cleaned = re.sub(r"^#{1,6}\s*", "", cleaned, flags=re.MULTILINE)
    # Remove list bullets
    cleaned = re.sub(r"^\s*[-*•]\s*", "", cleaned, flags=re.MULTILINE)
    # Replace unit symbols for spoken naturalness
    cleaned = re.sub(r"\b(\d+(?:[.,]\d+)?)\s*kWh\b", r"\1 kilowattheures", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\b(\d+(?:[.,]\d+)?)\s*kWc\b", r"\1 kilowatt-crête", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\b(\d+(?:[.,]\d+)?)\s*kW\b", r"\1 kilowatts", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\b(\d+(?:[.,]\d+)?)\s*(?:DT|TND)\b", r"\1 dinars", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\bWc\b", "watt-crête", cleaned)
    cleaned = re.sub(r"\bW\b", "watts", cleaned)

    # Collapse multiple whitespaces and newlines
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned


def convert_arabizi_to_phonetic_arabic(text: str) -> str:
    """
    Converts Tunisian Arabizi phrases into natural phonetic Arabic characters
    so that Arabic TTS synthesizers pronounce words fluidly instead of reciting numbers.
    """
    spoken = text
    # Map common Tunisian Arabizi keywords
    for pattern, replacement in ARABIZI_NUMERAL_MAP:
        spoken = re.sub(pattern, replacement, spoken, flags=re.IGNORECASE)

    # Convert embedded numerals inside words (ex: n7eb -> نحب, mte3ek -> متاعك)
    # 3 -> ع
    spoken = re.sub(r"([a-zA-Z])3", r"\1ع", spoken)
    spoken = re.sub(r"3([a-zA-Z])", r"ع\1", spoken)
    # 7 -> ح
    spoken = re.sub(r"([a-zA-Z])7", r"\1ح", spoken)
    spoken = re.sub(r"7([a-zA-Z])", r"ح\1", spoken)
    # 9 -> ق
    spoken = re.sub(r"([a-zA-Z])9", r"\1ق", spoken)
    spoken = re.sub(r"9([a-zA-Z])", r"ق\1", spoken)
    # 5 -> خ
    spoken = re.sub(r"([a-zA-Z])5", r"\1خ", spoken)
    spoken = re.sub(r"5([a-zA-Z])", r"خ\1", spoken)

    return spoken


def prepare_spoken_response(text: str) -> dict[str, Any]:
    """
    Prepares short, natural spoken versions of a written Solar AI response.
    Returns clean text, phonetic Arabic version, and a concise spoken summary.
    """
    clean = clean_text_for_speech(text)

    # Detect if text is predominantly Arabic/Arabizi or French
    has_arabic_script = bool(re.search(r"[\u0600-\u06FF]", clean))
    is_arabizi = bool(re.search(r"\b(?:aslema|kadeh|chnowa|n7eb|famma|dhaw|sta7|chams|fatora|mte3)\b", text, re.IGNORECASE))

    # Keep spoken answers concise (under ~35-40 words or first 2 sentences)
    sentences = re.split(r"(?<=[.!?])\s+", clean)
    short_summary = " ".join(sentences[:2]).strip() if sentences else clean
    if len(short_summary) > 280:
        short_summary = short_summary[:277] + "..."

    # Arabic phonetic version for Arabic TTS engines
    phonetic_arabic = convert_arabizi_to_phonetic_arabic(short_summary) if is_arabizi else short_summary

    recommended_voice_lang = "ar-TN" if (is_arabizi or has_arabic_script) else "fr-FR"

    return {
        "original_text": text,
        "clean_text": clean,
        "short_spoken_text": short_summary,
        "phonetic_arabic": phonetic_arabic,
        "is_arabizi": is_arabizi,
        "recommended_voice_lang": recommended_voice_lang,
    }
