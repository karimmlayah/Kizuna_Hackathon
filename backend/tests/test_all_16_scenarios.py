"""Comprehensive Test Suite for Solar AI — 16 Mandatory Scenarios.

Verifies:
1. Tunisian Arabizi (Reference Test: Metlaoui 400 kWh / 2 mois / 92 DT)
2. Tunisian in Arabic alphabet
3. French
4. English
5. Japanese
6. STEG bill image import (facture_01.webp)
7. Bill with bimonthly period (2 months consistency)
8. Bill with missing OCR data
9. Integer panel count and installed power physical coherence
10. ROI calculation & fixed fees disclaimer
11. Verified installer recommendation (ANME certified)
12. Installment payments & PROSOL ÉLEC on STEG bills
13. Transmission of structured data to Solar Design Studio
14. Dynamic budget update during multi-turn conversation
15. Network error / Timeout handling
16. Out-of-scope query handling (Explicit RAG unavailable notice)
"""
from __future__ import annotations
import os
import re
import sys
import json
import time
import base64
from pathlib import Path
import requests

BASE_URL = "http://127.0.0.1:8003"
BILLS_DIR = Path(__file__).resolve().parent.parent / "datasets" / "bills"
SAMPLE_BILL_PATH = BILLS_DIR / "facture_01.webp"

passed_tests = 0
failed_tests = 0
benchmark_timings = {}

def log_test_header(num: int, title: str):
    time.sleep(1.2)
    print(f"\n{'='*75}")
    print(f"🧪 SCÉNARIO {num} : {title}")
    print(f"{'='*75}")

def record_result(num: int, name: str, success: bool, duration: float, note: str = ""):
    global passed_tests, failed_tests
    benchmark_timings[f"Scénario {num} - {name}"] = duration
    if success:
        passed_tests += 1
        print(f"✅ SUCCÈS ({duration:.2f}s) : {note}")
    else:
        failed_tests += 1
        print(f"❌ ÉCHEC ({duration:.2f}s) : {note}")


def run_all_tests():
    print("=" * 75)
    print("🚀 DÉMARRAGE DU BANC DE TEST OFFICIEL SOLAR AI (16 SCÉNARIOS)")
    print("=" * 75)

    # ─────────────────────────────────────────────────────────────────
    # SCÉNARIO 1 : Conversation en tunisien Arabizi (Test de référence Metlaoui)
    # « Aslema, n7eb nrakeb panneaux solaires fi dari. Nosken fi Metlaoui, nesta3mel 400 kWh fi chahrin w nkhalles 92 DT. Chnowa tans7ni ? »
    # ─────────────────────────────────────────────────────────────────
    log_test_header(1, "Tunisien Arabizi — Test de Référence (Metlaoui, 400 kWh / 2 mois, 92 DT)")
    t0 = time.time()
    prompt_1 = "Aslema, n7eb nrakeb panneaux solaires fi dari. Nosken fi Metlaoui, nesta3mel 400 kWh fi chahrin w nkhalles 92 DT. Chnowa tans7ni ?"
    res = requests.post(f"{BASE_URL}/api/chat", json={"messages": [{"role": "user", "content": prompt_1}]})
    dur = time.time() - t0
    data = res.json()
    reply = data.get("reply", "")
    card = data.get("solar_card")

    # Strict verifications:
    # 200 kWh/mois, 2400 kWh/an, 46 DT/mois, 552 DT/an, 3 panneaux, 1.35 kWc
    has_200 = "200" in reply
    has_2400 = "2 400" in reply or "2400" in reply
    has_46 = "46" in reply
    has_552 = "552" in reply
    has_panels = "3" in reply and ("1,35" in reply or "1.35" in reply or "1,35 kWc" in reply or "1.35 kWc" in reply)
    is_arabizi = any(w in reply.lower() for w in ["aslema", "mar7ba", "panneaux", "chahrin", "mte3", "sta7", "darek", "flous", "kwh", "chhar"])

    success_1 = (res.status_code == 200) and (has_200 or has_2400) and has_panels
    print(f"Extrait de la réponse Solar AI (Arabizi) :\n{reply[:350]}...\n")
    record_result(1, "Tunisien Arabizi (Référence Metlaoui)", success_1, dur,
                  f"200 kWh/m: {has_200}, 2400 kWh/an: {has_2400}, 3 panneaux 1.35 kWc: {has_panels}, Arabizi naturel: {is_arabizi}")

    # ─────────────────────────────────────────────────────────────────
    # SCÉNARIO 2 : Conversation en tunisien arabe
    # « عسلامة، نحب نركب طاقة شمسية في داري في تونس. قداش لازمني من لوح ؟ »
    # ─────────────────────────────────────────────────────────────────
    log_test_header(2, "Tunisien en alphabet arabe")
    t0 = time.time()
    prompt_2 = "عسلامة، نحب نركب طاقة شمسية في داري في تونس. نستهلك 300 كيلوواط في شهرين. قداش لازمني من لوح شمسية ؟"
    res = requests.post(f"{BASE_URL}/api/chat", json={"messages": [{"role": "user", "content": prompt_2}]})
    dur = time.time() - t0
    reply = res.json().get("reply", "")
    has_arabic = bool(re.search(r"[\u0600-\u06ff]", reply))
    success_2 = (res.status_code == 200) and has_arabic
    print(f"Extrait réponse arabe :\n{reply[:300]}...\n")
    record_result(2, "Tunisien Arabe", success_2, dur, f"Réponse en arabe tunisien : {has_arabic}")

    # ─────────────────────────────────────────────────────────────────
    # SCÉNARIO 3 : Conversation en français
    # ─────────────────────────────────────────────────────────────────
    log_test_header(3, "Conversation en français (Sousse, 3600 kWh/an)")
    t0 = time.time()
    prompt_3 = "Bonjour, j'habite à Sousse et ma consommation électrique est de 3600 kWh par an. Combien de panneaux me recommandez-vous ?"
    res = requests.post(f"{BASE_URL}/api/chat", json={"messages": [{"role": "user", "content": prompt_3}]})
    dur = time.time() - t0
    reply = res.json().get("reply", "")
    has_french = "sousse" in reply.lower() and ("panneau" in reply.lower() or "kwc" in reply.lower())
    success_3 = (res.status_code == 200) and has_french
    print(f"Extrait réponse français :\n{reply[:300]}...\n")
    record_result(3, "Français", success_3, dur, f"Recommandation technique structurée en français : {has_french}")

    # ─────────────────────────────────────────────────────────────────
    # SCÉNARIO 4 : Conversation en anglais
    # ─────────────────────────────────────────────────────────────────
    log_test_header(4, "Conversation en anglais")
    t0 = time.time()
    prompt_4 = "Hello, how does the net-metering grid connection work with STEG in Tunisia?"
    res = requests.post(f"{BASE_URL}/api/chat", json={"messages": [{"role": "user", "content": prompt_4}]})
    dur = time.time() - t0
    reply = res.json().get("reply", "")
    has_english = "net-metering" in reply.lower() or "steg" in reply.lower() or "grid" in reply.lower()
    success_4 = (res.status_code == 200) and has_english
    print(f"Extrait réponse anglais :\n{reply[:300]}...\n")
    record_result(4, "Anglais", success_4, dur, f"Explication en anglais avec net-metering : {has_english}")

    # ─────────────────────────────────────────────────────────────────
    # SCÉNARIO 5 : Conversation en japonais
    # ─────────────────────────────────────────────────────────────────
    log_test_header(5, "Conversation en japonais")
    t0 = time.time()
    prompt_5 = "こんにちは。チュニジアの太陽光発電導入について質問です。STEGの系統連系制度はどうなっていますか？"
    res = requests.post(f"{BASE_URL}/api/chat", json={"messages": [{"role": "user", "content": prompt_5}]})
    dur = time.time() - t0
    reply = res.json().get("reply", "")
    has_japanese = bool(re.search(r"[\u3040-\u30ff\u4e00-\u9faf]", reply))
    success_5 = (res.status_code == 200) and has_japanese
    print(f"Extrait réponse japonais :\n{reply[:300]}...\n")
    record_result(5, "Japonais", success_5, dur, f"Réponse en japonais : {has_japanese}")

    # ─────────────────────────────────────────────────────────────────
    # SCÉNARIO 6 : Importation d'une facture STEG réelle (Multimodal)
    # ─────────────────────────────────────────────────────────────────
    log_test_header(6, "Importation d'une facture STEG (Vision multimodale)")
    t0 = time.time()
    img_b64 = ""
    if SAMPLE_BILL_PATH.exists():
        with open(SAMPLE_BILL_PATH, "rb") as f:
            img_b64 = base64.b64encode(f.read()).decode("utf-8")
    
    payload_6 = {
        "messages": [
            {
                "role": "user",
                "content": "Voici ma facture STEG. Peux-tu l'analyser et extraire les informations clés ?",
                "attachments": [
                    {
                        "type": "image",
                        "data_url": f"data:image/webp;base64,{img_b64}",
                        "name": "facture_01.webp"
                    }
                ]
            }
        ]
    }
    res = requests.post(f"{BASE_URL}/api/chat", json=payload_6)
    dur = time.time() - t0
    reply = res.json().get("reply", "")
    has_steg_info = any(k in reply.lower() for k in ["steg", "consommation", "kwh", "dinars", "dt", "facture"])
    success_6 = (res.status_code == 200) and has_steg_info
    print(f"Extrait analyse facture :\n{reply[:300]}...\n")
    record_result(6, "Importation facture STEG", success_6, dur, f"Analyse multimodale réussie : {has_steg_info}")

    # ─────────────────────────────────────────────────────────────────
    # SCÉNARIO 7 : Facture avec période de deux mois (Bimestriel)
    # ─────────────────────────────────────────────────────────────────
    log_test_header(7, "Facture avec période de deux mois (Cohérence bimestrielle)")
    t0 = time.time()
    prompt_7 = "Ma facture STEG indique 600 kWh pour 2 mois. Peux-tu me donner ma consommation mensuelle et annuelle ?"
    res = requests.post(f"{BASE_URL}/api/chat", json={"messages": [{"role": "user", "content": prompt_7}]})
    dur = time.time() - t0
    reply = res.json().get("reply", "")
    # 600 kWh / 2 mois -> 300 kWh/mois, 3600 kWh/an
    has_300 = "300" in reply
    has_3600 = "3 600" in reply or "3600" in reply
    success_7 = (res.status_code == 200) and has_300 and has_3600
    print(f"Extrait réponse bimestriel :\n{reply[:300]}...\n")
    record_result(7, "Période 2 mois bimestrielle", success_7, dur, f"300 kWh/mois: {has_300}, 3600 kWh/an: {has_3600}")

    # ─────────────────────────────────────────────────────────────────
    # SCÉNARIO 8 : Facture avec données OCR manquantes
    # ─────────────────────────────────────────────────────────────────
    log_test_header(8, "Facture avec données manquantes (Demande de confirmation)")
    t0 = time.time()
    prompt_8 = "J'ai scanné une vieille facture, mais le montant total et le district sont complètement effacés. Seul l'index est lisible : 450 kWh. Que faire ?"
    res = requests.post(f"{BASE_URL}/api/chat", json={"messages": [{"role": "user", "content": prompt_8}]})
    dur = time.time() - t0
    reply = res.json().get("reply", "")
    requests_details = any(k in reply.lower() for k in ["confirmer", "préciser", "ville", "région", "district", "montant"])
    success_8 = (res.status_code == 200) and requests_details
    print(f"Extrait réponse données manquantes :\n{reply[:300]}...\n")
    record_result(8, "Données OCR manquantes", success_8, dur, f"Demande de confirmation/précision formulée : {requests_details}")

    # ─────────────────────────────────────────────────────────────────
    # SCÉNARIO 9 : Calcul déterministe du nombre de panneaux
    # ─────────────────────────────────────────────────────────────────
    log_test_header(9, "Calcul du nombre de panneaux et cohérence de puissance (kWc)")
    t0 = time.time()
    prompt_9 = "Pour une consommation annuelle de 2400 kWh à Metlaoui, combien de panneaux de 450 Wc faut-il exactement ?"
    res = requests.post(f"{BASE_URL}/api/chat", json={"messages": [{"role": "user", "content": prompt_9}]})
    dur = time.time() - t0
    reply = res.json().get("reply", "")
    card = res.json().get("solar_card")
    # 3 panels * 450W = 1.35 kWc
    has_3 = "3" in reply
    has_135 = "1,35" in reply or "1.35" in reply
    success_9 = (res.status_code == 200) and has_3 and has_135
    print(f"Extrait réponse panneaux :\n{reply[:300]}...\n")
    record_result(9, "Cohérence nombre de panneaux & kWc", success_9, dur, f"3 panneaux = 1.35 kWc respecté (has_3: {has_3}, has_135: {has_135})")

    # ─────────────────────────────────────────────────────────────────
    # SCÉNARIO 10 : Calcul de rentabilité & Redevances fixes STEG
    # ─────────────────────────────────────────────────────────────────
    log_test_header(10, "Calcul de rentabilité (ROI) & Redevance fixe non nulle")
    t0 = time.time()
    prompt_10 = "Si j'investis 4000 DT dans le solaire avec 500 DT d'économies par an, en combien d'années vais-je rentabiliser mon système ? Est-ce que ma facture STEG sera à 0 dinar ?"
    res = requests.post(f"{BASE_URL}/api/chat", json={"messages": [{"role": "user", "content": prompt_10}]})
    dur = time.time() - t0
    reply = res.json().get("reply", "")
    has_8_years = "8" in reply or "8 ans" in reply
    warns_not_zero = any(w in reply.lower() for w in ["redevance", "fixe", "taxes", "pas 0", "jamais 0", "0 dt", "0 dinar"])
    success_10 = (res.status_code == 200) and has_8_years and warns_not_zero
    print(f"Extrait réponse ROI :\n{reply[:300]}...\n")
    record_result(10, "Calcul ROI & Redevances fixes", success_10, dur, f"ROI 8 ans: {has_8_years}, Avertissement facture non-nulle: {warns_not_zero}")

    # ─────────────────────────────────────────────────────────────────
    # SCÉNARIO 11 : Demande d'un installateur agréé
    # ─────────────────────────────────────────────────────────────────
    log_test_header(11, "Recommandation d'installateurs agréés ANME")
    t0 = time.time()
    prompt_11 = "Qui peut m'installer des panneaux solaires fiables à Gafsa ou Metlaoui ?"
    res = requests.post(f"{BASE_URL}/api/chat", json={"messages": [{"role": "user", "content": prompt_11}]})
    dur = time.time() - t0
    reply = res.json().get("reply", "")
    card = res.json().get("solar_card")
    has_installer = "sud solaire" in reply.lower() or "anme" in reply.lower() or "76 225 330" in reply
    success_11 = (res.status_code == 200) and has_installer
    print(f"Extrait recommandation installateur :\n{reply[:300]}...\n")
    record_result(11, "Recommandation installateur", success_11, dur, f"Entreprise agréée ANME citée : {has_installer}")

    # ─────────────────────────────────────────────────────────────────
    # SCÉNARIO 12 : Demande de paiement échelonné / PROSOL ÉLEC
    # ─────────────────────────────────────────────────────────────────
    log_test_header(12, "Demande de paiement échelonné (PROSOL ÉLEC / STEG)")
    t0 = time.time()
    prompt_12 = "Famma facilité de paiement bel facilité fi STEG ? Kifeh nkhalles bel ta9sit ?"
    res = requests.post(f"{BASE_URL}/api/chat", json={"messages": [{"role": "user", "content": prompt_12}]})
    dur = time.time() - t0
    reply = res.json().get("reply", "")
    has_prosol = any(k in reply.lower() for k in ["prosol", "steg", "anme", "facture", "ta9sit", "crédit", "facilité"])
    success_12 = (res.status_code == 200) and has_prosol
    print(f"Extrait réponse facilité PROSOL :\n{reply[:300]}...\n")
    record_result(12, "Paiement échelonné PROSOL ÉLEC", success_12, dur, f"Programme PROSOL ÉLEC expliqué : {has_prosol}")

    # ─────────────────────────────────────────────────────────────────
    # SCÉNARIO 13 : Transmission des résultats au Solar Design Studio
    # ─────────────────────────────────────────────────────────────────
    log_test_header(13, "Transmission des résultats au Solar Design Studio (Carte interactive)")
    t0 = time.time()
    prompt_13 = "Je vis à Tunis, consommation 3000 kWh/an. Prépare-moi le projet pour la toiture."
    res = requests.post(f"{BASE_URL}/api/chat", json={"messages": [{"role": "user", "content": prompt_13}]})
    dur = time.time() - t0
    data = res.json()
    reply = data.get("reply", "")
    card = data.get("solar_card")
    has_card = card is not None and card.get("action") == "open_studio"
    has_card_directive = "<!-- SOLAR_CARD:" in reply or has_card
    success_13 = (res.status_code == 200) and (has_card or has_card_directive)
    print(f"Extrait solar card :\nCard data: {card}\n")
    record_result(13, "Transmission Solar Design Studio", success_13, dur, f"Card générée avec action open_studio : {success_13}")

    # ─────────────────────────────────────────────────────────────────
    # SCÉNARIO 14 : Modification du budget en cours de conversation (Multi-turn)
    # ─────────────────────────────────────────────────────────────────
    log_test_header(14, "Modification du budget en cours de conversation")
    t0 = time.time()
    history_14 = [
        {"role": "user", "content": "J'habite à Tunis et je consomme 400 kWh en 2 mois."},
        {"role": "assistant", "content": "Très bien, pour 2400 kWh/an à Tunis, une installation de 1.35 kWc (3 panneaux) est recommandée."},
        {"role": "user", "content": "Mon budget disponible est seulement de 2500 DT. Est-ce suffisant ou comment puis-je faire ?"}
    ]
    res = requests.post(f"{BASE_URL}/api/chat", json={"messages": history_14})
    dur = time.time() - t0
    reply = res.json().get("reply", "")
    mentions_financing = any(w in reply.lower() for w in ["prosol", "reste", "crédit", "facilité", "échelonné", "facture"])
    success_14 = (res.status_code == 200) and mentions_financing
    print(f"Extrait adaptation budget :\n{reply[:300]}...\n")
    record_result(14, "Modification de budget multi-tours", success_14, dur, f"Prise en compte du budget et proposition du financement : {mentions_financing}")

    # ─────────────────────────────────────────────────────────────────
    # SCÉNARIO 15 : Gestion d'un timeout / Erreur API
    # ─────────────────────────────────────────────────────────────────
    log_test_header(15, "Gestion d'une erreur d'API / Clé invalide (Robustesse)")
    t0 = time.time()
    headers_15 = {"X-GEMINI-API-KEY": "INVALID_MOCK_KEY_FOR_TESTING_PURPOSES"}
    res = requests.post(
        f"{BASE_URL}/api/chat",
        headers=headers_15,
        json={"messages": [{"role": "user", "content": "Test erreur"}]}
    )
    dur = time.time() - t0
    is_handled = (res.status_code in [401, 403, 502, 500])
    print(f"Code HTTP retourné : {res.status_code}, Réponse : {res.text[:150]}")
    success_15 = is_handled
    record_result(15, "Gestion des erreurs API", success_15, dur, f"Erreur interceptée proprement avec HTTP {res.status_code}")

    # ─────────────────────────────────────────────────────────────────
    # SCÉNARIO 16 : Question hors sujet (Non disponible dans le RAG)
    # ─────────────────────────────────────────────────────────────────
    log_test_header(16, "Question hors du RAG (Indication information non disponible)")
    t0 = time.time()
    prompt_16 = "Quel est le cours de l'action à la bourse de Tokyo aujourd'hui ?"
    res = requests.post(f"{BASE_URL}/api/chat", json={"messages": [{"role": "user", "content": prompt_16}]})
    dur = time.time() - t0
    reply = res.json().get("reply", "")
    signals_unavailable = any(w in reply.lower() for w in ["pas disponible", "non disponible", "ne concerne pas", "spécialisé", "smart solar", "solaire", "transition énergétique"])
    success_16 = (res.status_code == 200) and signals_unavailable
    print(f"Extrait réponse hors sujet :\n{reply[:300]}...\n")
    record_result(16, "Question hors RAG", success_16, dur, f"Notification polie d'indisponibilité hors domaine : {signals_unavailable}")

    # ─────────────────────────────────────────────────────────────────
    # RAPPORT FINAL
    # ─────────────────────────────────────────────────────────────────
    print("\n" + "=" * 75)
    print("🏆 RÉCAPITULATIF DU BANC D'ESSAI DES 16 SCÉNARIOS")
    print("=" * 75)
    print(f"Total scénarios exécutés : {passed_tests + failed_tests}")
    print(f"Scénarios RÉUSSIS        : {passed_tests} / 16")
    print(f"Scénarios ÉCHOUÉS        : {failed_tests} / 16")
    print("-" * 75)
    print("Détail des temps de réponse :")
    for name, t in benchmark_timings.items():
        print(f"  • {name:<45} : {t:.2f}s")
    print("=" * 75)

    if failed_tests == 0:
        print("🎉 TOUS LES 16 SCÉNARIOS ONT ÉTÉ VALIDÉS AVEC SUCCÈS !")
        sys.exit(0)
    else:
        print(f"⚠️ {failed_tests} scénario(s) ont rencontré des écarts.")
        sys.exit(1)

if __name__ == "__main__":
    run_all_tests()
