#!/usr/bin/env python3
"""
Fix baked-in checkerboard transparency for irregularly-shaped subjects
(ships, etc.) that can't just be circle-cropped like planets — the
checkerboard has to be removed by chroma/connectivity instead.

Approach: any pixel that is near-neutral gray (low saturation) AND
reachable from the image border through other near-neutral pixels is
background (the checkerboard tiles are all neutral grays and orthogonally
connected to each other and to the border). Everything else — the ship's
colored panels, glows, and gray hull plates that are enclosed by non-gray
edges — survives. Edges get a soft feather so the cutout isn't jagged.

Usage: python3 scripts/detransparent_silhouette.py <in.png> [out.png] [--tol 18] [--resize 512]
"""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    inp = sys.argv[1]
    out = sys.argv[2] if len(sys.argv) > 2 and not sys.argv[2].startswith("--") else inp
    tol = int(sys.argv[sys.argv.index("--tol") + 1]) if "--tol" in sys.argv else 18
    resize = int(sys.argv[sys.argv.index("--resize") + 1]) if "--resize" in sys.argv else 512

    img = Image.open(inp).convert("RGBA")
    arr = np.array(img).astype(np.int16)
    r, g, b = arr[..., 0], arr[..., 1], arr[..., 2]
    sat = np.maximum(np.maximum(r, g), b) - np.minimum(np.minimum(r, g), b)
    neutral = sat <= tol

    h, w = neutral.shape
    border = np.zeros_like(neutral)
    border[0, :] = border[-1, :] = border[:, 0] = border[:, -1] = True
    seed = neutral & border

    # Dilate the neutral mask before labeling connectivity only, so a
    # checkerboard patch separated from the border by a couple of
    # antialiased edge pixels still counts as connected background.
    neutral_dilated = ndimage.binary_dilation(neutral, iterations=2)
    labeled, _ = ndimage.label(neutral_dilated, structure=np.ones((3, 3)))
    bg_labels = set(np.unique(labeled[seed]))
    bg_labels.discard(0)
    bg_mask = np.isin(labeled, list(bg_labels))

    alpha = np.where(bg_mask, 0, 255).astype(np.uint8)
    # feather: blur the mask edge slightly so the cutout isn't pixel-hard
    alpha_f = ndimage.gaussian_filter(alpha.astype(np.float32), sigma=1.0)
    alpha_f = np.clip(alpha_f, 0, 255).astype(np.uint8)

    out_arr = arr.copy().astype(np.uint8)
    out_arr[..., 3] = alpha_f
    result = Image.fromarray(out_arr, "RGBA")

    # crop to the surviving content's bounding box with a small margin
    bbox = result.getbbox()
    if bbox:
        x0, y0, x1, y1 = bbox
        pad = int(0.04 * max(x1 - x0, y1 - y0))
        x0, y0 = max(0, x0 - pad), max(0, y0 - pad)
        x1, y1 = min(w, x1 + pad), min(h, y1 + pad)
        result = result.crop((x0, y0, x1, y1))

    if resize:
        ratio = result.height / result.width
        result = result.resize((resize, int(resize * ratio)), Image.LANCZOS)
    result.save(out, optimize=True)
    print(f"Saved {out} ({result.size[0]}x{result.size[1]})")


if __name__ == "__main__":
    main()
