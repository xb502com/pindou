from __future__ import annotations

import numpy as np
from PIL import Image


def image_to_rgb_array(image: Image.Image) -> np.ndarray:
    return np.asarray(image.convert('RGB'), dtype=np.uint8)


def sample_grid_mean(rgb: np.ndarray, grid_h: int, grid_w: int) -> np.ndarray:
    h, w, _ = rgb.shape
    out = np.zeros((grid_h, grid_w, 3), dtype=np.uint8)
    for r in range(grid_h):
        y0 = int(round(r * h / grid_h))
        y1 = int(round((r + 1) * h / grid_h))
        y1 = max(y1, y0 + 1)
        for c in range(grid_w):
            x0 = int(round(c * w / grid_w))
            x1 = int(round((c + 1) * w / grid_w))
            x1 = max(x1, x0 + 1)
            patch = rgb[y0:y1, x0:x1]
            out[r, c] = np.mean(patch.reshape(-1, 3), axis=0).astype(np.uint8)
    return out
