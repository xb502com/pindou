from __future__ import annotations

import numpy as np


def usage_by_color(color_grid: np.ndarray, mask: np.ndarray, blocks_per_color: dict, prefix_map: dict[str, str], palette_by_code: dict | None = None):
    rows = []
    for code in sorted(blocks_per_color, key=lambda c: prefix_map.get(c, c)):
        color = palette_by_code.get(code) if palette_by_code else None
        rows.append({
            'prefix': prefix_map.get(code, code),
            'code': code,
            'name': getattr(color, 'name', code),
            'hex': getattr(color, 'hex', ''),
            'total_beads': int(np.sum((color_grid == code) & mask)),
            'block_count': len(blocks_per_color.get(code, [])),
        })
    return rows
