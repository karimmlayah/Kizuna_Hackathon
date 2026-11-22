import requests
import io
import json
from PIL import Image, ImageDraw

def main():
    img = Image.new("RGB", (400, 400), color=(140, 160, 140))
    draw = ImageDraw.Draw(img)
    draw.polygon([(100, 120), (300, 120), (350, 280), (50, 280)], fill=(180, 80, 50))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")

    files = {"file": ("roof.jpg", buf.getvalue(), "image/jpeg")}
    data = {"data_json": json.dumps({"declared_area_m2": 85, "target_panels": 12})}

    res = requests.post("http://localhost:8003/api/rooftop/analyze", files=files, data=data)
    print("Status code:", res.status_code)
    if res.status_code == 200:
        d = res.json()
        print("Success!")
        print("Metrics:", json.dumps(d.get("metrics"), indent=2))
        print("Contours count:", len(d.get("contours", [])))
        print("Primary panels placed:", len(d.get("primary_placement", [])))
        print("Explanation:", d.get("explanation"))
    else:
        print("Error response:", res.text)

if __name__ == "__main__":
    main()
