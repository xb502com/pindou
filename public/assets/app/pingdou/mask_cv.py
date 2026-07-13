from __future__ import annotations

from collections import deque
from dataclasses import dataclass
from typing import Iterable

import numpy as np

try:  # pragma: no cover - cv2 is supplied by WASM/runtime in production.
    import cv2  # type: ignore
except Exception:  # Local tests can run without OpenCV.
    cv2 = None


@dataclass
class MaskError:
    code: str
    message: str
    cells: list[tuple[int, int]]


@dataclass
class MaskResult:
    mask: np.ndarray | None
    boundary: np.ndarray
    errors: list[MaskError]
    warnings: list[str]


def rasterize_boundary(boundary_cells: Iterable[tuple[int, int]], h: int, w: int) -> np.ndarray:
    boundary = np.zeros((h, w), dtype=np.uint8)
    for r, c in set((int(r), int(c)) for r, c in boundary_cells):
        if 0 <= r < h and 0 <= c < w:
            boundary[r, c] = 1
    return boundary


def build_mask(boundary_cells: Iterable[tuple[int, int]], h: int, w: int) -> MaskResult:
    cells = list(boundary_cells)
    boundary = rasterize_boundary(cells, h, w)
    if not cells or boundary.sum() == 0:
        return MaskResult(np.ones((h, w), dtype=bool), boundary, [], [])

    # Production prefers cv2-native operations; local fallback keeps tests deterministic.
    if cv2 is not None:
        result = _build_mask_cv2(boundary)
    else:
        result = _build_mask_fallback(boundary)

    return result


def _build_mask_cv2(boundary: np.ndarray) -> MaskResult:  # pragma: no cover - cv2 absent locally.
    h, w = boundary.shape
    b255 = (boundary * 255).astype(np.uint8)
    contours, hierarchy = cv2.findContours(b255, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)

    filled = np.zeros((h, w), dtype=np.uint8)
    for idx in range(len(contours)):
        cv2.drawContours(filled, contours, idx, 255, thickness=cv2.FILLED)
    mask = (filled > 0) | (boundary > 0)

    # If contour fill failed to create meaningful interior, use native exterior floodfill.
    if int(mask.sum()) <= int(boundary.sum()):
        mask = _fill_by_exterior(boundary)
    return MaskResult(mask.astype(bool), boundary, [], [])


def _build_mask_fallback(boundary: np.ndarray) -> MaskResult:
    mask = _fill_by_exterior(boundary)
    if int(mask.sum()) <= int(boundary.sum()):
        return MaskResult(mask, boundary, [MaskError('NO_CLOSED_AREA', '还没有形成可识别的封闭范围。', [])], [])
    return MaskResult(mask, boundary, [], [])


def _neighbors4(r: int, c: int, h: int, w: int):
    for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        nr, nc = r + dr, c + dc
        if 0 <= nr < h and 0 <= nc < w:
            yield nr, nc


def _neighbors8(r: int, c: int, h: int, w: int):
    for dr in (-1, 0, 1):
        for dc in (-1, 0, 1):
            if dr == 0 and dc == 0:
                continue
            nr, nc = r + dr, c + dc
            if 0 <= nr < h and 0 <= nc < w:
                yield nr, nc


def _fill_by_exterior(boundary: np.ndarray) -> np.ndarray:
    """Cell-grid exterior fill: boundaries are included in final mask."""
    h, w = boundary.shape
    padded = np.pad(boundary.astype(bool), 1, constant_values=False)
    visited = np.zeros_like(padded, dtype=bool)
    q: deque[tuple[int, int]] = deque([(0, 0)])
    visited[0, 0] = True
    ph, pw = padded.shape
    while q:
        r, c = q.popleft()
        for nr, nc in ((r + 1, c), (r - 1, c), (r, c + 1), (r, c - 1)):
            if 0 <= nr < ph and 0 <= nc < pw and not visited[nr, nc] and not padded[nr, nc]:
                visited[nr, nc] = True
                q.append((nr, nc))
    exterior = visited[1:-1, 1:-1]
    return (~exterior | boundary.astype(bool)).astype(bool)


def _boundary_components(boundary: np.ndarray) -> list[list[tuple[int, int]]]:
    h, w = boundary.shape
    seen = np.zeros_like(boundary, dtype=bool)
    comps: list[list[tuple[int, int]]] = []
    for r, c in zip(*np.where(boundary > 0)):
        if seen[r, c]:
            continue
        q = deque([(int(r), int(c))])
        seen[r, c] = True
        comp: list[tuple[int, int]] = []
        while q:
            cr, cc = q.popleft()
            comp.append((cr, cc))
            for nr, nc in _neighbors8(cr, cc, h, w):
                if boundary[nr, nc] and not seen[nr, nc]:
                    seen[nr, nc] = True
                    q.append((nr, nc))
        comps.append(comp)
    return comps


def _component_mask(comp: list[tuple[int, int]], shape: tuple[int, int]) -> np.ndarray:
    b = np.zeros(shape, dtype=np.uint8)
    for r, c in comp:
        b[r, c] = 1
    return _fill_by_exterior(b)


def _touches(a: list[tuple[int, int]], bset: set[tuple[int, int]], shape: tuple[int, int]) -> bool:
    h, w = shape
    for r, c in a:
        if (r, c) in bset:
            return True
        if any((nr, nc) in bset for nr, nc in _neighbors8(r, c, h, w)):
            return True
    return False


def _detect_nested_components(boundary: np.ndarray) -> list[MaskError]:
    comps = _boundary_components(boundary)
    if len(comps) < 2:
        return []
    comp_sets = [set(comp) for comp in comps]
    comp_masks = [_component_mask(comp, boundary.shape) for comp in comps]
    errors: list[MaskError] = []
    for i, outer_mask in enumerate(comp_masks):
        for j, comp in enumerate(comps):
            if i == j:
                continue
            if _touches(comp, comp_sets[i], boundary.shape):
                continue
            inside = all(bool(outer_mask[r, c]) for r, c in comp)
            if inside:
                errors.append(MaskError(
                    'NESTED_LOOP',
                    '检测到圈套圈：当前版本不支持在一个范围内再挖洞。',
                    comp,
                ))
    # De-duplicate same inner component reported against multiple outers.
    unique: dict[tuple[tuple[int, int], ...], MaskError] = {}
    for err in errors:
        unique[tuple(sorted(err.cells))] = err
    return list(unique.values())
