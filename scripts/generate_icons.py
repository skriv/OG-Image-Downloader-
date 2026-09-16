#!/usr/bin/env python3
"""Generate toolbar icons for OG Downloader from the brand source image."""

from __future__ import annotations

import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "icons")
PUBLIC_OUT = os.path.join(ROOT, "public", "icons")
SOURCE = os.path.join(OUT, "source.jpg")
SOURCE_URL = "https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/green.jpg"
SIZES = (16, 32, 48, 128)


def ensure_source() -> str:
    os.makedirs(OUT, exist_ok=True)
    if os.path.isfile(SOURCE):
        return SOURCE
    print(f"Downloading {SOURCE_URL}")
    subprocess.check_call(["curl", "-fsSL", SOURCE_URL, "-o", SOURCE])
    return SOURCE


def resize(src: str, dest: str, size: int) -> None:
    subprocess.check_call(
        ["sips", "-z", str(size), str(size), src, "--out", dest],
        stdout=subprocess.DEVNULL,
    )


def main() -> int:
    if sys.platform != "darwin":
        print("This script uses macOS `sips`. On other platforms, resize public/icons/source.jpg manually.", file=sys.stderr)
        return 1

    src = ensure_source()
    master = os.path.join("/tmp", "og-icon-master.png")
    subprocess.check_call(
        ["sips", "-s", "format", "png", src, "--out", master],
        stdout=subprocess.DEVNULL,
    )

    os.makedirs(OUT, exist_ok=True)
    os.makedirs(PUBLIC_OUT, exist_ok=True)
    for size in SIZES:
        for folder in (OUT, PUBLIC_OUT):
            dest = os.path.join(folder, f"icon{size}.png")
            resize(master, dest, size)
            print(f"wrote {dest}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
