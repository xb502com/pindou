from __future__ import annotations

import io

import numpy as np
from PIL import Image, ImageDraw, ImageFont

from .labels import readable_text_color
from .palette import hex_to_rgb


def render_png_bytes(color_grid: np.ndarray, display_labels: np.ndarray, mask: np.ndarray, palette_by_code: dict, cell: int = 32) -> bytes:
    h, w = color_grid.shape
    img = Image.new('RGB', (w * cell, h * cell), 'white')
    draw = ImageDraw.Draw(img)
    font = ImageFont.load_default()
    for r in range(h):
        for c in range(w):
            if not mask[r, c]:
                continue
            code = str(color_grid[r, c])
            color = palette_by_code.get(code)
            fill_hex = getattr(color, 'hex', '#FFFFFF')
            x0, y0 = c * cell, r * cell
            draw.rectangle([x0, y0, x0 + cell, y0 + cell], fill=hex_to_rgb(fill_hex), outline=(203, 213, 225))
            label = str(display_labels[r, c])
            if label:
                text_color = hex_to_rgb(readable_text_color(fill_hex))
                bbox = draw.textbbox((0, 0), label, font=font)
                tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
                draw.text((x0 + (cell - tw) / 2, y0 + (cell - th) / 2), label, fill=text_color, font=font)
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    return buf.getvalue()
