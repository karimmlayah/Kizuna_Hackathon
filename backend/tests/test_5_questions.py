import urllib.request
import json
import time

questions = [
    "Kadeh nesta3mel énergie hedha chhar ?",
    "Est-ce que bech net3adda limite mte3i ?",
    "Kadeh produit panneau solaire taw ?",
    "Wa9tech a7sen wa9t bech nesta3mel machine a laver ?",
    "Chnowa na3mel bech nna9es consommation ?"
]

for i, q in enumerate(questions, 1):
    url = "http://127.0.0.1:8003/api/chat"
    payload = json.dumps({"messages": [{"role": "user", "content": q}]}).encode("utf-8")
    req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            reply = data.get("reply", "")
            first_line = [l.strip() for l in reply.split("\n") if l.strip() and not l.startswith("<!--")][:2]
            print(f"[{round(time.time() - t0, 1)}s] Q{i}: {q}")
            print("   ->", " ".join(first_line)[:150])
            print()
    except Exception as e:
        print(f"Q{i} Failed:", e)
