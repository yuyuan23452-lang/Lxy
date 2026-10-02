#!/usr/bin/env python3
"""Create a first-stage character factory project without modifying originals."""

import argparse
import json
import re
import shutil
import sys
from datetime import datetime
from pathlib import Path


FOLDERS = ("原始图片", "标准角色图", "绿幕参考图", "动画规划")


def safe_name(value):
    cleaned = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", value.strip())
    cleaned = cleaned.rstrip(". ")
    return cleaned or "未命名角色"


def unique_destination(folder, filename):
    stem = filename.stem
    suffix = filename.suffix.lower()
    candidate = folder / (stem + suffix)
    index = 2
    while candidate.exists():
        candidate = folder / f"{stem}-{index}{suffix}"
        index += 1
    return candidate


def main():
    parser = argparse.ArgumentParser(description="Prepare a desktop-character image project.")
    parser.add_argument("--name", required=True, help="Role name")
    parser.add_argument("--category", required=True, choices=("宠物", "人物", "其他"))
    parser.add_argument("--personality", required=True, help="Role personality")
    parser.add_argument("--style", default="保持输入素材风格", help="Desired visual style")
    parser.add_argument("--output", required=True, help="Parent output directory")
    parser.add_argument("--images", required=True, nargs="+", help="Source image paths")
    args = parser.parse_args()

    sources = [Path(item).expanduser().resolve() for item in args.images]
    missing = [str(item) for item in sources if not item.is_file()]
    if missing:
        print("Missing source images:\n" + "\n".join(missing), file=sys.stderr)
        return 2

    project = Path(args.output).expanduser().resolve() / safe_name(args.name)
    project.mkdir(parents=True, exist_ok=True)
    for folder_name in FOLDERS:
        (project / folder_name).mkdir(exist_ok=True)

    copied = []
    originals = project / "原始图片"
    for source in sources:
        destination = unique_destination(originals, source)
        shutil.copy2(str(source), str(destination))
        copied.append(
            {
                "source": str(source),
                "project_copy": str(destination),
                "bytes": destination.stat().st_size,
            }
        )

    info = {
        "schema_version": 1,
        "created_at": datetime.now().astimezone().isoformat(timespec="seconds"),
        "role": {
            "name": args.name.strip(),
            "category": args.category,
            "personality": args.personality.strip(),
            "style": args.style.strip(),
        },
        "defaults": {
            "canvas": [1024, 1024],
            "anchor": "bottom-center",
            "green": "#00FF00",
        },
        "sources": copied,
        "stage": "images-and-kling-plan",
    }
    info_path = project / "角色资料.json"
    info_path.write_text(json.dumps(info, ensure_ascii=False, indent=2), encoding="utf-8")

    print(json.dumps({"project": str(project), "role_info": str(info_path)}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
