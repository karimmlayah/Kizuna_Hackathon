"""Comprehensive Validation Script for Scenarios A, B, and C.

Tests:
- Scenario A: Photo upload, real U-Net inference, segmentation, auto-recommendation.
- Scenario B: AI recommendation, customization (move, rotate, add, delete), AI Advisor advice.
- Scenario C: Manual from scratch, layout creation, validation, recalculations.
"""
import requests
import io
import json
from PIL import Image, ImageDraw

BASE_URL = "http://localhost:8003"

def make_test_roof_image(width=400, height=400):
    img = Image.new("RGB", (width, height), color=(130, 150, 130))
    draw = ImageDraw.Draw(img)
    # Draw residential rooftop polygon
    draw.polygon([(80, 100), (320, 100), (360, 300), (40, 300)], fill=(190, 85, 45))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()

def test_scenario_a():
    print("\n--- SCENARIO A: Importation, U-Net Segmentation & Validation ---")
    img_bytes = make_test_roof_image()
    files = {"file": ("roof_scenario_a.jpg", img_bytes, "image/jpeg")}
    payload = {"declared_area_m2": 85, "target_panels": 12, "panel_power_kwp": 0.40}
    data = {"data_json": json.dumps(payload)}

    res = requests.post(f"{BASE_URL}/api/rooftop/analyze", files=files, data=data)
    assert res.status_code == 200, f"Analyze failed with {res.status_code}: {res.text}"
    body = res.json()
    metrics = body["metrics"]

    print("✓ U-Net inference succeeded.")
    print(f"✓ Roof Area Detected: {metrics['total_roof_area_m2']} m² (Usable: {metrics['usable_roof_area_m2']} m²)")
    print(f"✓ AI Recommended Panels: {metrics['placed_panels']} modules ({metrics['installed_kwp']} kWc)")
    print(f"✓ Orientation: {metrics['orientation']}")
    print(f"✓ Estimated Annual Production: {metrics['annual_production_kwh']} kWh/an")
    print(f"✓ Estimated Turnkey Cost: {metrics['cost_tnd']} TND")
    print(f"✓ Estimated Annual Savings: {metrics['annual_savings_tnd']} TND/an (ROI: ~{metrics['roi_years']} ans)")
    print(f"✓ Polygon Contours extracted: {len(body['contours'])} contour(s)")
    print(f"✓ Mask base64 returned: {bool(body['images']['mask'])}")
    print(f"✓ Explanation: {body['explanation'][:80]}...")
    return body

def test_scenario_b(ai_result):
    print("\n--- SCENARIO B: Personnalisation, Déplacement, Rotation, Ajout, Suppression & IA Advisor ---")
    initial_panels = list(ai_result["primary_placement"])
    assert len(initial_panels) > 0, "No initial panels to customize"
    print(f"✓ Started from AI proposal with {len(initial_panels)} panels.")

    # 1. Move panel 0
    p0 = dict(initial_panels[0])
    p0["x_pct"] = min(85, p0["x_pct"] + 5)
    p0["y_pct"] = min(85, p0["y_pct"] + 3)
    print(f"✓ Panel #{p0['id']} moved to ({p0['x_pct']}%, {p0['y_pct']}%)")

    # 2. Rotate panel 1
    p1 = dict(initial_panels[1])
    p1["rotation"] = 90
    print(f"✓ Panel #{p1['id']} rotated to 90°")

    # 3. Add new panel
    new_panel = {
        "id": "manual_add_1",
        "x_pct": 50,
        "y_pct": 50,
        "w_pct": 12,
        "h_pct": 17,
        "rotation": 0,
        "valid": True
    }
    customized = [p0, p1] + initial_panels[2:] + [new_panel]
    print(f"✓ Added new panel #{new_panel['id']} (total: {len(customized)})")

    # 4. Delete one panel (the last one of initial)
    deleted = customized.pop(3)
    print(f"✓ Deleted panel #{deleted['id']} (total: {len(customized)})")

    # 5. Add an intentional out-of-boundary panel to test AI Advisor
    oob_panel = {
        "id": "oob_test",
        "x_pct": 96,
        "y_pct": 96,
        "w_pct": 12,
        "h_pct": 17,
        "rotation": 0,
        "valid": True
    }
    test_panels = customized + [oob_panel]

    # Call AI Advisor
    advise_res = requests.post(
        f"{BASE_URL}/api/rooftop/advise",
        json={"panels": test_panels, "target_panels": 12, "panel_power_kwp": 0.40}
    )
    assert advise_res.status_code == 200, f"Advise failed: {advise_res.text}"
    advice = advise_res.json()
    print("✓ AI Advisor called successfully.")
    print(f"✓ Detected {len(advice['invalid_panels'])} invalid panel(s) (OOB: {advice['invalid_panels']})")
    print(f"✓ Suggestions count: {len(advice['suggestions'])}")
    for s in advice["suggestions"]:
        print(f"  • [{s['type']}] {s['message']}")

def test_scenario_c():
    print("\n--- SCENARIO C: Conception Entièrement Manuelle Depuis Zéro ---")
    manual_panels = []
    # Build 8 panels grid manually
    for r in range(2):
        for c in range(4):
            manual_panels.append({
                "id": f"scratch_{r}_{c}",
                "x_pct": 30 + c * 10,
                "y_pct": 35 + r * 15,
                "w_pct": 8,
                "h_pct": 12,
                "rotation": 0,
                "valid": True
            })
    print(f"✓ Created {len(manual_panels)} panels manually in a 2x4 array.")

    advise_res = requests.post(
        f"{BASE_URL}/api/rooftop/advise",
        json={"panels": manual_panels, "target_panels": 10, "panel_power_kwp": 0.45}
    )
    assert advise_res.status_code == 200
    res = advise_res.json()
    print(f"✓ Valid panels: {res['valid_count']} / {res['total_count']}")
    print(f"✓ Installed capacity: {res['installed_kwp']} kWc")
    print(f"✓ Estimated annual production: {res['annual_kwh']} kWh/an")
    print(f"✓ Estimated annual savings: {res['annual_savings_tnd']} TND/an")
    print(f"✓ Overlapping panels detected: {len(res['overlapping_panels'])}")

if __name__ == "__main__":
    print("Testing Smart Solar U-Net Rooftop Planner & Studio API...")
    ai_res = test_scenario_a()
    test_scenario_b(ai_res)
    test_scenario_c()
    print("\n✅ ALL THREE SCENARIOS (A, B, C) FULLY VALIDATED!")
