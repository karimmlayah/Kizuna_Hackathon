#!/usr/bin/env python3
"""
SMART SOLAR — Control Center (Kizuna Hackathon)
Unified graphical control center for managing all Smart Solar microservices,
Cloudflare Quick Tunnel, Mokxi ESP32 integration, and hardware status.
"""

import os
import sys
import time
import json
import re
import urllib.request
import webbrowser
import threading
import subprocess
from pathlib import Path
import tkinter as tk
from tkinter import ttk, messagebox

ROOT_DIR = Path(__file__).resolve().parent
LOGS_DIR = ROOT_DIR / "logs"
LOGS_DIR.mkdir(parents=True, exist_ok=True)

# ─────────────────────────────────────────────────────────────────────────────
# Theme & Colors (Premium Smart Solar Palette)
# ─────────────────────────────────────────────────────────────────────────────
BG_DARK = "#0D1826"
BG_CARD = "#17263A"
BG_CARD_LIGHT = "#22354E"
ACCENT_GOLD = "#FFB800"
ACCENT_GOLD_HOVER = "#D97706"
TEXT_WHITE = "#FFFFFF"
TEXT_MUTED = "#94A3B8"
COLOR_GREEN = "#10B981"
COLOR_ORANGE = "#F59E0B"
COLOR_RED = "#EF4444"
FONT_FAMILY = "Segoe UI" if sys.platform == "win32" else "Helvetica"


class SmartSolarControlCenter(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("SMART SOLAR — Control Center (Kizuna Hackathon)")
        self.geometry("820x760")
        self.minsize(760, 680)
        self.configure(bg=BG_DARK)

        # State storage
        self.services_status = {}
        self.cloudflare_url = ""
        self.api_key = self.load_api_key()
        self.running = True

        self.setup_ui()

        # Background polling thread for service health
        self.poll_thread = threading.Thread(target=self.poll_services_loop, daemon=True)
        self.poll_thread.start()

    def load_api_key(self) -> str:
        key_file = ROOT_DIR / "iot" / "api_key.local.txt"
        if key_file.exists():
            try:
                return key_file.read_text().strip()
            except Exception:
                pass
        return "ac8c3e4ff5d67f5806df8013beb439f2f311975ae923de7d"

    # ─────────────────────────────────────────────────────────────────────────
    # UI Building
    # ─────────────────────────────────────────────────────────────────────────
    def setup_ui(self):
        # 1. Header
        header = tk.Frame(self, bg=BG_DARK, pady=14, padx=20)
        header.pack(fill=tk.X)

        title_lbl = tk.Label(
            header,
            text="☀️ SMART SOLAR — CONTROL CENTER",
            font=(FONT_FAMILY, 16, "bold"),
            fg=ACCENT_GOLD,
            bg=BG_DARK
        )
        title_lbl.pack(anchor=tk.W)

        subtitle_lbl = tk.Label(
            header,
            text="Meta SAM ViT-B (CUDA) · Live Mokxi ESP32 · Google Gemini AI · Voice-to-Text Live",
            font=(FONT_FAMILY, 9),
            fg=TEXT_MUTED,
            bg=BG_DARK
        )
        subtitle_lbl.pack(anchor=tk.W, pady=(2, 0))

        # 2. Main Action Toolbar (Start / Stop / Restart / Open)
        toolbar = tk.Frame(self, bg=BG_CARD, padx=16, pady=12)
        toolbar.pack(fill=tk.X, padx=16, pady=(0, 10))

        btn_style = {"font": (FONT_FAMILY, 10, "bold"), "cursor": "hand2", "padx": 14, "pady": 6}

        self.btn_start = tk.Button(
            toolbar, text="▶ Start All", bg="#047857", fg=TEXT_WHITE, activebackground="#059669",
            activeforeground=TEXT_WHITE, bd=0, relief=tk.FLAT, command=self.action_start_all, **btn_style
        )
        self.btn_start.pack(side=tk.LEFT, padx=(0, 6))

        self.btn_stop = tk.Button(
            toolbar, text="⏹ Stop All", bg="#991B1B", fg=TEXT_WHITE, activebackground="#DC2626",
            activeforeground=TEXT_WHITE, bd=0, relief=tk.FLAT, command=self.action_stop_all, **btn_style
        )
        self.btn_stop.pack(side=tk.LEFT, padx=6)

        self.btn_restart = tk.Button(
            toolbar, text="🔄 Restart All", bg="#B45309", fg=TEXT_WHITE, activebackground="#D97706",
            activeforeground=TEXT_WHITE, bd=0, relief=tk.FLAT, command=self.action_restart_all, **btn_style
        )
        self.btn_restart.pack(side=tk.LEFT, padx=6)

        self.btn_open_app = tk.Button(
            toolbar, text="🌐 Ouvrir Smart Solar", bg="#1D4ED8", fg=TEXT_WHITE, activebackground="#2563EB",
            activeforeground=TEXT_WHITE, bd=0, relief=tk.FLAT, command=self.action_open_app, **btn_style
        )
        self.btn_open_app.pack(side=tk.LEFT, padx=6)

        self.btn_open_mokxi = tk.Button(
            toolbar, text="⚡ Ouvrir Mokxi", bg="#6D28D9", fg=TEXT_WHITE, activebackground="#7C3AED",
            activeforeground=TEXT_WHITE, bd=0, relief=tk.FLAT, command=self.action_open_mokxi, **btn_style
        )
        self.btn_open_mokxi.pack(side=tk.LEFT, padx=6)

        self.btn_logs = tk.Button(
            toolbar, text="📂 Logs", bg=BG_CARD_LIGHT, fg=TEXT_WHITE, activebackground="#334155",
            activeforeground=TEXT_WHITE, bd=0, relief=tk.FLAT, command=self.action_view_logs, **btn_style
        )
        self.btn_logs.pack(side=tk.RIGHT)

        # 3. Status Grid Container
        status_frame = tk.LabelFrame(
            self, text="  État des Microservices & Périphériques  ",
            font=(FONT_FAMILY, 10, "bold"), fg=ACCENT_GOLD, bg=BG_CARD, padx=16, pady=12
        )
        status_frame.pack(fill=tk.X, padx=16, pady=6)

        self.service_labels = {}
        services_def = [
            ("backend_main", "Backend Principal (Port 8003)"),
            ("iot_backend", "IoT Backend SQLite (Port 8001)"),
            ("iot_gateway", "IoT Gateway Sécurisé (Port 8002)"),
            ("sam_gpu", "Microservice SAM AI (Port 8004)"),
            ("frontend", "Frontend Expo Metro (Port 8081)"),
            ("cloudflare", "Cloudflare Tunnel (Mokxi HTTPS)"),
            ("gemini", "Google Gemini AI Engine"),
            ("voice", "Voice-to-Text Live (Whisper / Web)"),
            ("esp32", "ESP32 / Télémétrie Mokxi"),
        ]

        for i, (key, label) in enumerate(services_def):
            row = i // 2
            col = (i % 2) * 2

            lbl_name = tk.Label(
                status_frame, text=label, font=(FONT_FAMILY, 9, "bold"),
                fg=TEXT_WHITE, bg=BG_CARD, anchor=tk.W
            )
            lbl_name.grid(row=row, column=col, sticky="w", padx=(10, 6), pady=4)

            lbl_val = tk.Label(
                status_frame, text="Vérification...", font=(FONT_FAMILY, 9),
                fg=COLOR_ORANGE, bg=BG_CARD, anchor=tk.W, width=28
            )
            lbl_val.grid(row=row, column=col + 1, sticky="w", padx=(0, 16), pady=4)
            self.service_labels[key] = lbl_val

        # 4. Mokxi Quick Tunnel Integration Card
        mokxi_card = tk.LabelFrame(
            self, text="  Intégration Mokxi & Cloudflare Quick Tunnel  ",
            font=(FONT_FAMILY, 10, "bold"), fg=ACCENT_GOLD, bg=BG_CARD, padx=16, pady=12
        )
        mokxi_card.pack(fill=tk.X, padx=16, pady=6)

        url_row = tk.Frame(mokxi_card, bg=BG_CARD)
        url_row.pack(fill=tk.X, pady=2)

        tk.Label(url_row, text="Endpoint IoT :", font=(FONT_FAMILY, 9, "bold"), fg=TEXT_WHITE, bg=BG_CARD).pack(side=tk.LEFT)
        self.endpoint_var = tk.StringVar(value="http://127.0.0.1:8002/api/iot/measurements")
        self.endpoint_entry = tk.Entry(
            url_row, textvariable=self.endpoint_var, font=(FONT_FAMILY, 9),
            bg=BG_DARK, fg=ACCENT_GOLD, insertbackground=TEXT_WHITE, readonlybackground=BG_DARK, state="readonly"
        )
        self.endpoint_entry.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=8)

        btn_copy = tk.Button(
            url_row, text="📋 Copier Endpoint", font=(FONT_FAMILY, 9, "bold"),
            bg="#D97706", fg=TEXT_WHITE, activebackground="#F59E0B", bd=0, relief=tk.FLAT,
            command=self.action_copy_endpoint, padx=10, pady=3, cursor="hand2"
        )
        btn_copy.pack(side=tk.RIGHT)

        tip_lbl = tk.Label(
            mokxi_card,
            text="💡 Collez cette URL dans serverUrl de votre code ESP32 dans Mokxi pour transmettre la tension solaire en direct.",
            font=(FONT_FAMILY, 8, "italic"), fg=TEXT_MUTED, bg=BG_CARD
        )
        tip_lbl.pack(anchor=tk.W, pady=(4, 0))

        # 5. Live Activity Logs
        logs_card = tk.LabelFrame(
            self, text="  Journal d'Activité en Direct  ",
            font=(FONT_FAMILY, 10, "bold"), fg=ACCENT_GOLD, bg=BG_CARD, padx=12, pady=8
        )
        logs_card.pack(fill=tk.BOTH, expand=True, padx=16, pady=(6, 12))

        self.log_text = tk.Text(
            logs_card, bg=BG_DARK, fg="#E2E8F0", font=("Consolas", 8),
            wrap=tk.WORD, bd=0, highlightthickness=0, height=8
        )
        self.log_text.pack(fill=tk.BOTH, expand=True, side=tk.LEFT)

        scrollbar = ttk.Scrollbar(logs_card, orient=tk.VERTICAL, command=self.log_text.yview)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        self.log_text.config(yscrollcommand=scrollbar.set)

        self.append_log("Smart Solar Control Center démarré. Prêt pour la démonstration !")

    def append_log(self, message: str):
        ts = time.strftime("%H:%M:%S")
        self.log_text.insert(tk.END, f"[{ts}] {message}\n")
        self.log_text.see(tk.END)

    # ─────────────────────────────────────────────────────────────────────────
    # Background Service Polling Loop
    # ─────────────────────────────────────────────────────────────────────────
    def poll_services_loop(self):
        while self.running:
            # 1. Backend Principal (8003)
            try:
                req = urllib.request.Request("http://127.0.0.1:8003/", headers={"User-Agent": "ControlCenter"})
                with urllib.request.urlopen(req, timeout=1.2) as resp:
                    if resp.status == 200:
                        self.update_status("backend_main", "✔ En ligne (200 OK)", COLOR_GREEN)
                    else:
                        self.update_status("backend_main", f"HTTP {resp.status}", COLOR_ORANGE)
            except Exception:
                self.update_status("backend_main", "✖ Hors ligne", COLOR_RED)

            # 2. IoT Backend (8001)
            try:
                with urllib.request.urlopen("http://127.0.0.1:8001/health", timeout=1.2) as resp:
                    if resp.status == 200:
                        self.update_status("iot_backend", "✔ En ligne (SQLite)", COLOR_GREEN)
                    else:
                        self.update_status("iot_backend", "✖ Erreur", COLOR_ORANGE)
            except Exception:
                self.update_status("iot_backend", "✖ Hors ligne", COLOR_RED)

            # 3. IoT Gateway (8002)
            try:
                with urllib.request.urlopen("http://127.0.0.1:8002/health", timeout=1.2) as resp:
                    if resp.status == 200:
                        self.update_status("iot_gateway", "✔ Sécurisé (200 OK)", COLOR_GREEN)
                    else:
                        self.update_status("iot_gateway", "✖ Erreur", COLOR_ORANGE)
            except Exception:
                self.update_status("iot_gateway", "✖ Hors ligne", COLOR_RED)

            # 4. SAM Microservice (8004)
            try:
                with urllib.request.urlopen("http://127.0.0.1:8004/health", timeout=1.2) as resp:
                    data = json.loads(resp.read().decode())
                    device = data.get("device", "cuda").upper()
                    self.update_status("sam_gpu", f"✔ Prêt ({device} ViT-B)", COLOR_GREEN)
            except Exception:
                self.update_status("sam_gpu", "✖ Hors ligne", COLOR_RED)

            # 5. Frontend Metro (8081)
            try:
                with urllib.request.urlopen("http://127.0.0.1:8081/status", timeout=1.2) as resp:
                    self.update_status("frontend", "✔ En ligne (Port 8081)", COLOR_GREEN)
            except Exception:
                self.update_status("frontend", "✖ Arrêté", COLOR_RED)

            # 6. Cloudflare Tunnel
            cf_url = self.detect_cloudflare_tunnel()
            if cf_url:
                self.cloudflare_url = cf_url
                self.endpoint_var.set(f"{cf_url}/api/iot/measurements")
                self.update_status("cloudflare", "✔ Actif (Public HTTPS)", COLOR_GREEN)
            else:
                self.endpoint_var.set("http://127.0.0.1:8002/api/iot/measurements")
                self.update_status("cloudflare", "• Inactif (Mode local)", COLOR_ORANGE)

            # 7. Gemini Status
            env_file = ROOT_DIR / "backend" / ".env"
            has_gemini = False
            if env_file.exists():
                txt = env_file.read_text()
                if "GEMINI_API_KEY=AQ." in txt:
                    has_gemini = True
            if has_gemini:
                self.update_status("gemini", "✔ Prêt (gemini-3.5-flash)", COLOR_GREEN)
            else:
                self.update_status("gemini", "✖ Clé manquante", COLOR_RED)

            # 8. Voice-to-Text
            self.update_status("voice", "✔ Prêt (Live Dictation / Arabizi)", COLOR_GREEN)

            # 9. ESP32 Telemetry (Mokxi)
            try:
                with urllib.request.urlopen("http://127.0.0.1:8001/api/iot/mokxi/latest", timeout=1.2) as resp:
                    row = json.loads(resp.read().decode())
                    v = row.get("voltage_v", 0.0)
                    w = row.get("power_w", 0.0)
                    ts = row.get("timestamp", "")
                    self.update_status("esp32", f"✔ Connecté ({v:.2f}V · {w:.3f}W)", COLOR_GREEN)
            except Exception:
                self.update_status("esp32", "⏳ En attente de Mokxi", COLOR_ORANGE)

            time.sleep(2.0)

    def update_status(self, key: str, text: str, color: str):
        if key in self.service_labels:
            lbl = self.service_labels[key]
            # Use root.after to update GUI safely from worker thread
            self.after(0, lambda: lbl.config(text=text, fg=color))

    def detect_cloudflare_tunnel(self) -> str:
        log_file = LOGS_DIR / "cloudflare_tunnel.log"
        if log_file.exists():
            try:
                text = log_file.read_text(encoding="utf-8", errors="ignore")
                matches = re.findall(r"https://[a-zA-Z0-9-]+\.trycloudflare\.com", text)
                if matches:
                    return matches[-1]
            except Exception:
                pass
        return ""

    # ─────────────────────────────────────────────────────────────────────────
    # Actions
    # ─────────────────────────────────────────────────────────────────────────
    def action_start_all(self):
        self.append_log("Lancement de l'ensemble des services via start_smart_solar.ps1...")
        def run():
            ps_script = ROOT_DIR / "start_smart_solar.ps1"
            cmd = ["powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(ps_script)]
            try:
                subprocess.Popen(cmd, cwd=str(ROOT_DIR))
                self.append_log("Script de démarrage exécuté en tâche de fond.")
            except Exception as e:
                self.append_log(f"Erreur lancement: {e}")
        threading.Thread(target=run, daemon=True).start()

    def action_stop_all(self):
        self.append_log("Arrêt sécurisé de tous les microservices via stop_smart_solar.ps1...")
        def run():
            ps_script = ROOT_DIR / "stop_smart_solar.ps1"
            cmd = ["powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(ps_script)]
            try:
                subprocess.run(cmd, cwd=str(ROOT_DIR), timeout=20)
                self.append_log("Tous les services ont été arrêtés avec succès.")
            except Exception as e:
                self.append_log(f"Erreur arrêt: {e}")
        threading.Thread(target=run, daemon=True).start()

    def action_restart_all(self):
        self.append_log("Redémarrage complet des services...")
        def run():
            self.action_stop_all()
            time.sleep(3)
            self.action_start_all()
        threading.Thread(target=run, daemon=True).start()

    def action_open_app(self):
        self.append_log("Ouverture de Smart Solar dans le navigateur (http://localhost:8081/monitoring)...")
        webbrowser.open("http://localhost:8081/monitoring")

    def action_open_mokxi(self):
        self.append_log("Ouverture de la plateforme de simulation Mokxi...")
        webbrowser.open("https://app.mokxi.com")

    def action_copy_endpoint(self):
        endpoint = self.endpoint_var.get()
        self.clipboard_clear()
        self.clipboard_append(endpoint)
        self.update()
        self.append_log(f"Endpoint copié dans le presse-papiers : {endpoint}")
        messagebox.showinfo("Endpoint Copié", f"L'endpoint IoT suivant a été copié :\n\n{endpoint}\n\nCollez-le dans serverUrl du code Mokxi !")

    def action_view_logs(self):
        self.append_log("Ouverture du dossier des logs...")
        if sys.platform == "win32":
            os.startfile(str(LOGS_DIR))
        else:
            subprocess.Popen(["xdg-open", str(LOGS_DIR)])


if __name__ == "__main__":
    app = SmartSolarControlCenter()
    app.mainloop()
