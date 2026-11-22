"""Patch stream_gemini_chat in backend/services/chat_service.py to add 429 quota fallback."""
from pathlib import Path

path = Path("backend/services/chat_service.py")
content = path.read_text(encoding="utf-8")

old_func_header = "async def stream_gemini_chat("
split_idx = content.find(old_func_header)

new_func = '''async def stream_gemini_chat(
    request: ChatRequest,
    api_key_override: Optional[str] = None
) -> AsyncGenerator[str, None]:
    """Streams Gemini response chunks via SSE with automatic 429 quota fallback."""
    api_key = (api_key_override or GEMINI_API_KEY).strip()
    if not api_key:
        yield f"data: {json.dumps({'error': 'Clé API Gemini absente dans backend/.env'})}\\n\\n"
        return

    payload, img_telemetry, state, solar_card = prepare_gemini_payload(request.messages)
    models_to_try = [GEMINI_MODEL]
    if "flash-lite" not in GEMINI_MODEL:
        models_to_try.append("gemini-3.1-flash-lite")

    t0 = time.time()
    accumulated_full_text = ""

    async with httpx.AsyncClient(timeout=GEMINI_TIMEOUT) as client:
        for cur_model in models_to_try:
            url = f"{GEMINI_BASE_URL.rstrip('/')}/models/{cur_model}:streamGenerateContent?key={api_key}&alt=sse"
            logger.info(f"[Gemini Stream] Connecting to streamGenerateContent for {cur_model}...")
            try:
                async with client.stream("POST", url, json=payload) as response:
                    if response.status_code == 429:
                        logger.warning(f"[Gemini Stream 429 on {cur_model}] Retrying with backup model...")
                        continue
                    if response.status_code != 200:
                        body = await response.aread()
                        err_msg = f"Erreur streaming Gemini HTTP {response.status_code}: {body.decode('utf-8', errors='ignore')}"
                        logger.error(f"[Gemini Stream Error] {err_msg}")
                        yield f"data: {json.dumps({'error': err_msg})}\\n\\n"
                        return

                    async for line in response.aiter_lines():
                        if not line:
                            continue
                        if line.startswith("data: "):
                            json_str = line[6:].strip()
                            if json_str == "[DONE]":
                                break
                            try:
                                chunk_data = json.loads(json_str)
                                candidates = chunk_data.get("candidates", [])
                                if candidates:
                                    parts = candidates[0].get("content", {}).get("parts", [])
                                    text_piece = "".join([p.get("text", "") for p in parts if "text" in p])
                                    if text_piece:
                                        accumulated_full_text += text_piece
                                        yield f"data: {json.dumps({'type': 'content', 'content': text_piece, 'text': text_piece})}\\n\\n"
                            except json.JSONDecodeError:
                                continue

                    # Append card directive if available
                    if solar_card and "<!-- SOLAR_CARD:" not in accumulated_full_text:
                        card_directive = f"\\n\\n<!-- SOLAR_CARD: {json.dumps(solar_card, ensure_ascii=False)} -->"
                        yield f"data: {json.dumps({'text': card_directive})}\\n\\n"

                    yield "data: [DONE]\\n\\n"
                    logger.info(f"[Gemini Stream Completed] Finished in {round(time.time() - t0, 2)}s using {cur_model}")
                    return

            except httpx.ConnectTimeout:
                yield f"data: {json.dumps({'error': 'Délai de connexion dépassé (15s).'})}\\n\\n"
                return
            except httpx.ReadTimeout:
                yield f"data: {json.dumps({'error': 'Délai de lecture dépassé (180s).'})}\\n\\n"
                return
            except Exception as e:
                logger.error(f"[Gemini Stream Unexpected on {cur_model}] {e}")
                continue
'''

updated = content[:split_idx] + new_func
path.write_text(updated, encoding="utf-8")
print("SUCCESSFULLY PATCHED chat_service.py!")
