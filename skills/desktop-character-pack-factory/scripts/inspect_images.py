#!/usr/bin/env python3
"""Inventory dimensions, alpha, and green-background properties of images."""

import argparse
import json
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("Pillow is required: python -m pip install Pillow", file=sys.stderr)
    raise SystemExit(3)


def inspect(path):
    with Image.open(path) as image:
        image.load()
        bands = image.getbands()
        has_alpha = "A" in bands or "transparency" in image.info
        alpha_extrema = None
        alpha_bbox = None
        transparent_ratio = None
        if "A" in bands:
            alpha = image.getchannel("A")
            alpha_extrema = list(alpha.getextrema())
            bbox = alpha.getbbox()
            alpha_bbox = list(bbox) if bbox else None
            histogram = alpha.histogram()
            transparent_ratio = round(histogram[0] / (image.width * image.height), 4)

        rgb = image.convert("RGB")
        sample = rgb.resize((64, 64))
        pixels = list(
            sample.get_flattened_data()
            if hasattr(sample, "get_flattened_data")
            else sample.getdata()
        )
        green_matches = sum(
            1 for red, green, blue in pixels
            if red <= 10 and green >= 245 and blue <= 10
        )
        green_ratio = green_matches / len(pixels)

        return {
            "path": str(path),
            "format": image.format,
            "mode": image.mode,
            "width": image.width,
            "height": image.height,
            "square": image.width == image.height,
            "has_alpha": has_alpha,
            "alpha_extrema": alpha_extrema,
            "alpha_bbox": alpha_bbox,
            "transparent_ratio": transparent_ratio,
            "pure_green_sample_ratio": round(green_ratio, 4),
            "bytes": path.stat().st_size,
        }


def main():
    parser = argparse.ArgumentParser(description="Inspect role reference images.")
    parser.add_argument("images", nargs="+")
    parser.add_argument("--json-output")
    args = parser.parse_args()

    results = []
    failed = []
    for item in args.images:
        path = Path(item).expanduser().resolve()
        try:
            results.append(inspect(path))
        except Exception as exc:
            failed.append({"path": str(path), "error": str(exc)})

    payload = {"images": results, "failed": failed}
    output = json.dumps(payload, ensure_ascii=False, indent=2)
    if args.json_output:
        Path(args.json_output).write_text(output, encoding="utf-8")
    print(output)
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
