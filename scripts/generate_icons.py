#!/usr/bin/env python3
"""Generate geometric toolbar icons for OG Downloader."""

from __future__ import annotations

import math
import os
import struct
import zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "icons")

BG = (18, 18, 18, 255)
FRAME = (44, 44, 44, 255)
INK = (242, 242, 242, 255)
ACCENT = (232, 163, 23, 255)


def mix(a, b, t):
    t = max(0.0, min(1.0, t))
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(4))


def write_png(path, w, h, pixels):
    raw = b"".join(b"\x00" + bytes(pixels[y * w * 4 : (y + 1) * w * 4]) for y in range(h))

    def chunk(tag, data):
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    png = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )
    with open(path, "wb") as fh:
        fh.write(png)


def sdf_round_rect(px, py, cx, cy, hw, hh, r):
    dx = abs(px - cx) - (hw - r)
    dy = abs(py - cy) - (hh - r)
    ax = max(dx, 0.0)
    ay = max(dy, 0.0)
    return math.hypot(ax, ay) + min(max(dx, dy), 0.0) - r


def sdf_circle(px, py, cx, cy, r):
    return math.hypot(px - cx, py - cy) - r


def fill(canvas, w, h, fn, color, width=1.4):
    for y in range(h):
        for x in range(w):
            d = fn(x + 0.5, y + 0.5)
            alpha = max(0.0, min(1.0, 0.5 - d / width))
            if alpha <= 0:
                continue
            i = (y * w + x) * 4
            src = canvas[i : i + 4]
            blended = mix(src, color, alpha * (color[3] / 255.0))
            canvas[i : i + 4] = blended


def draw_icon(size):
    canvas = bytearray(BG * (size * size))
    s = float(size)
    cx = cy = s / 2.0
    fill(
        canvas,
        size,
        size,
        lambda x, y: sdf_round_rect(x, y, cx, cy, s * 0.46, s * 0.46, s * 0.18),
        FRAME,
        width=1.2,
    )
    fill(
        canvas,
        size,
        size,
        lambda x, y: sdf_round_rect(x, y, cx, cy - s * 0.06, s * 0.30, s * 0.22, s * 0.06),
        INK,
        width=1.3,
    )
    fill(
        canvas,
        size,
        size,
        lambda x, y: sdf_round_rect(x, y, cx, cy - s * 0.06, s * 0.26, s * 0.18, s * 0.04),
        BG,
        width=1.2,
    )
    fill(
        canvas,
        size,
        size,
        lambda x, y: sdf_circle(x, y, cx - s * 0.08, cy - s * 0.14, s * 0.045),
        ACCENT,
        width=1.1,
    )

    def mountain(x, y):
        # triangle pointing up, clipped to the inner frame
        px = (x - cx) / s
        py = (y - (cy + s * 0.02)) / s
        return max(py - 0.12, abs(px) * 1.35 + py - 0.02)

    fill(canvas, size, size, mountain, INK, width=1.2)

    def arrow(x, y):
        px = (x - cx) / s
        py = (y - (cy + s * 0.30)) / s
        stem = max(abs(px) - 0.035, abs(py + 0.02) - 0.09)
        head = max(py - 0.08, abs(px) + py * 0.9 - 0.09)
        return min(stem, head)

    fill(canvas, size, size, arrow, ACCENT, width=1.2)
    return canvas


def downsample(src, src_size, dst_size):
    scale = src_size // dst_size
    out = bytearray(dst_size * dst_size * 4)
    for y in range(dst_size):
        for x in range(dst_size):
            acc = [0, 0, 0, 0]
            for dy in range(scale):
                for dx in range(scale):
                    i = ((y * scale + dy) * src_size + (x * scale + dx)) * 4
                    for c in range(4):
                        acc[c] += src[i + c]
            n = scale * scale
            j = (y * dst_size + x) * 4
            out[j : j + 4] = [acc[c] // n for c in range(4)]
    return out


def main():
    os.makedirs(OUT, exist_ok=True)
    master = draw_icon(128)
    write_png(os.path.join(OUT, "icon128.png"), 128, 128, master)
    for size in (16, 32, 48):
        write_png(os.path.join(OUT, f"icon{size}.png"), size, size, downsample(master, 128, size))


if __name__ == "__main__":
    main()
