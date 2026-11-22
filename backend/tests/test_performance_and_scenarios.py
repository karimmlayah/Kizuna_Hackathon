"""Performance & Scenario Benchmark for Solar AI Chatbot (Google Gemini API).

Scenarios tested:
1. Conversation textuelle simple (FR)
2. Image simple (toiture résidentielle)
3. Facture STEG anonymisée haute résolution (2800 x 1900)
4. Conversation après analyse de facture (multi-turn sans renvoi de l'image)
5. Test de streaming SSE de bout en bout (Google Gemini streamGenerateContent)
"""
from __future__ import annotations
import os
import io
import time
import json
import base64
import requests
from PIL import Image, ImageDraw

ENDPOINT = "http://127.0.0.1:8003/api/chat"
STREAM_ENDPOINT = "http://127.0.0.1:8003/api/chat/stream"
STATUS_ENDPOINT = "http://127.0.0.1:8003/api/chat/status"
TIMEOUT = 60

def banner(title: str):
    print("\n" + "=" * 70, flush=True)
    print(f"🔬 {title}", flush=True)
    print("=" * 70, flush=True)

def test_status():
    banner("0. Vérification du statut de l'API Solar AI (Gemini)")
    res = requests.get(STATUS_ENDPOINT, timeout=10)
    assert res.status_code == 200, f"Erreur status: {res.text}"
    status_data = res.json()
    print("Configuration détectée :", flush=True)
    print(json.dumps(status_data, indent=2), flush=True)
    assert status_data["ready"] is True
    assert status_data["provider"] == "Google Gemini API"
    assert status_data["max_tokens"] == 2048
    assert status_data["temperature"] == 0.2
    print("✓ Statut et configuration validés.", flush=True)

def test_scenario_1_text():
    banner("1. Conversation textuelle simple (FR)")
    payload = {
        "messages": [
            {"role": "user", "content": "Bonjour, je voudrais savoir si l'énergie solaire est rentable en Tunisie."}
        ]
    }
    t0 = time.time()
    print("Envoi de la requête texte à Solar AI...", flush=True)
    res = requests.post(ENDPOINT, json=payload, timeout=TIMEOUT)
    dur = round(time.time() - t0, 2)
    assert res.status_code == 200, f"Erreur HTTP {res.status_code}: {res.text}"
    data = res.json()
    print(f"✓ Réponse reçue avec succès en {dur} s", flush=True)
    print("Extrait de la réponse :", flush=True)
    print(data["reply"][:250], "...\n", flush=True)
    print("Télémétrie :", data.get("telemetry"), flush=True)
    assert len(data["reply"]) > 50
    return {"scenario": "Texte simple", "duration_s": dur, "status": "Succès"}

def test_scenario_2_simple_image():
    banner("2. Image simple (Toiture résidentielle)")
    img = Image.new("RGB", (1600, 1200), color=(240, 240, 240))
    d = ImageDraw.Draw(img)
    d.rectangle([(200, 200), (1400, 1000)], fill=(180, 120, 80), outline=(100, 50, 20), width=6)
    d.text((250, 250), "Toiture terrasse beton ~120 m2 - Orientation Sud", fill=(255, 255, 255))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=95)
    b64 = base64.b64encode(buf.getvalue()).decode()
    data_url = f"data:image/jpeg;base64,{b64}"
    raw_size_kb = len(buf.getvalue()) / 1024

    payload = {
        "messages": [
            {
                "role": "user",
                "content": "Voici une photo de ma toiture, est-elle propice à une installation solaire ?",
                "attachments": [
                    {"type": "image", "data_url": data_url, "name": "toiture_sud.jpg"}
                ]
            }
        ]
    }
    t0 = time.time()
    print(f"Envoi image (1600x1200, {round(raw_size_kb, 1)} KB)...", flush=True)
    res = requests.post(ENDPOINT, json=payload, timeout=TIMEOUT)
    dur = round(time.time() - t0, 2)
    assert res.status_code == 200, f"Erreur HTTP {res.status_code}: {res.text}"
    data = res.json()
    print(f"✓ Réponse reçue avec succès en {dur} s", flush=True)
    print("Extrait de la réponse :", flush=True)
    print(data["reply"][:250], "...\n", flush=True)
    print("Télémétrie :", data.get("telemetry"), flush=True)
    assert len(data["reply"]) > 50
    return {"scenario": "Image simple", "duration_s": dur, "status": "Succès"}

def test_scenario_3_steg_bill():
    banner("3. Facture STEG anonymisée haute résolution (2800 x 1900)")
    img = Image.new("RGB", (2800, 1900), color=(255, 255, 255))
    d = ImageDraw.Draw(img)
    d.rectangle([(100, 100), (2700, 1800)], outline=(0, 51, 102), width=8)
    d.text((200, 200), "SOCIETE TUNISIENNE DE L'ELECTRICITE ET DU GAZ - STEG", fill=(0, 51, 102))
    d.text((200, 350), "FACTURE D'ELECTRICITE ET GAZ (BIMESTRIELLE)", fill=(0, 0, 0))
    d.text((200, 500), "Reference Client : 48920192 [ANONYMISE]", fill=(0, 0, 0))
    d.text((200, 650), "Index Ancien: 14200   |   Index Nouveau: 15150", fill=(0, 0, 0))
    d.text((200, 800), "CONSOMMATION TOTALE FACTUREE : 950 kWh", fill=(180, 0, 0))
    d.text((200, 950), "Redevances fixes : 12.500 TND", fill=(0, 0, 0))
    d.text((200, 1100), "Montant TVA comprise : 332.500 TND", fill=(0, 0, 0))
    d.text((200, 1250), "NET A PAYER : 345.000 TND", fill=(0, 100, 0))
    d.text((200, 1400), "Tarif : Residentiel Moyenne / Basse Tension", fill=(0, 0, 0))

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    raw_bytes = buf.getvalue()
    raw_size_kb = len(raw_bytes) / 1024
    b64 = base64.b64encode(raw_bytes).decode()
    data_url = f"data:image/png;base64,{b64}"

    payload = {
        "messages": [
            {
                "role": "user",
                "content": "Voici ma facture STEG, analyse la consommation et propose-moi un dimensionnement.",
                "attachments": [
                    {"type": "image", "data_url": data_url, "name": "facture_steg_hd.png"}
                ]
            }
        ]
    }
    t0 = time.time()
    print(f"Envoi facture HD ({round(raw_size_kb, 1)} KB)...", flush=True)
    res = requests.post(ENDPOINT, json=payload, timeout=TIMEOUT)
    dur = round(time.time() - t0, 2)
    assert res.status_code == 200, f"Erreur HTTP {res.status_code}: {res.text}"
    data = res.json()
    print(f"✓ Réponse reçue avec succès en {dur} s", flush=True)
    print("Extrait de la réponse Solar AI :", flush=True)
    print(data["reply"][:350], "...\n", flush=True)
    print("Télémétrie :", json.dumps(data.get("telemetry"), indent=2), flush=True)
    assert len(data["reply"]) > 50
    return {
        "scenario": "Facture STEG HD",
        "duration_s": dur,
        "reply": data["reply"],
        "status": "Succès"
    }

def test_scenario_4_multiturn_after_bill(bill_reply: str):
    banner("4. Conversation après analyse de facture (Multi-turn sans renvoi de l'image)")
    payload = {
        "messages": [
            {
                "role": "user",
                "content": "Voici ma facture STEG, analyse la consommation et propose-moi un dimensionnement.",
                "attachments": [
                    {"type": "image", "data_url": "data:image/jpeg;base64,/9j/4AAQSkZJRg==", "name": "facture_steg_hd.png"}
                ]
            },
            {
                "role": "assistant",
                "content": bill_reply[:350]
            },
            {
                "role": "user",
                "content": "Combien de panneaux de 450W cela représente et quel sera le retour sur investissement ?"
            }
        ]
    }
    t0 = time.time()
    print("Envoi requête multi-tour (sans ré-envoi image)...", flush=True)
    res = requests.post(ENDPOINT, json=payload, timeout=TIMEOUT)
    dur = round(time.time() - t0, 2)
    assert res.status_code == 200, f"Erreur HTTP {res.status_code}: {res.text}"
    data = res.json()
    print(f"✓ Réponse multi-tour reçue avec succès en {dur} s", flush=True)
    print("Extrait de la réponse Tour 2 :", flush=True)
    print(data["reply"][:300], "...\n", flush=True)
    print("Télémétrie :", data.get("telemetry"), flush=True)
    assert len(data["reply"]) > 50
    return {"scenario": "Multi-turn après facture", "duration_s": dur, "status": "Succès"}

def test_scenario_5_streaming():
    banner("5. Streaming SSE de bout en bout (affichage progressif)")
    payload = {
        "messages": [
            {"role": "user", "content": "Explique brièvement le principe de l'onduleur photovoltaïque en 2 phrases."}
        ]
    }
    t0 = time.time()
    print("Connexion au stream SSE...", flush=True)
    res = requests.post(STREAM_ENDPOINT, json=payload, stream=True, timeout=TIMEOUT)
    assert res.status_code == 200
    ttft = None
    chunks = []
    for line in res.iter_lines():
        if line:
            decoded = line.decode("utf-8")
            if decoded.startswith("data: "):
                raw_chunk = decoded[6:].strip()
                if raw_chunk == "[DONE]":
                    break
                try:
                    p = json.loads(raw_chunk)
                    if p.get("type") == "content" and p.get("content"):
                        if ttft is None:
                            ttft = round(time.time() - t0, 2)
                            print(f"⚡ Time to First Token (TTFT) : {ttft} s", flush=True)
                        chunks.append(p["content"])
                except Exception:
                    pass
    total_dur = round(time.time() - t0, 2)
    full_text = "".join(chunks)
    print(f"✓ Streaming complété en {total_dur} s (TTFT : {ttft} s)", flush=True)
    print("Texte streamé reconstitué :\n", full_text[:250], "...\n", flush=True)
    assert len(full_text) > 30
    assert ttft is not None
    return {"scenario": "Streaming SSE", "duration_s": total_dur, "ttft_s": ttft, "status": "Succès"}

if __name__ == "__main__":
    banner("DÉBUT DU BENCHMARK DE PERFORMANCE ET TESTS DES 4 SCÉNARIOS (GEMINI)")
    test_status()
    s1 = test_scenario_1_text()
    s2 = test_scenario_2_simple_image()
    s3 = test_scenario_3_steg_bill()
    s4 = test_scenario_4_multiturn_after_bill(s3["reply"])
    s5 = test_scenario_5_streaming()

    print("\n" + "=" * 70, flush=True)
    print("🏆 RÉCAPITULATIF DES PERFORMANCES OBTENUES (GOOGLE GEMINI)", flush=True)
    print("=" * 70, flush=True)
    for res in [s1, s2, s3, s4, s5]:
        extra = f" (TTFT: {res['ttft_s']} s)" if 'ttft_s' in res else ""
        print(f"- {res['scenario']:<30} : {res['duration_s']} s {extra} ({res['status']})", flush=True)
    print("=" * 70, flush=True)
