"""FastAPI Router for Solar AI Multimodal Chatbot (Google Gemini)."""
from __future__ import annotations
import json
from typing import Optional
from fastapi import APIRouter, HTTPException, Header, status
from fastapi.responses import StreamingResponse

from ..config import GEMINI_API_KEY, GEMINI_MODEL, GEMINI_BASE_URL
from ..services.chat_service import (
    call_gemini_chat,
    stream_gemini_chat,
    ChatRequest,
    ChatResponse,
    DEFAULT_MAX_TOKENS,
    DEFAULT_TEMPERATURE,
)

router = APIRouter(prefix="/api/chat", tags=["chat"])

@router.get("/status")
def chat_status():
    """Verify Gemini Chatbot service configuration and status."""
    has_key = bool(GEMINI_API_KEY and len(GEMINI_API_KEY.strip()) > 10)
    return {
        "provider": "Google Gemini API",
        "model": GEMINI_MODEL,
        "base_url": GEMINI_BASE_URL,
        "api_key_configured": has_key,
        "ready": has_key,
        "modalities": ["text", "image", "pdf"],
        "max_tokens": DEFAULT_MAX_TOKENS,
        "temperature": DEFAULT_TEMPERATURE,
        "image_max_dimension": 2048,
        "streaming_supported": True,
    }

@router.post("", response_model=ChatResponse)
async def chat_endpoint(
    request: ChatRequest,
    x_gemini_key: Optional[str] = Header(None, alias="X-GEMINI-API-KEY"),
    x_nvidia_key: Optional[str] = Header(None, alias="X-NVIDIA-API-KEY"),
):
    """Interact with Solar AI multimodal chatbot (synchronous non-streaming)."""
    if not request.messages:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La conversation doit contenir au moins un message."
        )

    api_key_override = x_gemini_key or x_nvidia_key

    try:
        response = await call_gemini_chat(request, api_key_override=api_key_override)
        return response
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve)
        )
    except PermissionError as pe:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(pe)
        )
    except RuntimeError as re:
        err_msg = str(re)
        if "429" in err_msg or "Rate Limit" in err_msg:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=err_msg
            )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=err_msg
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur interne du chatbot : {str(e)}"
        )

@router.post("/stream")
async def chat_stream_endpoint(
    request: ChatRequest,
    x_gemini_key: Optional[str] = Header(None, alias="X-GEMINI-API-KEY"),
    x_nvidia_key: Optional[str] = Header(None, alias="X-NVIDIA-API-KEY"),
):
    """Interact with Solar AI multimodal chatbot via Server-Sent Events (SSE)."""
    if not request.messages:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La conversation doit contenir au moins un message."
        )

    api_key_override = x_gemini_key or x_nvidia_key

    async def sse_event_generator():
        async for chunk in stream_gemini_chat(request, api_key_override=api_key_override):
            yield chunk

    return StreamingResponse(
        sse_event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )
