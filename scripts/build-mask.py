"""
Regenerate assets/waenn-mask-luminance.png from assets/NN.png
(same RGB invert as former main.js canvas — luminance mask for CSS mask-mode).

Requires: pip install pillow
Usage: python scripts/build-mask.py
"""
from __future__ import annotations

import os
import sys

try:
    from PIL import Image
except ImportError:
    print("Install Pillow: pip install pillow", file=sys.stderr)
    sys.exit(1)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets", "NN.png")
DST = os.path.join(ROOT, "assets", "waenn-mask-luminance.png")


def main() -> None:
    if not os.path.isfile(SRC):
        print("Missing", SRC, file=sys.stderr)
        sys.exit(1)
    im = Image.open(SRC).convert("RGBA")
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            px[x, y] = (255 - r, 255 - g, 255 - b, a)
    im.save(DST, optimize=True)
    print("Wrote", DST, f"({os.path.getsize(DST)} bytes)")


if __name__ == "__main__":
    main()
