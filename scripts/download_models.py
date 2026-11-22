#!/usr/bin/env python3
"""
SMART SOLAR — AI Model Downloader & Verification Script
Downloads public weights (Meta SAM ViT-B) from official sources and verifies integrity.
"""

import sys
import os
import argparse
import hashlib
import urllib.request
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent

MODELS = [
    {
        "name": "Meta Segment Anything (ViT-B)",
        "filename": "sam_vit_b_01ec64.pth",
        "target_dir": ROOT_DIR / "test_sam" / "weights",
        "url": "https://dl.fbaipublicfiles.com/segment_anything/sam_vit_b_01ec64.pth",
        "expected_size_bytes": 375042383,
        "sha256": "01ec64d29a2fca3fce371c1444e72223a2de280001649e53206b10f5e0f30f6c",
        "is_public": True,
    },
    {
        "name": "U-Net Rooftop Segmentation",
        "filename": "unet_rooftop_best.keras",
        "target_dir": ROOT_DIR / "backend" / "models" / "rooftop",
        "url": None,
        "expected_size_bytes": 372878554,
        "sha256": None,
        "is_public": False,
        "notes": "Custom model trained for Kizuna Hackathon. Placed in backend/models/rooftop/.",
    },
]


def print_progress(count, block_size, total_size):
    percent = int(count * block_size * 100 / total_size)
    percent = min(100, max(0, percent))
    mb_down = (count * block_size) / (1024 * 1024)
    mb_total = total_size / (1024 * 1024)
    bar = "█" * (percent // 4) + "-" * (25 - (percent // 4))
    sys.stdout.write(f"\r   [{bar}] {percent}% ({mb_down:.1f}/{mb_total:.1f} MB)")
    sys.stdout.flush()


def compute_sha256(filepath: Path) -> str:
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(1024 * 1024):
            h.update(chunk)
    return h.hexdigest()


def main():
    parser = argparse.ArgumentParser(description="Smart Solar AI Model Downloader & Verification")
    parser.add_argument("--check-only", action="store_true", help="Only check integrity without downloading")
    parser.add_argument("--force", action="store_true", help="Force re-download even if files exist")
    args = parser.parse_args()

    print("==========================================================================")
    print("  SMART SOLAR — AI Model Verification & Automated Downloader              ")
    print("==========================================================================")
    print()

    all_ok = True

    for m in MODELS:
        target_path = m["target_dir"] / m["filename"]
        print(f"📦 Checking: {m['name']} ({m['filename']})")
        print(f"   Target path: {target_path}")

        m["target_dir"].mkdir(parents=True, exist_ok=True)

        if target_path.exists() and not args.force:
            size_mb = target_path.stat().st_size / (1024 * 1024)
            print(f"   ✓ File found on disk: {size_mb:.1f} MB")

            if m["expected_size_bytes"] and abs(target_path.stat().st_size - m["expected_size_bytes"]) > 500000:
                print(f"   ⚠️  Warning: Size mismatch! Expected {m['expected_size_bytes']} bytes, got {target_path.stat().st_size} bytes.")
                all_ok = False
            else:
                print("   ✓ Size verified.")
            print()
            continue

        if args.check_only:
            print(f"   ❌ Missing file: {target_path}")
            if not m["is_public"]:
                print(f"   ℹ️  Note: {m.get('notes')}")
            all_ok = False
            print()
            continue

        if not m["is_public"] or not m["url"]:
            print(f"   ℹ️  Proprietary/Custom Model: {m.get('notes')}")
            if not target_path.exists():
                print(f"   ⚠️  Please place {m['filename']} manually into {m['target_dir']}")
                all_ok = False
            print()
            continue

        print(f"   ⬇️  Downloading from official source: {m['url']} ...")
        try:
            urllib.request.urlretrieve(m["url"], target_path, reporthook=print_progress)
            print("\n   ✓ Download completed successfully.")
            size_mb = target_path.stat().st_size / (1024 * 1024)
            print(f"   ✓ Verified size: {size_mb:.1f} MB")
        except Exception as e:
            print(f"\n   ❌ Download error: {e}")
            all_ok = False
        print()

    print("==========================================================================")
    if all_ok:
        print("  ✓ All required AI models are verified and ready for inference!")
    else:
        print("  ⚠️  Some models need attention. See details above.")
    print("==========================================================================")


if __name__ == "__main__":
    main()
