# AI Models & Weight Management — Smart Solar

This document provides complete technical specifications, licensing, official sources, and installation procedures for all Machine Learning and Deep Learning models used in **Smart Solar**.

> [!IMPORTANT]
> In accordance with Git and GitHub best practices, heavy binary weights (`*.pth`, `*.keras`, `*.onnx` > 100 MB) are **never committed to this repository**. Use the provided automated downloader script or manual links below.

---

## 1. AI Models Overview

| Model Name | Role & Function | Architecture | Checkpoint / Format | Size | License | Source / Provider |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Meta Segment Anything (SAM)** | Zero-shot rooftop facet segmentation & obstacle masking | Vision Transformer (ViT-B) | `sam_vit_b_01ec64.pth` | **~375 MB** | Apache 2.0 | [Meta AI Research](https://github.com/facebookresearch/segment-anything) |
| **U-Net Rooftop** | Semantic rooftop boundary segmentation | Convolutional U-Net | `unet_rooftop_best.keras` | **~355 MB** | Custom / Team | Kizuna Hackathon Dataset |
| **PaddleOCR (PP-OCRv4)** | STEG electricity bill text & value extraction | MobileNetV3 / SVTR | Detection + Recognition | **~15 MB** | Apache 2.0 | [PaddlePaddle / PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR) |
| **Google Gemini 3.5 Flash** | Multimodal conversational solar advisor & Arabizi reasoning | Multimodal LLM | API Cloud Endpoint | Cloud API | Google Terms | [Google AI Studio](https://aistudio.google.com/) |

---

## 2. Model Specifications & Setup

### A. Meta Segment Anything (SAM ViT-B)
- **File Name**: `sam_vit_b_01ec64.pth`
- **Target Location**: `test_sam/weights/sam_vit_b_01ec64.pth`
- **Official Direct Download**:
  ```
  https://dl.fbaipublicfiles.com/segment_anything/sam_vit_b_01ec64.pth
  ```
- **SHA-256 Checksum**: `01ec64d29a2fca3fce371c1444e72223a2de280001649e53206b10f5e0f30f6c`
- **Hardware Configuration**:
  - **GPU (Recommended)**: NVIDIA GPU with CUDA 11.8+ or 12.x and at least 4 GB VRAM.
  - **CPU Fallback**: Supported with PyTorch CPU (automatic device detection).
- **Verified Benchmark**:
  - Device: NVIDIA CUDA GPU
  - Segment generation: **26 candidate masks** generated in **4.94 seconds** on high-resolution roof imagery (`1024x768`).

### B. U-Net Rooftop Segmentation Model
- **File Name**: `unet_rooftop_best.keras`
- **Target Location**: `backend/models/rooftop/unet_rooftop_best.keras`
- **Architecture**: U-Net with skip-connections trained for binary roof contour identification.
- **Framework**: TensorFlow 2.15+ / Keras 3.x.
- **Hardware**: CPU or CUDA GPU.

### C. PaddleOCR (PP-OCRv4)
- **Target Location**: Automatically cached by PaddleOCR in `~/.paddleocr/` upon first inference run.
- **Usage**: Scans Tunisian STEG electricity invoices to extract:
  - Monthly energy consumption in kWh (`Consommation (kWh)`)
  - Total invoiced amount in TND (`Montant TTC`)
  - Meter reference and tariff category.

### D. Google Gemini 3.5 Flash
- **Target Endpoint**: `https://generativelanguage.googleapis.com/v1beta`
- **Model**: `gemini-3.5-flash` (with automated fallback to `gemini-3.1-flash-lite`).
- **Setup**: Requires a free Gemini API key configured in `backend/.env`.

---

## 3. Automated Downloader Script

Run the automated script to verify existing models or download the official Meta SAM ViT-B weights:

```bash
# From the project root
python scripts/download_models.py
```

Options:
```bash
# Force re-download even if files exist
python scripts/download_models.py --force

# Verify checksums only
python scripts/download_models.py --check-only
```
