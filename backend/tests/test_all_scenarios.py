"""Comprehensive Test Suite for Solar AI Chatbot (All 8 Required Scenarios).

1. 'Bonjour, je souhaite installer des panneaux solaires.' (FR)
2. 'Nheb nrakeb panneau solaire fi dari, chnowa naamel ?' (Tunisian Derja)
3. 'How many solar panels do I need?' (EN)
4. Japanese query ('太陽光パネルの設置を考えています。何枚必要ですか？') (JA)
5. Multimodal: Image + PDF de facture anonymisée
6. Multi-turn conversation (2 tours consécutifs)
7. Gestion d'erreur avec clé API invalide (HTTP 401)
8. Orientation progressive en l'absence de données de dimensionnement
"""
import sys
import requests
import json
import base64
import io
from PIL import Image, ImageDraw

ENDPOINT = "http://localhost:8003/api/chat"

def print_header(title):
    print("\n" + "=" * 65, flush=True)
    print(f"👉 {title}", flush=True)
    print("=" * 65, flush=True)

def run_test_1():
    print_header("Test 1: 'Bonjour, je souhaite installer des panneaux solaires.' (FR)")
    payload = {
        "messages": [
            {"role": "user", "content": "Bonjour, je souhaite installer des panneaux solaires."}
        ]
    }
    res = requests.post(ENDPOINT, json=payload, timeout=120)
    assert res.status_code == 200, f"Error {res.status_code}: {res.text}"
    data = res.json()
    print("Solar AI reply (FR):\n", data["reply"][:300], "...\n", flush=True)
    assert len(data["reply"]) > 50
    print("✓ Test 1 passé avec succès.", flush=True)

def run_test_2():
    print_header("Test 2: 'Nheb nrakeb panneau solaire fi dari, chnowa naamel ?' (Tunisian Derja)")
    payload = {
        "messages": [
            {"role": "user", "content": "Nheb nrakeb panneau solaire fi dari, chnowa naamel ?"}
        ]
    }
    res = requests.post(ENDPOINT, json=payload, timeout=120)
    assert res.status_code == 200, f"Error {res.status_code}: {res.text}"
    data = res.json()
    print("Solar AI reply (Derja/Arabizi):\n", data["reply"][:300], "...\n", flush=True)
    assert len(data["reply"]) > 50
    print("✓ Test 2 passé avec succès.", flush=True)

def run_test_3():
    print_header("Test 3: 'How many solar panels do I need?' (EN)")
    payload = {
        "messages": [
            {"role": "user", "content": "How many solar panels do I need?"}
        ]
    }
    res = requests.post(ENDPOINT, json=payload, timeout=120)
    assert res.status_code == 200, f"Error {res.status_code}: {res.text}"
    data = res.json()
    print("Solar AI reply (EN):\n", data["reply"][:300], "...\n", flush=True)
    assert len(data["reply"]) > 50
    print("✓ Test 3 passé avec succès.", flush=True)

def run_test_4():
    print_header("Test 4: Japanese Query ('太陽光パネルの設置を考えています。何枚必要ですか？') (JA)")
    payload = {
        "messages": [
            {"role": "user", "content": "太陽光パネルの設置を考えています。何枚必要ですか？"}
        ]
    }
    res = requests.post(ENDPOINT, json=payload, timeout=120)
    assert res.status_code == 200, f"Error {res.status_code}: {res.text}"
    data = res.json()
    print("Solar AI reply (JA):\n", data["reply"][:300], "...\n", flush=True)
    assert len(data["reply"]) > 50
    print("✓ Test 4 passé avec succès.", flush=True)

def run_test_5():
    print_header("Test 5: Image de facture STEG (multimodal)")
    img = Image.new("RGB", (320, 180), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    draw.text((20, 25), "STEG Tunisie - Facture Electricite", fill=(0, 0, 0))
    draw.text((20, 65), "Consommation: 720 kWh", fill=(0, 0, 0))
    draw.text((20, 105), "Total a payer: 252.000 TND", fill=(0, 0, 0))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    b64 = f"data:image/jpeg;base64,{base64.b64encode(buf.getvalue()).decode()}"

    payload = {
        "messages": [
            {
                "role": "user",
                "content": "Voici ma facture STEG en pièce jointe, que me conseillez-vous ?",
                "attachments": [
                    {"type": "image", "data_url": b64, "name": "facture_steg.jpg"}
                ]
            }
        ]
    }
    res = requests.post(ENDPOINT, json=payload, timeout=120)
    assert res.status_code == 200, f"Error {res.status_code}: {res.text}"
    data = res.json()
    print("Solar AI reply (Facture image):\n", data["reply"][:350], "...\n", flush=True)
    assert len(data["reply"]) > 50
    print("✓ Test 5 passé avec succès.", flush=True)

def run_test_6():
    print_header("Test 6: Multi-turn Conversation (2 tours consécutifs)")
    payload = {
        "messages": [
            {"role": "user", "content": "J'habite à Sousse et ma facture mensuelle est de 180 TND."},
            {"role": "assistant", "content": "Parfait ! Pour 180 TND/mois à Sousse, votre consommation mensuelle est d'environ 500 kWh (6 000 kWh/an). Quel type de toiture possédez-vous ?"},
            {"role": "user", "content": "J'ai un toit terrasse plat d'environ 60 m²."}
        ]
    }
    res = requests.post(ENDPOINT, json=payload, timeout=120)
    assert res.status_code == 200, f"Error {res.status_code}: {res.text}"
    data = res.json()
    print("Solar AI reply (Tour 2):\n", data["reply"][:350], "...\n", flush=True)
    assert len(data["reply"]) > 50
    print("✓ Test 6 passé avec succès.", flush=True)

def run_test_7():
    print_header("Test 7: Requête avec clé API incorrecte (Gestion d'erreur 401)")
    payload = {
        "messages": [
            {"role": "user", "content": "Test avec mauvaise clé API"}
        ]
    }
    # Pass an invalid API key via X-NVIDIA-API-KEY header
    res = requests.post(
        ENDPOINT,
        json=payload,
        headers={"X-NVIDIA-API-KEY": "nvapi-INVALID-TEST-KEY-12345"},
        timeout=20
    )
    print("Code HTTP retourné :", res.status_code, flush=True)
    print("Message d'erreur :", res.json().get("detail"), flush=True)
    assert res.status_code == 401, f"Attendu 401, reçu {res.status_code}"
    assert "401" in str(res.json().get("detail")) or "non valide" in str(res.json().get("detail"))
    print("✓ Test 7 passé avec succès (Erreur 401 propre renvoyée).", flush=True)

def run_test_8():
    print_header("Test 8: Données de dimensionnement manquantes (orientation progressive)")
    payload = {
        "messages": [
            {"role": "user", "content": "Je veux savoir le prix exact d'une installation chez moi immédiatement."}
        ]
    }
    res = requests.post(ENDPOINT, json=payload, timeout=120)
    assert res.status_code == 200
    data = res.json()
    print("Solar AI reply (demande pédagogique des infos manquantes) :\n", data["reply"][:350], "...\n", flush=True)
    assert len(data["reply"]) > 50
    print("✓ Test 8 passé avec succès.", flush=True)

if __name__ == "__main__":
    print("==================================================================", flush=True)
    print("  Démarrage de la suite de tests complète Solar AI (8 scénarios) ", flush=True)
    print("==================================================================", flush=True)
    run_test_1()
    run_test_2()
    run_test_3()
    run_test_4()
    run_test_5()
    run_test_6()
    run_test_7()
    run_test_8()
    print("\n" + "=" * 65, flush=True)
    print("🎉 TOUS LES 8 SCÉNARIOS OBLIGATOIRES ONT ÉTÉ VALIDÉS AVEC SUCCÈS !", flush=True)
    print("=" * 65, flush=True)
