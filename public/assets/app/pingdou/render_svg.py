from __future__ import annotations

from html import escape

import numpy as np

from .labels import readable_text_color


def render_svg(color_grid: np.ndarray, display_labels: np.ndarray, mask: np.ndarray, palette_by_code: dict, cell: int = 24, legend_rows: list[dict] | None = None) -> str:
    h, w = color_grid.shape
    legend_h = 26 * (len(legend_rows or []) + 1) if legend_rows else 0
    width = w * cell
    height = h * cell + legend_h
    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">']
    parts.append('<rect width="100%" height="100%" fill="#ffffff"/>')
    font_size = max(5, int(cell * 0.28))
    for r in range(h):
        for c in range(w):
            if not mask[r, c]:
                continue
            code = str(color_grid[r, c])
            color = palette_by_code.get(code)
            fill = getattr(color, 'hex', '#FFFFFF')
            x, y = c * cell, r * cell
            parts.append(f'<rect x="{x}" y="{y}" width="{cell}" height="{cell}" fill="{fill}"/>')
            label = str(display_labels[r, c])
            if label:
                text_color = readable_text_color(fill)
                parts.append(
                    f'<text x="{x + cell/2:.2f}" y="{y + cell/2:.2f}" text-anchor="middle" dominant-baseline="central" '
                    f'font-family="Arial, sans-serif" font-size="{font_size}" fill="{text_color}">{escape(label)}</text>'
                )
    parts.append(_grid_path(w, h, cell))
    if legend_rows:
        y0 = h * cell + 20
        parts.append(f'<text x="0" y="{y0}" font-size="14" font-family="Arial" font-weight="700">颜色图例</text>')
        for i, row in enumerate(legend_rows):
            y = y0 + 24 * (i + 1)
            fill = row.get('hex') or '#FFFFFF'
            parts.append(f'<rect x="0" y="{y-14}" width="14" height="14" fill="{fill}" stroke="#999"/>')
            text = f"{row.get('prefix')} = {row.get('code')} / {row.get('name')} / {row.get('total_beads')}颗 / {row.get('block_count')}块"
            parts.append(f'<text x="20" y="{y}" font-size="12" font-family="Arial" fill="#303030">{escape(text)}</text>')
    parts.append('</svg>')
    return '\n'.join(parts)


def _grid_path(w: int, h: int, cell: int) -> str:
    cmds = []
    for x in range(w + 1):
        px = x * cell
        cmds.append(f'M {px} 0 V {h * cell}')
    for y in range(h + 1):
        py = y * cell
        cmds.append(f'M 0 {py} H {w * cell}')
    return f'<path d="{" ".join(cmds)}" stroke="#CBD5E1" stroke-width="0.5" fill="none"/>'
