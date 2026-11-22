import requests
import json

def test_advise():
    panels = [
        {"id": "p1", "x_pct": 30, "y_pct": 30, "w_pct": 10, "h_pct": 15},
        {"id": "p2", "x_pct": 32, "y_pct": 32, "w_pct": 10, "h_pct": 15}, # overlap with p1
        {"id": "p3", "x_pct": 95, "y_pct": 95, "w_pct": 10, "h_pct": 15}, # out of boundary
    ]
    payload = {
        "panels": panels,
        "target_panels": 10,
        "panel_power_kwp": 0.40
    }
    res = requests.post("http://localhost:8003/api/rooftop/advise", json=payload)
    print("Status:", res.status_code)
    print("Advise result:", json.dumps(res.json(), indent=2))

if __name__ == "__main__":
    test_advise()
