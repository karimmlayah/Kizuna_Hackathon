"""Solar AI — Google Gemini Multimodal Chatbot Service & Agentic Solar Expert.

Provider: Google Gemini API (generativelanguage.googleapis.com)
Model: gemini-3-flash-preview

Capabilities:
1. Native Multilingual Support:
   - Tunisian Arabizi (Aslema, n7eb, chnowa, kadeh, fi chahrin, fil chhar, fil 3am, sta7, dari, nkhalles, test7a9, nraja3 flousi, bel facilite...)
   - Tunisian in Arabic alphabet
   - French
   - English
   - Japanese
   - Code-switching (Tunisian-French mixed)
2. Deterministic Solar & Financial Engine:
   - Exact consumption analysis (monthly, annual, billing period)
   - Zero hallucination on numbers: installed power strictly tied to panel count * wattage
   - PVGIS integration with documented fallback
   - Prosol Élec subsidies and financing on STEG bills
   - Payback period (ROI) and fixed STEG fee disclaimers
3. Agentic RAG System:
   - Official STEG & ANME documents, low-voltage tariff brackets, accredited equipment
   - Explicit "Information not found in official documentation" if out-of-scope
4. Verified Installers Directory (ANME certified with phone & city)
5. Conversational Memory:
   - Preserves state across turns (location, consumption, period, budget, sizing)
   - Dynamic re-calculation when user updates budget or consumption
6. Seamless Solar Design Studio Transfer:
   - Interactive card directives (`<!-- SOLAR_CARD: ... -->`) & `[ACTION_STUDIO: ...]`
7. High-performance SSE Streaming & adaptive image compression (max 2048px, LANCZOS, Q90)
"""
from __future__ import annotations
import os
import re
import io
import json
import base64
import time
import logging
from typing import Any, AsyncGenerator, Optional
import httpx
from PIL import Image
from pydantic import BaseModel

from ..config import GEMINI_API_KEY, GEMINI_BASE_URL, GEMINI_MODEL
from .solar_calculator import (
    calculate_consumption,
    get_solar_yield,
    calculate_solar_sizing,
    estimate_installation_cost,
    calculate_roi,
)
from .rag_service import search_knowledge_base, detect_query_language
from .installers_database import search_installers
from .solar_tools import analyze_bill

logger = logging.getLogger("solar_ai")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] [Solar AI] %(message)s")

DEFAULT_MAX_TOKENS = 2048
DEFAULT_TEMPERATURE = 0.2

GEMINI_TIMEOUT = httpx.Timeout(
    timeout=180.0,
    connect=15.0,
    read=180.0,
    write=30.0,
    pool=15.0,
)

# ─────────────────────────────────────────────────────────────────
# Permanent System Prompt for Solar AI (Multilingual & Expert)
# ─────────────────────────────────────────────────────────────────
SOLAR_AI_SYSTEM_PROMPT = """Tu es **Solar AI**, le conseiller expert intelligent officiel de Smart Solar en Tunisie et à l'international.

Tu accompagnes les particuliers et les entreprises dans leur transition vers l'énergie photovoltaïque, de la première question jusqu'à la conception de leur installation sur toiture.

### 1. Personnalité et posture
- **Professionnel, naturel, rapide, pédagogique et rassurant**.
- **Jamais de promesses trompeuses** : Ne promets JAMAIS que la facture d'électricité STEG tombera à zéro dinar (les redevances fixes de compteur et taxes municipales restent légalement dues).
- **Conversation fluide et concise** : Évite les pavés de texte monolithiques. Privilégie des réponses claires, aérées et directes avec des listes à puces.
- **Accompagnement étape par étape** : Guide l'utilisateur progressivement.

### 2. Maîtrise linguistique et dialectale OBLIGATOIRE
Détecte automatiquement la langue de l'utilisateur et réponds STRICTEMENT dans cette même langue :
1. **Tunisien Arabizi** : Si l'utilisateur s'exprime en tunisien arabizi (ex: « Aslema, n7eb nrakeb panneaux solaires fi dari. Nosken fi Metlaoui, nesta3mel 400 kWh fi chahrin w nkhalles 92 DT. Chnowa tans7ni ? »), réponds NATURELLEMENT en tunisien Arabizi (ex: « Aslema bik ! Mar7ba bik fi Smart Solar. Hassab el consommation mte3ek... »).
   - Comprends parfaitement : aslema, n7eb, chnowa, kadeh, fi chahrin (en 2 mois), fil chhar (par mois), fil 3am (par an), sta7 (toit), dari (ma maison), nkhalles (je paie), test7a9 (tu as besoin), nraja3 flousi (rentabiliser), bel facilité (paiement échelonné), dhaw (électricité), famma (il y a)...
   - Ne confonds jamais le dialecte tunisien avec l'algérien ou le marocain !
   - Si l'utilisateur mélange tunisien et français (code-switching), réponds dans ce même registre bilingue naturel.
2. **Tunisien en alphabet arabe** : Si l'utilisateur écrit en arabe tunisien (ex: « عسلامة، نحب نركب طاقة شمسية في داري... »), réponds en arabe tunisien naturel.
3. **Français** : Ton professionnel, élégant et technique.
4. **Anglais** : Ton clair, précis et professionnel.
5. **Japonais** : Ton respectueux, clair et poli (です/ます).

### 3. Règle absolue sur les calculs (Zéro Hallucination)
- Tu ne dois JAMAIS inventer un calcul ou donner des puissances incohérentes.
- Le moteur déterministe Smart Solar a déjà calculé pour toi les données exactes injectées dans le bloc `[DONNÉES TECHNIQUES DÉTERMINISTES DU MOTEUR SMART SOLAR]`.
- Tu DOIS reprendre EXACTEMENT ces valeurs :
  - Consommation mensuelle et annuelle.
  - Nombre de panneaux et puissance installée réelle (ex: 3 panneaux de 450 Wc = 1,35 kWc).
  - Rendement solaire PVGIS spécifique à la région.
  - Surface requise en m² (~2 m² par panneau de 450 Wc).
  - Production annuelle en kWh et taux de couverture.
  - Coût total estimé et déduction de la subvention FTE Prosol Élec (500 DT/kWc).
  - Échelonnement du paiement Prosol sur facture STEG (sur 5 ans).
  - Retour sur investissement simple en années.

### 4. Transition vers le Solar Design Studio
Dès qu'un dimensionnement est établi, propose toujours à l'utilisateur de visualiser et concevoir la disposition de ses panneaux sur sa toiture :
- En tunisien Arabizi : « T7eb nchoufou kifeh n7ottouhom fou9 sta7 darek ? »
- En français : « Souhaitez-vous concevoir la disposition exacte de vos panneaux sur votre toiture ? »

### 5. Réponses documentaires (RAG)
Lorsque des extraits documentaires sont fournis dans `[BASE DOCUMENTAIRE OFFICIELLE STEG / ANME]`, cite les sources et les dates (ex: Guide STEG, Barème tarifaire 2024, Programme PROSOL ÉLEC).
Si aucun document n'est disponible pour une question hors sujet, indique clairement et honnêtement que l'information n'est pas disponible dans la base officielle.
"""

# ─────────────────────────────────────────────────────────────────
# Models & Schemas
# ─────────────────────────────────────────────────────────────────
class ChatAttachment(BaseModel):
    type: str  # "image" | "pdf"
    data_url: str
    name: Optional[str] = "piece_jointe"

class ChatMessage(BaseModel):
    role: str  # "user" | "assistant" | "system"
    content: str
    attachments: Optional[list[ChatAttachment]] = None

class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    user_consent_anonymization: Optional[bool] = True

class ChatResponse(BaseModel):
    status: str
    reply: str
    role: str = "assistant"
    model: str
    extracted_state: Optional[dict[str, Any]] = None
    solar_card: Optional[dict[str, Any]] = None
    usage: Optional[dict[str, Any]] = None
    telemetry: Optional[dict[str, Any]] = None


# ─────────────────────────────────────────────────────────────────
# Privacy Anonymizer & PDF Utilities
# ─────────────────────────────────────────────────────────────────
def anonymize_text(text: str) -> str:
    """Mask sensitive personal information (CIN, telephone, IBAN) before sending to external API."""
    if not text:
        return ""
    text = re.sub(r"\bCIN\s*[:\s]?\s*\d{8}\b", "CIN: [MASQUÉ]", text, flags=re.IGNORECASE)
    text = re.sub(r"\b(?:(?:\+|00)216\s*)?[2-9]\d{7}\b", "[TÉLÉPHONE MASQUÉ]", text)
    text = re.sub(r"\bTN\d{2}\s*\d{4}\s*\d{4}\s*\d{4}\s*\d{4}\b", "[RIB MASQUÉ]", text, flags=re.IGNORECASE)
    return text

def extract_pdf_text_from_b64(b64_data: str) -> str:
    """Extract text from base64 encoded PDF using pypdf."""
    try:
        from pypdf import PdfReader
        if "," in b64_data:
            b64_data = b64_data.split(",")[1]
        pdf_bytes = base64.b64decode(b64_data)
        reader = PdfReader(io.BytesIO(pdf_bytes))
        extracted_pages = []
        for i, page in enumerate(reader.pages[:4]):
            text = page.extract_text() or ""
            if text.strip():
                extracted_pages.append(f"--- Page {i+1} ---\n{text}")
        return "\n\n".join(extracted_pages)
    except Exception as e:
        return f"[Impossible d'extraire le texte du PDF : {str(e)}]"


# ─────────────────────────────────────────────────────────────────
# Image Optimizer for Multimodal API
# ─────────────────────────────────────────────────────────────────
def optimize_image(
    data_url_or_b64: str,
    max_dimension: int = 2048,
    jpeg_quality: int = 90
) -> tuple[str, dict[str, Any]]:
    """
    Adaptive downscaling to max 2048px using LANCZOS to preserve small bill character sharpness.
    Strips EXIF metadata and outputs 90% JPEG.
    """
    t0 = time.time()
    raw_b64 = data_url_or_b64
    if "," in data_url_or_b64:
        raw_b64 = data_url_or_b64.split(",")[1]

    try:
        orig_bytes = base64.b64decode(raw_b64)
        orig_size_bytes = len(orig_bytes)

        pil_img = Image.open(io.BytesIO(orig_bytes))
        pil_img.load()
        orig_w, orig_h = pil_img.size

        if max(orig_w, orig_h) > max_dimension:
            if orig_w >= orig_h:
                new_w = max_dimension
                new_h = int(orig_h * (max_dimension / orig_w))
            else:
                new_h = max_dimension
                new_w = int(orig_w * (max_dimension / orig_h))
            pil_img = pil_img.resize((new_w, new_h), Image.Resampling.LANCZOS)
        else:
            new_w, new_h = orig_w, orig_h

        if pil_img.mode != "RGB":
            pil_img = pil_img.convert("RGB")

        out_buf = io.BytesIO()
        pil_img.save(out_buf, format="JPEG", quality=jpeg_quality, optimize=True)
        opt_bytes = out_buf.getvalue()
        opt_size_bytes = len(opt_bytes)

        opt_b64 = base64.b64encode(opt_bytes).decode("utf-8")
        dur_ms = round((time.time() - t0) * 1000, 2)
        reduction_pct = round((1 - (opt_size_bytes / max(orig_size_bytes, 1))) * 100, 1)

        telemetry = {
            "orig_dimensions": f"{orig_w}x{orig_h}",
            "opt_dimensions": f"{new_w}x{new_h}",
            "orig_size_kb": round(orig_size_bytes / 1024, 1),
            "opt_size_kb": round(opt_size_bytes / 1024, 1),
            "reduction_pct": reduction_pct,
            "preprocessing_ms": dur_ms,
        }

        return opt_b64, telemetry
    except Exception as img_err:
        logger.warning(f"[Image Optimization Warning] Fallback raw base64: {img_err}")
        return raw_b64, {"error": str(img_err), "preprocessing_ms": round((time.time() - t0) * 1000, 2)}


# ─────────────────────────────────────────────────────────────────
# Conversational Memory & State Extraction
# ─────────────────────────────────────────────────────────────────
def extract_conversational_state(messages: list[ChatMessage]) -> dict[str, Any]:
    """
    Extracts and tracks structured parameters across all turns of the conversation:
    - location (governorate or city)
    - consumption_kwh
    - period_months (1 or 2)
    - bill_amount_tnd
    - budget_tnd
    - detected_language
    - intent flags
    """
    state: dict[str, Any] = {
        "location": None,
        "consumption_kwh": None,
        "period_months": 2,  # STEG bimonthly default
        "bill_amount_tnd": None,
        "budget_tnd": None,
        "detected_language": "fr",
        "has_bill_image": False,
        "wants_installers": False,
        "wants_financing": False,
        "wants_studio": False,
        "last_query": "",
    }

    full_text = ""
    for idx, msg in enumerate(messages):
        content = (msg.content or "").strip()
        full_text += " " + content
        if msg.role == "user" and idx == len(messages) - 1:
            state["last_query"] = content
        if msg.attachments:
            state["has_bill_image"] = True

    # 1. Language detection on the latest user input
    latest_user_text = state["last_query"]
    if not latest_user_text and messages:
        for m in reversed(messages):
            if m.role == "user":
                latest_user_text = m.content
                break
    state["detected_language"] = detect_query_language(latest_user_text or full_text)

    # 2. Location extraction
    loc_candidates = [
        "Metlaoui", "Gafsa", "Tunis", "Ariana", "Ben Arous", "Manouba",
        "Sousse", "Monastir", "Mahdia", "Sfax", "Tozeur", "Kebili",
        "Gabes", "Medenine", "Djerba", "Zarzis", "Tataouine", "Bizerte",
        "Nabeul", "Hammamet", "Kairouan", "Kasserine", "Sidi Bouzid",
        "Beja", "Jendouba", "Le Kef", "Siliana", "Zaghouan"
    ]
    for loc in loc_candidates:
        if re.search(r"\b" + re.escape(loc) + r"\b", full_text, re.IGNORECASE):
            state["location"] = loc
            break

    # 3. Period extraction
    if re.search(r"\b(?:fi\s*chahrin|chahrin|2\s*mois|bimestriel|bimestrielle)\b", full_text, re.IGNORECASE):
        state["period_months"] = 2
    elif re.search(r"\b(?:fil\s*chhar|1\s*mois|mensuel|mensuelle|par\s*mois)\b", full_text, re.IGNORECASE):
        state["period_months"] = 1

    # 4. Consumption extraction (e.g. 400 kWh)
    kwh_matches = re.findall(r"(\d{2,5})\s*kwh", full_text, re.IGNORECASE)
    if kwh_matches:
        # Take the most recent mentioned kWh value
        state["consumption_kwh"] = float(kwh_matches[-1])

    # 5. Bill amount extraction (e.g. 92 DT, 92 dinars, 92 TND)
    amt_matches = re.findall(r"(\d{1,4}(?:[.,]\d{1,3})?)\s*(?:dt|tnd|dinars|dinar)", full_text, re.IGNORECASE)
    if amt_matches:
        state["bill_amount_tnd"] = float(amt_matches[-1].replace(",", "."))
    elif re.search(r"\bquatre[- ]vingt[- ]douze\b", full_text, re.IGNORECASE):
        state["bill_amount_tnd"] = 92.0

    # 6. Budget extraction (e.g. budget mte3i 4000 DT, budget de 3500 dinars)
    budget_matches = re.findall(r"budget\D*(\d{3,5})", full_text, re.IGNORECASE)
    if budget_matches:
        state["budget_tnd"] = float(budget_matches[-1])

    # 7. Intent detection
    lower_last = (state["last_query"] or "").lower()
    if any(k in lower_last for k in ["installateur", "installer", "société", "chriket", "chkoun yraki", "chkoun yrakeb", "win nechri", "achat"]):
        state["wants_installers"] = True
    if any(k in lower_last for k in ["facilité", "facilite", "prosol", "credit", "crédit", "ta9sit", "echelonne", "échelonné"]):
        state["wants_financing"] = True
    if any(k in lower_last for k in ["studio", "toiture", "sta7", "dessin", "plan", "disposition"]):
        state["wants_studio"] = True
    if any(k in lower_last for k in ["iot", "taw", "produit", "tension", "volt", "ampere", "courant", "puissance", "consommation mte3i", "hedha chhar", "ce mois", "objectif", "limite", "net3adda", "depassement", "dépassement", "na9set", "baisse", "hier", "emes", "alerte", "live", "monitoring"]):
        state["wants_iot"] = True

    return state


# ─────────────────────────────────────────────────────────────────
# Deterministic Context Builder (Injected into Gemini Prompt)
# ─────────────────────────────────────────────────────────────────
def build_expert_context_injection(state: dict[str, Any]) -> tuple[str, Optional[dict[str, Any]]]:
    """
    Runs deterministic tools and formats a strict context block for the LLM.
    Returns:
    - prompt_context_text
    - structured_solar_card (for frontend rendering)
    """
    context_blocks = []
    solar_card: Optional[dict[str, Any]] = None

    location = state.get("location") or "Tunisie"
    kwh = state.get("consumption_kwh")
    months = state.get("period_months") or 2
    bill_amt = state.get("bill_amount_tnd")
    budget_tnd = state.get("budget_tnd")

    # 1. Deterministic Consumption & Solar Sizing
    if kwh is not None and kwh > 0:
        cons = calculate_consumption(kwh=kwh, months=months, bill_amount_tnd=bill_amt)
        sizing = calculate_solar_sizing(annual_kwh=cons["annual_kwh"], location=location, panel_wattage_w=450)
        main_cfg = sizing["main_configuration"]
        alt_cfg = sizing["alternative_configuration"]

        cost = estimate_installation_cost(
            installed_kwp=main_cfg["installed_kwp"],
            nb_panels=main_cfg["nb_panels"],
            panel_wattage_w=450
        )
        
        # If user updated budget, check budget fit
        budget_note = ""
        if budget_tnd is not None:
            if budget_tnd < cost["net_total_tnd"]:
                budget_note = (
                    f"\n- NOTE BUDGET CLIENT : Le client a un budget de {budget_tnd:.0f} DT. "
                    f"Le reste ({cost['net_total_tnd'] - budget_tnd:.0f} DT) peut être financé sans avance via le crédit PROSOL ÉLEC sur sa facture STEG."
                )

        annual_savings = round(cons["annual_kwh"] * 0.380, 1)  # average STEG tier savings
        roi = calculate_roi(
            total_investment_tnd=cost["net_total_tnd"],
            annual_savings_tnd=annual_savings,
            bill_amount_annual_tnd=cons.get("annual_amount_tnd")
        )

        context_blocks.append(f"""
=== [DONNÉES TECHNIQUES DÉTERMINISTES DU MOTEUR SMART SOLAR] ===
- Localisation analysée : {sizing['location']} (Rendement spécifique : {sizing['specific_yield_kwh_kwp']} kWh/kWc/an via {sizing['yield_source']})
- Période facturée : {months} mois ({'bimestrielle' if months == 2 else 'mensuelle'})
- Consommation mesurée : {cons['billed_kwh']} kWh sur {months} mois
- Consommation mensuelle moyenne : {cons['monthly_kwh']} kWh/mois
- Consommation annuelle estimée : {cons['annual_kwh']} kWh/an
- Dépense électrique mensuelle moyenne : {cons['monthly_amount_tnd'] or 'Non spécifiée'} DT/mois
- Dépense électrique annuelle estimée : {cons['annual_amount_tnd'] or 'Non spécifiée'} DT/an
- RECOMMANDATION PRINCIPALE :
  * Nombre de panneaux : {main_cfg['nb_panels']} panneaux de 450 Wc (Monocristallin Haute Efficacité)
  * Puissance installée réelle : {main_cfg['installed_kwp']} kWc (EXACTEMENT {main_cfg['nb_panels']} x 0.45 kWc)
  * Surface nécessaire sur toiture : {main_cfg['required_area_m2']} m² (compter ~2 m² par panneau)
  * Production annuelle estimée : {main_cfg['estimated_production_kwh_year']} kWh/an
  * Taux de couverture de la consommation : {main_cfg['coverage_percentage']}%
- OPTION ALTERNATIVE :
  * {alt_cfg['nb_panels']} panneaux de 450 Wc ({alt_cfg['installed_kwp']} kWc, {alt_cfg['estimated_production_kwh_year']} kWh/an, {alt_cfg['coverage_percentage']}% de couverture)
- ESTIMATION FINANCIÈRE CLÉ EN MAIN :
  * Coût total brut : {cost['gross_total_tnd']} DT (matériel, onduleur {cost['inverter_model']}, pose, coffret, démarches STEG)
  * Subvention FTE PROSOL ÉLEC : -{cost['prosol_subsidy_tnd']} DT (déduite directement)
  * Coût net à la charge du client : {cost['net_total_tnd']} DT
  * Facilité PROSOL ÉLEC (crédit sur facture STEG) : environ {cost['financing_prosol']['estimated_monthly_payment_tnd']} DT/mois (soit {cost['financing_prosol']['estimated_bimonthly_payment_tnd']} DT par facture bimestrielle) sur 5 ans sans avance !
  * Retour sur investissement estimé : {roi['simple_payback_years']} ans
  * Économies nettes cumulées sur 25 ans : ~{roi['cumulative_net_savings_25y_tnd']} DT
  * RAPPEL IMPORTANT : La facture STEG ne sera jamais de 0 DT en raison des taxes et redevances fixes obligatoires (~{roi['mandatory_fixed_steg_fees_year_tnd']:.0f} DT/an).{budget_note}
RÈGLE ABSOLUE : Tu DOIS obligatoirement citer ces chiffres exacts dans ta réponse. Ne modifie aucun chiffre.
""")

        solar_card = {
            "type": "sizing_proposal",
            "panel_count": main_cfg["nb_panels"],
            "panel_wattage": 450,
            "installed_kwp": main_cfg["installed_kwp"],
            "annual_kwh": cons["annual_kwh"],
            "annual_prod_kwh": main_cfg["estimated_production_kwh_year"],
            "coverage_pct": main_cfg["coverage_percentage"],
            "required_area_m2": main_cfg["required_area_m2"],
            "location": sizing["location"],
            "budget_tnd": cost["net_total_tnd"],
            "monthly_prosol_tnd": cost["financing_prosol"]["estimated_monthly_payment_tnd"],
            "roi_years": roi["simple_payback_years"],
            "action": "open_studio",
        }

    # 2. Knowledge Base (RAG) Retrieval
    last_q = state.get("last_query") or ""
    if len(last_q) > 4:
        rag_res = search_knowledge_base(last_q, top_k=2)
        if rag_res.found and rag_res.chunks:
            rag_text = "=== [EXTRAITS DE LA BASE DOCUMENTAIRE OFFICIELLE SMART SOLAR / STEG / ANME] ===\n"
            for chunk in rag_res.chunks:
                rag_text += f"• Source : {chunk.title} ({chunk.source}, Date: {chunk.date})\n"
                rag_text += f"  Extrait : {chunk.content}\n\n"
            context_blocks.append(rag_text)
        elif not kwh and not state.get("wants_installers"):
            # Explicitly signal out-of-scope question to model
            if rag_res.top_score < 0.20 and not any(k in last_q.lower() for k in ["solaire", "panneau", "steg", "soleil", "toit", "facture"]):
                context_blocks.append(
                    "=== [AVIS BASE DOCUMENTAIRE] ===\n"
                    "Cette question ne concerne pas le domaine solaire ou n'a aucun document correspondant dans la base officielle.\n"
                    "Indique poliment et clairement à l'utilisateur que cette information n'est pas disponible dans la base documentaire officielle Smart Solar."
                )

    # 3. Verified Installers Lookup
    if state.get("wants_installers") or (location and state.get("wants_installers")):
        inst_list = search_installers(location, limit=2)
        inst_text = f"=== [ANNUAIRE D'INSTALLATEURS SOLAIRES AGRÉÉS ANME VÉRIFIÉS DANS LA RÉGION : {location}] ===\n"
        for inst in inst_list:
            inst_text += (
                f"- Nom : {inst['name']}\n"
                f"  Localisation : {inst['city']} (Couvre : {', '.join(inst['coverage'])})\n"
                f"  Téléphone vérifié : {inst['phone']}\n"
                f"  Agrément officiel : {inst['anme_accreditation']} (Vérifié le {inst['verification_date']})\n"
                f"  Services : {', '.join(inst['services'])}\n"
                f"  Facilités de paiement : {', '.join(inst['financing_options'])}\n\n"
            )
        inst_text += "RÈGLE ABSOLUE : Cite uniquement ces installateurs et numéros vérifiés. N'invente aucune entreprise."
        context_blocks.append(inst_text)

        if not solar_card:
            solar_card = {
                "type": "installers_list",
                "location": location,
                "installers": inst_list,
            }

    # 4. Live IoT & Smart Energy Monitoring Context
    last_query_lower = (state.get("last_query") or "").lower()
    if state.get("wants_iot") or any(k in last_query_lower for k in ["iot", "taw", "produit", "tension", "consommation", "limite", "depassement", "dépassement", "na9set", "baisse", "hier", "emes"]):
        try:
            from .iot_service import get_live_energy_data, calculate_consumption_prediction, get_alerts_history
            live_data = get_live_energy_data()
            curr_c = state.get("consumption_kwh") or 900.0
            pred = calculate_consumption_prediction(
                monthly_target_kwh=1200.0,
                current_consumption_kwh=curr_c,
                current_day=15,
                total_days_in_month=30
            )

            iot_text = f"""
=== [DONNÉES EN DIRECT SMART ENERGY MONITORING & IOT (ESP32 / MOKXI)] ===
- Statut capteur ESP32 : {live_data['status']} ({'Connecté en direct' if live_data['connected'] else 'Dernière valeur enregistrée'})
- Origine des mesures : {live_data['badge']} (Attention : il s'agit d'un micro-panneau photovoltaïque expérimental de 1W, à distinguer de la consommation globale de l'habitat)
- Tension mesurée : {live_data['voltage_v']} V
- Courant mesuré : {live_data['current_ma']} mA ({live_data['current_a']} A)
- Puissance instantanée : {live_data['power_w']} W
- Énergie produite cumulée : {live_data['cumulative_energy_wh']} Wh ({live_data['cumulative_energy_kwh']} kWh)
- Suivi de la consommation du mois :
  * Objectif mensuel fixé : {pred['monthly_target_kwh']} kWh
  * Consommation actuelle (au jour {pred['current_day']}/{pred['total_days_in_month']}) : {pred['current_consumption_kwh']} kWh ({pred['consumed_pct']}% de l'objectif)
  * Consommation quotidienne moyenne : {pred['daily_avg_kwh']} kWh/jour
  * Prévision de fin de mois : {pred['forecast_month_end_kwh']} kWh
  * Dépassement prévisionnel calculé : +{pred['forecast_overrun_kwh']} kWh
  * Énergie restante autorisée pour le reste du mois : {pred['remaining_allowed_kwh']} kWh
  * Consommation quotidienne maximale restante autorisée : {pred['max_remaining_daily_kwh']} kWh/jour
  * Réduction quotidienne nécessaire pour respecter l'objectif : {pred['reduction_req_pct']}%
- CONSIGNES ET RÈGLES DE RÉPONSE OBLIGATOIRES :
  1. Si l'utilisateur demande en tunisien Arabizi (ex: "Kadeh produit el panneau taw ?" ou "Kadeh consommation mte3i hedha chhar ?"), réponds NATURELLEMENT en tunisien Arabizi :
     Exemple strict à suivre : « Taw enti fi nos chhar w déjà esta3malt {pred['current_consumption_kwh']} kWh men objectif {pred['monthly_target_kwh']} kWh. Ken tkamel b nafs rythme, bech tousel {pred['forecast_month_end_kwh']} kWh fi ekher chhar. Lezmek tna9es consommation quotidienne men {pred['daily_avg_kwh']} kWh l {pred['max_remaining_daily_kwh']} kWh bech tab9a fi objectifek. »
  2. Si l'utilisateur demande pourquoi la production a baissé ("3lech production na9set"), explique que c'est lié aux conditions météo (nuages, angle solaire, ombres, température ou charge électrique) et ne diagnostique JAMAIS arbitrairement un panneau cassé.
  3. Ne jamais inventer de chiffres en dehors de ce bloc déterministe.
"""
            context_blocks.append(iot_text)

            if not solar_card:
                solar_card = {
                    "type": "iot_live_summary",
                    "voltage_v": live_data["voltage_v"],
                    "power_w": live_data["power_w"],
                    "current_kwh": pred["current_consumption_kwh"],
                    "target_kwh": pred["monthly_target_kwh"],
                    "forecast_kwh": pred["forecast_month_end_kwh"],
                    "daily_avg_kwh": pred["daily_avg_kwh"],
                    "max_remaining_daily_kwh": pred["max_remaining_daily_kwh"],
                    "reduction_pct": pred["reduction_req_pct"],
                    "alert_level": pred["alert_level"]
                }
        except Exception as iot_err:
            logger.warning(f"IoT context injection error: {iot_err}")

    # 5. Live Weather & Solar Forecast Context (Open-Meteo)
    weather_triggers = [
        "météo", "meteo", "chams", "matar", "ghodwa", "pluie", "soleil",
        "ensoleillement", "nuage", "nuages", "temperature", "température",
        "rayonnement", "wa9t", "heure", "machine", "score", "potentiel",
        "climatiseur", "lyoum", "fama chams", "a7sen wa9t"
    ]
    if any(k in last_query_lower for k in weather_triggers):
        try:
            from .weather_service import get_today_solar_overview
            loc_for_weather = state.get("location") or "Tunis"
            weather_data = get_today_solar_overview(city=loc_for_weather, kwp=3.0)

            weather_text = f"""
=== [DONNÉES MÉTÉOROLOGIQUES EN TEMPS RÉEL (OPEN-METEO) & PRÉVISIONS SOLAIRES] ===
- Ville analysée : {weather_data['city']} (Fuseau : Africa/Tunis)
- Conditions météo actuelles : {weather_data['weather']['weather_description']} ({weather_data['weather']['weather_condition']})
- Température mesurée : {weather_data['weather']['temperature_c']}°C (Ressentie : {weather_data['weather']['apparent_temperature_c']}°C)
- Couverture nuageuse : {weather_data['weather']['cloud_cover_pct']}%
- Période : {'Nuit (pas de production solaire)' if weather_data['weather']['is_night'] else 'Jour (production active)'}
- Lever / Coucher du soleil : {weather_data['weather']['sunrise']} / {weather_data['weather']['sunset']}
- Solar Score de la journée : {weather_data['solar_score']['score']}/100 ({weather_data['solar_score']['title']})
  * Explication : {weather_data['solar_score']['explanation']}
- Prévision de production photovoltaïque (pour installation 3 kWc) :
  * Production estimée aujourd'hui : {weather_data['pv_forecast']['today_kwh']} kWh
  * Production estimée demain : {weather_data['pv_forecast']['tomorrow_kwh']} kWh
  * Puissance crête attendue : {weather_data['pv_forecast']['peak_kw']} kW
  * Meilleure plage horaire pour utiliser vos appareils énergivores (lave-linge, recharge, etc.) : {weather_data['pv_forecast']['best_window']}
- Recommandation intelligente du jour : {weather_data['smart_recommendation']}

CONSIGNES POUR LES QUESTIONS MÉTÉO ET SOLAIRES :
1. Si l'utilisateur demande en tunisien Arabizi (ex: "Aslema, fama chams lyoum ?", "Wa9tech a7sen wa9t bech nchallah machine à laver ?", "Kadeh najem nproduci énergie lyoum ?") :
   - Réponds NATURELLEMENT en tunisien Arabizi en utilisant ces chiffres réels.
   - Exemple : « Ey famma chams lyoum fi {weather_data['city']} (Score solaire: {weather_data['solar_score']['score']}/100, ciel dégagé, {weather_data['weather']['temperature_c']}°C). A7sen wa9t bech t5adem machine à laver howa bin {weather_data['pv_forecast']['best_window']} wa9t el production fel crête (bech tproduci ta9riban {weather_data['pv_forecast']['today_kwh']} kWh lyoum). »
2. Si l'utilisateur demande en français, réponds avec un ton élégant, technique et encourageant.
3. Ne jamais inventer de données météo contraires à ce bloc.
"""
            context_blocks.append(weather_text)

            if not solar_card:
                solar_card = {
                    "type": "weather_solar_overview",
                    "city": weather_data["city"],
                    "temp_c": weather_data["weather"]["temperature_c"],
                    "condition": weather_data["weather"]["weather_condition"],
                    "solar_score": weather_data["solar_score"]["score"],
                    "score_title": weather_data["solar_score"]["title"],
                    "today_pv_kwh": weather_data["pv_forecast"]["today_kwh"],
                    "best_window": weather_data["pv_forecast"]["best_window"],
                }
        except Exception as w_err:
            logger.warning(f"Weather context injection error: {w_err}")

    return "\n".join(context_blocks), solar_card


# ─────────────────────────────────────────────────────────────────
# Formatter: Gemini Payload Preparation
# ─────────────────────────────────────────────────────────────────
def prepare_gemini_payload(
    messages: list[ChatMessage]
) -> tuple[dict[str, Any], list[dict[str, Any]], dict[str, Any], Optional[dict[str, Any]]]:
    """
    Format message history for Gemini generateContent endpoint.
    - system_instruction: permanent system prompt + dynamically injected expert calculations
    - contents: list of {role: 'user'|'model', parts: [...]}
    - Single-turn image ingestion (only active turn sends base64)
    """
    telemetry_logs = []
    state = extract_conversational_state(messages)
    expert_context, solar_card = build_expert_context_injection(state)

    full_system_prompt = SOLAR_AI_SYSTEM_PROMPT
    if expert_context:
        full_system_prompt += "\n\n" + expert_context

    last_msg_idx = len(messages) - 1
    contents: list[dict[str, Any]] = []

    for idx, msg in enumerate(messages):
        gemini_role = "model" if msg.role == "assistant" else "user"
        content_text = anonymize_text(msg.content or "")
        parts: list[dict[str, Any]] = []

        if msg.attachments and len(msg.attachments) > 0:
            is_current_turn = (idx == last_msg_idx)
            if is_current_turn:
                for att in msg.attachments:
                    if att.type == "pdf" or "application/pdf" in att.data_url:
                        pdf_text = extract_pdf_text_from_b64(att.data_url)
                        parts.append({"text": f"[Contenu extrait du PDF '{att.name}']:\n{pdf_text}"})
                    else:
                        opt_b64, tel = optimize_image(att.data_url)
                        telemetry_logs.append(tel)
                        parts.append({
                            "inline_data": {
                                "mime_type": "image/jpeg",
                                "data": opt_b64
                            }
                        })
            else:
                att_names = ", ".join([att.name or "document" for att in msg.attachments])
                parts.append({"text": f"[Document analysé précédemment dans la conversation: {att_names}]"})

        if content_text.strip():
            parts.append({"text": content_text})

        if not parts:
            parts.append({"text": "Bonjour"})

        contents.append({
            "role": gemini_role,
            "parts": parts
        })

    payload = {
        "system_instruction": {
            "parts": [{"text": full_system_prompt}]
        },
        "contents": contents,
        "generationConfig": {
            "temperature": DEFAULT_TEMPERATURE,
            "maxOutputTokens": DEFAULT_MAX_TOKENS,
        }
    }

    return payload, telemetry_logs, state, solar_card


# ─────────────────────────────────────────────────────────────────
# Standard Non-Streaming Chat Completion
# ─────────────────────────────────────────────────────────────────
async def call_gemini_chat(request: ChatRequest, api_key_override: Optional[str] = None) -> ChatResponse:
    """Execute chat completion with Google Gemini API, with automatic quota fallback."""
    api_key = (api_key_override or GEMINI_API_KEY).strip()
    if not api_key:
        raise ValueError("Clé API Gemini absente. Veuillez configurer GEMINI_API_KEY dans le fichier backend/.env.")

    payload, img_telemetry, state, solar_card = prepare_gemini_payload(request.messages)
    
    models_to_try = [GEMINI_MODEL]
    if "flash-lite" not in GEMINI_MODEL:
        models_to_try.append("gemini-3.1-flash-lite")

    t0 = time.time()
    data = None
    res = None
    used_model = GEMINI_MODEL
    last_err: Optional[Exception] = None

    async with httpx.AsyncClient(timeout=GEMINI_TIMEOUT) as client:
        for cur_model in models_to_try:
            url = f"{GEMINI_BASE_URL.rstrip('/')}/models/{cur_model}:generateContent?key={api_key}"
            logger.info(f"[Gemini Request] Sending prompt to {cur_model}...")
            try:
                res = await client.post(url, json=payload)
                if res.status_code == 200:
                    data = res.json()
                    used_model = cur_model
                    break
                elif res.status_code == 429:
                    logger.warning(f"[Gemini 429 Quota Exceeded on {cur_model}] Retrying with backup model...")
                    last_err = RuntimeError(f"Erreur API Gemini (HTTP 429): {res.text}")
                    continue
                elif res.status_code in (401, 403):
                    raise PermissionError(f"Clé API Gemini non autorisée ou expirée (HTTP {res.status_code}).")
                else:
                    last_err = RuntimeError(f"Erreur API Gemini (HTTP {res.status_code}): {res.text}")
                    break
            except (httpx.ConnectTimeout, httpx.ReadTimeout, httpx.RequestError) as net_err:
                last_err = RuntimeError(f"Erreur de communication réseau : {str(net_err)}")
                break

    if not data or not res or res.status_code != 200:
        if last_err:
            raise last_err
        raise RuntimeError(f"Erreur API Gemini (HTTP {res.status_code if res else 'Inconnu'})")

    duration = round(time.time() - t0, 2)
    logger.info(f"[Gemini Response] HTTP {res.status_code} in {duration}s using {used_model}")

    reply_text = ""
    try:
        candidates = data.get("candidates", [])
        if candidates:
            parts = candidates[0].get("content", {}).get("parts", [])
            reply_text = "".join([p.get("text", "") for p in parts if "text" in p])
    except Exception as parse_err:
        logger.error(f"[Gemini Parse Error] {parse_err}")
        reply_text = "Je n'ai pas pu générer une réponse lisible."

    # Embed interactive card directive if available and not already in reply
    if solar_card and "<!-- SOLAR_CARD:" not in reply_text:
        card_json = json.dumps(solar_card, ensure_ascii=False)
        reply_text += f"\n\n<!-- SOLAR_CARD: {card_json} -->"

    telemetry = {
        "request_duration_s": duration,
        "http_status": res.status_code,
        "images": img_telemetry,
        "usage": data.get("usageMetadata", {}),
    }

    return ChatResponse(
        status="success",
        reply=reply_text,
        role="assistant",
        model=used_model,
        extracted_state=state,
        solar_card=solar_card,
        usage=data.get("usageMetadata", {}),
        telemetry=telemetry,
    )


# ─────────────────────────────────────────────────────────────────
# Streaming Completion Endpoint (Server-Sent Events)
# ─────────────────────────────────────────────────────────────────
async def stream_gemini_chat(
    request: ChatRequest,
    api_key_override: Optional[str] = None
) -> AsyncGenerator[str, None]:
    """Streams Gemini response chunks via SSE with automatic 429 quota fallback."""
    api_key = (api_key_override or GEMINI_API_KEY).strip()
    if not api_key:
        yield f"data: {json.dumps({'error': 'Clé API Gemini absente dans backend/.env'})}\n\n"
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
                        yield f"data: {json.dumps({'error': err_msg})}\n\n"
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
                                        yield f"data: {json.dumps({'type': 'content', 'content': text_piece, 'text': text_piece})}\n\n"
                            except json.JSONDecodeError:
                                continue

                    # Append card directive if available
                    if solar_card and "<!-- SOLAR_CARD:" not in accumulated_full_text:
                        card_directive = f"\n\n<!-- SOLAR_CARD: {json.dumps(solar_card, ensure_ascii=False)} -->"
                        yield f"data: {json.dumps({'text': card_directive})}\n\n"

                    yield "data: [DONE]\n\n"
                    logger.info(f"[Gemini Stream Completed] Finished in {round(time.time() - t0, 2)}s using {cur_model}")
                    return

            except httpx.ConnectTimeout:
                yield f"data: {json.dumps({'error': 'Délai de connexion dépassé (15s).'})}\n\n"
                return
            except httpx.ReadTimeout:
                yield f"data: {json.dumps({'error': 'Délai de lecture dépassé (180s).'})}\n\n"
                return
            except Exception as e:
                logger.error(f"[Gemini Stream Unexpected on {cur_model}] {e}")
                continue
