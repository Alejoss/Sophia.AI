#!/usr/bin/env python3
"""
Optimize default audio/video content thumbnails for frontend list/card views.

Source files (heavy PNG/JPG) live in screenshot/ at the repo root:
  - audio_thumbnail_default.*
  - video_thumbnail_default.*

Outputs lightweight WebP files to frontend/public/images/ using the same
dimensions and quality as content/image_utils.py listing previews.
"""

from __future__ import annotations

import io
import sys
from pathlib import Path

from PIL import Image

REPO_ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = REPO_ROOT / "screenshot"
OUTPUT_DIR = REPO_ROOT / "frontend" / "public" / "images"

# Keep in sync with acbc_app/content/image_utils.py
LISTING_THUMB_MAX_WIDTH = 480
LISTING_THUMB_MAX_HEIGHT = 320
LISTING_THUMB_QUALITY = 80

ASSETS = (
    ("audio_thumbnail_default", "audio_thumbnail_default.webp"),
    ("video_thumbnail_default", "video_thumbnail_default.webp"),
)

SOURCE_EXTENSIONS = (".png", ".jpg", ".jpeg", ".webp", ".PNG", ".JPG", ".JPEG", ".WEBP")


def find_source(stem: str) -> Path | None:
    for ext in SOURCE_EXTENSIONS:
        candidate = SOURCE_DIR / f"{stem}{ext}"
        if candidate.is_file():
            return candidate
    return None


def bytes_to_listing_webp(data: bytes) -> bytes:
    img = Image.open(io.BytesIO(data))
    if img.mode not in ("RGB", "RGBA"):
        img = img.convert("RGBA" if "A" in img.getbands() else "RGB")
    img.thumbnail(
        (LISTING_THUMB_MAX_WIDTH, LISTING_THUMB_MAX_HEIGHT),
        Image.Resampling.LANCZOS,
    )
    buffer = io.BytesIO()
    img.save(buffer, format="WEBP", quality=LISTING_THUMB_QUALITY, method=6)
    buffer.seek(0)
    return buffer.read()


def optimize_file(source: Path, destination: Path) -> tuple[int, int]:
    source_bytes = source.read_bytes()
    output_bytes = bytes_to_listing_webp(source_bytes)
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(output_bytes)
    return len(source_bytes), len(output_bytes)


def main() -> int:
    if not SOURCE_DIR.is_dir():
        print(f"Source directory not found: {SOURCE_DIR}", file=sys.stderr)
        return 1

    processed = 0
    missing = []

    for stem, output_name in ASSETS:
        source = find_source(stem)
        if source is None:
            missing.append(stem)
            continue

        destination = OUTPUT_DIR / output_name
        before, after = optimize_file(source, destination)
        reduction = 100 - (after * 100 // before) if before else 0
        print(
            f"{source.name} -> {output_name}: "
            f"{before:,} B -> {after:,} B ({reduction}% smaller)"
        )
        processed += 1

    if missing:
        print(
            "\nMissing source files in screenshot/ (expected one of "
            + ", ".join(f"{stem}{ext}" for stem in missing for ext in SOURCE_EXTENSIONS[:4])
            + "): "
            + ", ".join(missing),
            file=sys.stderr,
        )

    if processed == 0:
        return 1

    print(f"\nDone. Generated {processed} optimized thumbnail(s) in {OUTPUT_DIR}.")
    return 0 if not missing else 1


if __name__ == "__main__":
    raise SystemExit(main())
