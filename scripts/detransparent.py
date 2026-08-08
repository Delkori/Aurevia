#!/usr/bin/env python3
"""
Fix AI-generated planet images (Gemini, etc.) whose "transparent" background
is actually a checkerboard baked into opaque pixels — real alpha=255
everywhere, with a fake checker pattern painted in to represent transparency.

These images are typically a circular/spherical subject centered in a square
canvas, surrounded by decorative elements (rings, wireframes, sparkles) sitting
on top of the checkerboard. Trying to detect the checkerboard by color or
texture is unreliable (it gets tinted by nearby glows, blurred at tile edges).
Instead this just crops to a centered circle sized to the solid subject,
discarding the checkered surround entirely, and applies a clean circular
alpha mask — which is what gets clipped to a circle in the app anyway.

Usage: python3 scripts/detransparent.py <input.png> [output.png] [--frac 0.35] [--resize 512]

--frac controls how much of the canvas radius to keep (0.5 = full inscribed
circle). Lower it if decorative junk still peeks in; raise it if the subject
itself gets cropped. Preview crops at a few fractions and check them composited
over a dark background (not the raw PNG — viewers checker transparent areas
too, which hides real transparency bugs) before committing to one.
"""
import sys
from PIL import Image, ImageDraw

def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    inp = sys.argv[1]
    out = sys.argv[2] if len(sys.argv) > 2 and not sys.argv[2].startswith("--") else inp
    frac = float(sys.argv[sys.argv.index("--frac") + 1]) if "--frac" in sys.argv else 0.35
    resize = int(sys.argv[sys.argv.index("--resize") + 1]) if "--resize" in sys.argv else 512

    img = Image.open(inp).convert("RGBA")
    w, h = img.size
    r = int(frac * w)
    cx, cy = w // 2, h // 2
    cropped = img.crop((cx - r, cy - r, cx + r, cy + r))
    cw, ch = cropped.size
    mask = Image.new("L", (cw, ch), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, cw, ch), fill=255)
    cropped.putalpha(mask)
    if resize:
        cropped = cropped.resize((resize, resize), Image.LANCZOS)
    cropped.save(out, optimize=True)
    print(f"Saved {out} ({cropped.size[0]}x{cropped.size[1]})")

if __name__ == "__main__":
    main()
