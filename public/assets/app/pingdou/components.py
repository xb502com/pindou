from __future__ import annotations

from collections import deque
from dataclasses import dataclass

import numpy as np

try:  # pragma: no cover
    import cv2  # type: ignore
except Exception:
    cv2 = None

from .labels import build_prefix_map


@dataclass
class BlockMeta:
    id: int
    label: str
    code: str
    prefix: str
    count: int
    min_r: int
    min_c: int
    start_id: int = 0
    end_id: int = 0


def label_per_color(color_grid: np.ndarray, mask: np.ndarray, prefix_style: str = 'short_letter', palette_by_code: dict | None = None):
    codes = [str(c) for c in np.unique(color_grid[mask]) if str(c)]
    counts = {code: int(np.sum((color_grid == code) & mask)) for code in codes}
    prefix_map = build_prefix_map(codes, counts, prefix_style, palette_by_code)
    labels_per_color: dict[str, np.ndarray] = {}
    blocks_per_color: dict[str, list[BlockMeta]] = {}
    display_labels = np.full(color_grid.shape, '', dtype=object)

    for code in sorted(codes, key=lambda c: prefix_map[c]):
        binary = ((color_grid == code) & mask).astype(np.uint8)
        raw = _connected_components(binary, connectivity=8)
        local, blocks = _remap_tb_lr(raw, code, prefix_map[code])
        labels_per_color[code] = local
        blocks_per_color[code] = blocks
        for r, c in zip(*np.where(local > 0)):
            display_labels[r, c] = f'{prefix_map[code]}{int(local[r, c])}'
    return labels_per_color, display_labels, blocks_per_color, prefix_map


def _connected_components(binary: np.ndarray, connectivity: int = 8) -> np.ndarray:
    if cv2 is not None:  # pragma: no cover
        _, labeled = cv2.connectedComponents(binary.astype(np.uint8), connectivity=connectivity)
        return labeled.astype(np.int32)
    h, w = binary.shape
    labels = np.zeros((h, w), dtype=np.int32)
    current = 0
    for r, c in zip(*np.where(binary > 0)):
        r, c = int(r), int(c)
        if labels[r, c]:
            continue
        current += 1
        q = deque([(r, c)])
        labels[r, c] = current
        while q:
            cr, cc = q.popleft()
            for nr, nc in _neighbors(cr, cc, h, w, connectivity):
                if binary[nr, nc] and not labels[nr, nc]:
                    labels[nr, nc] = current
                    q.append((nr, nc))
    return labels


def _neighbors(r: int, c: int, h: int, w: int, connectivity: int):
    directions = [(-1, 0), (1, 0), (0, -1), (0, 1)]
    if connectivity == 8:
        directions += [(-1, -1), (-1, 1), (1, -1), (1, 1)]
    for dr, dc in directions:
        nr, nc = r + dr, c + dc
        if 0 <= nr < h and 0 <= nc < w:
            yield nr, nc


def _remap_tb_lr(raw: np.ndarray, code: str, prefix: str) -> tuple[np.ndarray, list[BlockMeta]]:
    """Number every bead of the same color continuously, block by block.

    Blocks are 8-connected components. Component order is top-to-bottom, then
    left-to-right by the component's first cell; cells within each component use
    the same top-to-bottom / left-to-right scan.
    """
    local = np.zeros_like(raw, dtype=np.int32)
    metas = []
    for raw_id in range(1, int(raw.max()) + 1):
        ys, xs = np.where(raw == raw_id)
        if ys.size == 0:
            continue
        cells = sorted((int(r), int(c)) for r, c in zip(ys, xs))
        min_r, min_c = cells[0]
        metas.append((raw_id, cells, min_r, min_c))
    metas.sort(key=lambda m: (m[2], m[3]))
    blocks: list[BlockMeta] = []
    serial = 1
    for block_id, (raw_id, cells, min_r, min_c) in enumerate(metas, start=1):
        start_id = serial
        for r, c in cells:
            local[r, c] = serial
            serial += 1
        end_id = serial - 1
        label = f'{prefix}{start_id}' if start_id == end_id else f'{prefix}{start_id}-{prefix}{end_id}'
        blocks.append(BlockMeta(block_id, label, code, prefix, len(cells), min_r, min_c, start_id, end_id))
    return local, blocks
