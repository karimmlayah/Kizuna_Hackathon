# Testing & Quality Assurance — Smart Solar

Smart Solar undergoes rigorous automated testing spanning TypeScript static verification, deterministic unit tests, Computer Vision latency benchmarks, and Live LLM conversational assertions.

---

## 1. Automated Test Suites Summary

| Test Suite | Framework | Scope | Results |
| :--- | :--- | :--- | :---: |
| **Frontend Unit Tests** | Node.js Test Runner | Sizing math, financial limits, Arabizi phonetics, IoT prediction engine | **11 / 11 Passed (100%)** |
| **Frontend Static Typing** | TypeScript (`tsc --noEmit`) | Strict type checking across Expo Router, React Native & Three.js | **0 Errors** |
| **SAM ViT-B Segmentation** | PyTorch / CUDA Benchmark | Rooftop mask count, execution latency, GPU memory | **26 masks in 4.94s** |
| **Solar AI Backend Tests** | Python HTTPX / Requests | Gemini Arabizi multi-turn reasoning, status, SSE stream | **5 / 5 Passed** |
| **IoT Gateway Auth Tests** | Python Test Client | API key validation, payload schema, forward to core | **Passed** |

---

## 2. Running Frontend Tests

### Typecheck
```bash
cd frontend
npm run typecheck
```
*Expected Output*: Process completes with exit code 0 and no reported typing issues.

### Unit Tests
```bash
cd frontend
npm test
```
*Output Log*:
```
✔ parseSolarCard correctly extracts sizing_proposal and cleans markdown (2.19ms)
✔ parseSolarCard handles text without card gracefully (0.45ms)
✔ Deterministic Prediction Engine: Mandatory Reference Test Case (1200 / 900 / 15 / 30) (2.94ms)
✔ Deterministic Prediction Engine: On-Track Scenario (1200 / 400 / 15 / 30) (0.37ms)
✔ sizing respects available area and produces no panels at zero area (1.70ms)
✔ financial savings cannot exceed the annual bill (0.61ms)
✔ zero installation has no invented payback or carbon benefit (0.36ms)
✔ projection includes annual degradation and maintenance (0.32ms)
✔ Arabizi to Phonetic Arabic converter replaces digits and keywords correctly (1.83ms)
✔ Clean text for speech strips Markdown, URLs and expands units (1.53ms)
✔ Solar Score correctly assigns excellent, moderate, and low categories (0.76ms)

ℹ tests 11 | pass 11 | fail 0 | duration_ms 204ms
```

---

## 3. Running Backend Scenario Tests

Ensure background services are running on ports 8003 and 8004:

```bash
# Execute the 5-question multi-turn Arabizi verification
backend\.venv\Scripts\python.exe backend\tests\test_5_questions.py
```

*Verified Assertions*:
1. Current consumption query (`Kadeh nesta3mel énergie hedha chhar ?`) correctly references 900 kWh used out of 1200 kWh.
2. Target overrun warning (`Est-ce que bech net3adda limite mte3i ?`) confirms imminent overrun and alerts the user.
3. Instantaneous power inquiry (`Kadeh produit panneau solaire taw ?`) pulls telemetry (~0.95 W).
4. Scheduling recommendations (`Wa9tech a7sen wa9t bech nesta3mel machine a laver ?`) correlates with peak sunshine hours in Tunis.
5. Efficiency guidance (`Chnowa na3mel bech nna9es consommation ?`) details non-solar energy conservation strategies.

---

## 4. Meta SAM ViT-B Hardware Benchmark

- **Test Image**: `test_sam/test_images/roof.jpg` (Resolution: 1024 × 768)
- **Device**: NVIDIA CUDA Accelerated
- **Model Checkpoint**: `sam_vit_b_01ec64.pth` (375 MB)
- **Masks Generated**: 26 facets
- **Inference Latency**: **4.94 seconds**
- **Safety Margin Calculation**: Setback buffer 0.5m with automated obstacle exclusion.
