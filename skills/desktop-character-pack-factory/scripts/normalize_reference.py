#!/usr/bin/env python3
"""Normalize a square RGBA role reference without changing its composition."""

import argparse
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("Pillow is required: python -m pip install Pillow", file=sys.stderr)
    raise SystemExit(3)


def main():
    parser = argparse.ArgumentParser(description="Normalize a square RGBA role reference.")
    parser.add_argument("input_png")
    parser.add_argument("output_png")
    parser.add_argument("--size", type=int, default=1024)
    args = parser.parse_args()

    source_path = Path(args.input_png).expanduser().resolve()
    output_path = Path(args.output_png).expanduser().resolve()
    if args.size < 256:
        print("--size must be at least 256", file=sys.stderr)
        return 2

    with Image.open(source_path) as source:
        rgba = source.convert("RGBA")
        if rgba.width != rgba.height:
            print("Input must use a square canvas.", file=sys.stderr)
            return 4
        normalized = rgba.resize((args.size, args.size), Image.Resampling.LANCZOS)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    normalized.save(output_path, format="PNG", optimize=True)
    print(str(output_path))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
