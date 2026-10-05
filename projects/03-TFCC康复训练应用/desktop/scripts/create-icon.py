from pathlib import Path

from PIL import Image, ImageDraw


def make_icon(size: int) -> Image.Image:
    scale = 4
    width = size * scale
    image = Image.new("RGBA", (width, width), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    inset = int(width * 0.055)
    draw.rounded_rectangle(
        (inset, inset, width - inset, width - inset),
        radius=int(width * 0.23),
        fill="#f6f0e8",
        outline="#205b65",
        width=max(1, int(width * 0.045)),
    )
    cx = width / 2
    cy = width / 2
    r = width * 0.285
    stroke = max(1, int(width * 0.095))
    draw.arc(
        (cx - r, cy - r, cx + r, cy + r),
        start=200,
        end=520,
        fill="#367a80",
        width=stroke,
    )
    draw.line(
        [(width * 0.25, width * 0.60), (width * 0.41, width * 0.47), (width * 0.53, width * 0.56), (width * 0.76, width * 0.35)],
        fill="#943d30",
        width=max(1, int(width * 0.07)),
        joint="curve",
    )
    return image.resize((size, size), Image.Resampling.LANCZOS)


out = Path(__file__).resolve().parents[1] / "assets" / "tfcc.ico"
out.parent.mkdir(parents=True, exist_ok=True)
images = [make_icon(size) for size in (16, 24, 32, 48, 64, 128, 256)]
images[-1].save(out, format="ICO", sizes=[(img.width, img.height) for img in images], append_images=images[:-1])
images[-1].save(out.with_suffix('.png'))
print(out)
