"""Compose one 1280x800 store screenshot from page + popup captures."""
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

page_path, popup_path, out_path, center_flag = sys.argv[1:5]
center = center_flag == "1"
W, H = 1280, 800

page = Image.open(page_path).convert("RGBA").resize((W, H), Image.Resampling.LANCZOS)
popup = Image.open(popup_path).convert("RGBA")

max_h = 700 if center else 760
scale = min(1.45 if center else 1.0, max_h / popup.height, (W - 48) / popup.width)
pw = max(1, int(popup.width * scale))
ph = max(1, int(popup.height * scale))
popup = popup.resize((pw, ph), Image.Resampling.LANCZOS)

canvas = Image.new("RGBA", (W, H))
canvas.paste(page, (0, 0))

if center:
    x = (W - pw) // 2
    y = (H - ph) // 2
else:
    x = W - pw - 24
    y = 20
    if y + ph > H - 12:
        y = max(12, H - ph - 12)

shadow = Image.new("RGBA", (pw + 48, ph + 48), (0, 0, 0, 0))
d = ImageDraw.Draw(shadow)
d.rounded_rectangle([16, 16, pw + 32, ph + 32], radius=20, fill=(0, 0, 0, 100))
shadow = shadow.filter(ImageFilter.GaussianBlur(14))
canvas.alpha_composite(shadow, (max(0, x - 16), max(0, y - 10)))

mask = Image.new("L", (pw, ph), 0)
ImageDraw.Draw(mask).rounded_rectangle([0, 0, pw - 1, ph - 1], radius=14, fill=255)
canvas.paste(popup, (x, y), mask)
canvas.convert("RGB").save(out_path, "PNG")
print(f"wrote {Path(out_path).name} {W}x{H} popup={pw}x{ph} scale={scale:.2f}")
