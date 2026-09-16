"""Recompose store screenshots from real popup captures; fit tall popups into 1280x800."""
from PIL import Image, ImageDraw, ImageFilter
from pathlib import Path

STORE = Path(__file__).resolve().parent
CAP = STORE / "captures"
W, H = 1280, 800


def round_paste(canvas, popup, x, y, radius=14):
    pw, ph = popup.size
    shadow = Image.new("RGBA", (pw + 48, ph + 48), (0, 0, 0, 0))
    d = ImageDraw.Draw(shadow)
    d.rounded_rectangle([16, 16, pw + 32, ph + 32], radius=20, fill=(0, 0, 0, 100))
    shadow = shadow.filter(ImageFilter.GaussianBlur(14))
    canvas.alpha_composite(shadow, (max(0, x - 16), max(0, y - 10)))
    mask = Image.new("L", (pw, ph), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, pw - 1, ph - 1], radius=radius, fill=255)
    canvas.paste(popup, (x, y), mask)


def compose(page_path, popup_path, out_path, *, max_popup_h=760, right=24, top=20, center=False, crop_bottom=False):
    page = Image.open(page_path).convert("RGBA").resize((W, H), Image.Resampling.LANCZOS)
    popup = Image.open(popup_path).convert("RGBA")

    if crop_bottom:
        # Keep header + settings modal area (drop empty/overlapped bottom less)
        # Settings modal sits in lower half; keep from ~header through modal
        top_keep = 0
        # Prefer the lower portion where the settings sheet lives, but include brand header
        # Crop: keep full width, from y=0 to content; if very tall, focus on settings sheet
        h = popup.height
        # The settings sheet starts roughly after preview; keep from y≈0 still for brand,
        # but if height > 500, crop to show header (0-52) + bottom modal area
        if h > 520:
            header = popup.crop((0, 0, popup.width, 52))
            sheet = popup.crop((0, max(0, h - 420), popup.width, h))
            merged = Image.new("RGBA", (popup.width, header.height + sheet.height), (0, 0, 0, 0))
            merged.paste(header, (0, 0))
            merged.paste(sheet, (0, header.height))
            popup = merged

    scale = min(1.0, max_popup_h / popup.height, (W - 48) / popup.width)
    if center:
        scale = min(1.45, max_popup_h / popup.height)
    pw = max(1, int(popup.width * scale))
    ph = max(1, int(popup.height * scale))
    popup = popup.resize((pw, ph), Image.Resampling.LANCZOS)

    canvas = Image.new("RGBA", (W, H))
    canvas.paste(page, (0, 0))
    if center:
        x = (W - pw) // 2
        y = (H - ph) // 2
    else:
        x = W - pw - right
        y = top
        if y + ph > H - 12:
            y = max(12, H - ph - 12)
    round_paste(canvas, popup, x, y)
    out = canvas.convert("RGB")
    out.save(out_path, "PNG")
    print(f"wrote {out_path.name} popup={pw}x{ph} scale={scale:.2f}")


compose(CAP / "apple-page.png", CAP / "apple-main-popup.png", STORE / "screenshot-1.png", max_popup_h=760, top=20, right=24)
compose(CAP / "apple-page.png", CAP / "apple-gallery-popup.png", STORE / "screenshot-2.png", max_popup_h=760, top=16, right=20)
compose(CAP / "apple-page.png", CAP / "apple-settings-popup.png", STORE / "screenshot-3.png", max_popup_h=700, center=True)
compose(CAP / "dji-page.png", CAP / "dji-main-popup.png", STORE / "screenshot-4.png", max_popup_h=760, top=20, right=24)
compose(CAP / "dji-page.png", CAP / "dji-gallery-popup.png", STORE / "screenshot-5.png", max_popup_h=760, top=16, right=20)
