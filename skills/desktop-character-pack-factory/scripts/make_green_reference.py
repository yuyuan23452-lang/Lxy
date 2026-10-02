#!/usr/bin/env python3
"""Composite an approved RGBA PNG onto exact #00FF00 without resizing."""

import argparse
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("Pillow is required: python -m pip install Pillow", file=sys.stderr)
    raise SystemExit(3)


def main():
    parser = argparse.ArgumentParser(description="Create an aligned pure-green reference PNG.")
    parser.add_argument("input_png")
    parser.add_argument("output_png")
    parser.add_argument("--green", default="00FF00")
    args = parser.parse_args()

    source_path = Path(args.input_png).expanduser().resolve()
    output_path = Path(args.output_png).expanduser().resolve()

    green = args.green.lstrip("#")
    if not re_full_hex(green):
        print("--green must be a six-digit RGB hex color", file=sys.stderr)
        return 2

    with Image.open(source_path) as source:
        rgba = source.convert("RGBA")
        alpha = rgba.getchannel("A")
        if alpha.getextrema() == (255, 255):
            print("Input PNG has no transparent pixels; verify the cutout first.", file=sys.stderr)
            return 4

        color = tuple(int(green[index:index + 2], 16) for index in (0, 2, 4))
        background = Image.new("RGBA", rgba.size, color + (255,))
        result = Image.alpha_composite(background, rgba).convert("RGB")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    result.save(output_path, format="PNG", optimize=True)
    print(str(output_path))
    return 0


def re_full_hex(value):
    if len(value) != 6:
        return False
    return all(character in "0123456789abcdefABCDEF" for character in value)


if __name__ == "__main__":
    raise SystemExit(main())
