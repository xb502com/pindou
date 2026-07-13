from __future__ import annotations

import numpy as np

from .palette import Palette, PaletteColor, rgb_to_hex, rgb_to_lab
from .labels import color_sort_key


def quantize_to_palette(rgb_grid: np.ndarray, mask: np.ndarray, palette: Palette) -> np.ndarray:
    h, w, _ = rgb_grid.shape
    out = np.full((h, w), '', dtype=object)
    palette_labs = np.array([c.lab for c in palette.colors], dtype=np.float64)
    codes = [c.code for c in palette.colors]
    labs = rgb_to_lab(rgb_grid.reshape(-1, 3)).reshape(h, w, 3)
    for r in range(h):
        for c in range(w):
            if not mask[r, c]:
                continue
            delta = palette_labs - labs[r, c]
            dist = np.sum(delta * delta, axis=1)
            out[r, c] = codes[int(np.argmin(dist))]
    return out


def quantize_grid(rgb_grid: np.ndarray, mask: np.ndarray, mode: str = 'color', max_colors: int = 8, palette_by_code: dict[str, PaletteColor] | None = None) -> tuple[np.ndarray, dict[str, PaletteColor]]:
    """Quantize a sampled grid for the current output mode.

    color mode keeps exact sampled colors when their unique count is within the
    limit; otherwise it lowers color precision with weighted k-means so the final
    palette does not exceed max_colors. grayscale mode maps to black/white/gray.
    """
    if mode == 'grayscale':
        return quantize_to_black_white_gray(rgb_grid, mask)
    if palette_by_code:
        return quantize_to_bead_palette(rgb_grid, mask, palette_by_code, max_colors=max_colors)
    return quantize_to_dynamic_colors(rgb_grid, mask, max_colors=max_colors)


def quantize_to_black_white_gray(rgb_grid: np.ndarray, mask: np.ndarray) -> tuple[np.ndarray, dict[str, PaletteColor]]:
    colors = {
        'BW_BLACK': _palette_color('BW_BLACK', '黑', '#111111', 1),
        'BW_GRAY': _palette_color('BW_GRAY', '灰', '#808080', 2),
        'BW_WHITE': _palette_color('BW_WHITE', '白', '#F5F5F5', 3),
    }
    h, w, _ = rgb_grid.shape
    out = np.full((h, w), '', dtype=object)
    lum = 0.2126 * rgb_grid[:, :, 0] + 0.7152 * rgb_grid[:, :, 1] + 0.0722 * rgb_grid[:, :, 2]
    out[(lum < 85) & mask] = 'BW_BLACK'
    out[(lum > 170) & mask] = 'BW_WHITE'
    out[(lum >= 85) & (lum <= 170) & mask] = 'BW_GRAY'
    return out, colors


def quantize_to_bead_palette(
    rgb_grid: np.ndarray,
    mask: np.ndarray,
    palette_by_code: dict[str, PaletteColor],
    max_colors: int = 8,
) -> tuple[np.ndarray, dict[str, PaletteColor]]:
    """Map image samples to real bead palette codes, capped at max_colors."""
    max_colors = max(8, min(26, int(max_colors)))
    h, w, _ = rgb_grid.shape
    out = np.full((h, w), '', dtype=object)
    colors = list(dict.fromkeys(palette_by_code.values()))
    if not colors or not np.any(mask):
        return out, {}

    palette_labs = np.array([c.lab if c.lab is not None else rgb_to_lab(np.array(c.rgb)) for c in colors], dtype=np.float64)
    palette_codes = np.array([c.code for c in colors], dtype=object)
    labs = rgb_to_lab(rgb_grid.reshape(-1, 3)).reshape(h, w, 3)
    flat_labs = labs[mask].reshape(-1, 3)
    dist = np.sum((flat_labs[:, None, :] - palette_labs[None, :, :]) ** 2, axis=2)
    nearest_idx = np.argmin(dist, axis=1).astype(np.int32)
    nearest_codes = palette_codes[nearest_idx]

    unique_codes, inverse, counts = np.unique(nearest_codes, return_inverse=True, return_counts=True)
    used = [palette_by_code[str(code)] for code in unique_codes]
    if len(used) <= max_colors:
        selected = sorted(used, key=lambda c: color_sort_key(c.hex))
    else:
        used_rgb = np.array([c.rgb for c in used], dtype=np.float64)
        centers, _, _ = _weighted_kmeans(used_rgb, counts.astype(np.float64), max_colors)
        selected_codes: list[str] = []
        for center in centers:
            d = np.sum((used_rgb - center[None, :]) ** 2, axis=1)
            for idx in np.argsort(d):
                code = used[int(idx)].code
                if code not in selected_codes:
                    selected_codes.append(code)
                    break
        for idx in np.argsort(-counts):
            code = used[int(idx)].code
            if len(selected_codes) >= max_colors:
                break
            if code not in selected_codes:
                selected_codes.append(code)
        selected = sorted((palette_by_code[code] for code in selected_codes), key=lambda c: color_sort_key(c.hex))

    selected_labs = np.array([c.lab if c.lab is not None else rgb_to_lab(np.array(c.rgb)) for c in selected], dtype=np.float64)
    selected_codes = np.array([c.code for c in selected], dtype=object)
    final_dist = np.sum((flat_labs[:, None, :] - selected_labs[None, :, :]) ** 2, axis=2)
    out[mask] = selected_codes[np.argmin(final_dist, axis=1)]
    result_palette = {c.code: c for c in selected if np.any(out[mask] == c.code)}
    return out, result_palette


def quantize_to_dynamic_colors(rgb_grid: np.ndarray, mask: np.ndarray, max_colors: int = 8) -> tuple[np.ndarray, dict[str, PaletteColor]]:
    max_colors = max(8, min(26, int(max_colors)))
    h, w, _ = rgb_grid.shape
    out = np.full((h, w), '', dtype=object)
    pixels = np.rint(rgb_grid[mask]).clip(0, 255).astype(np.uint8)
    if pixels.size == 0:
        return out, {}

    unique, inverse, counts = np.unique(pixels.reshape(-1, 3), axis=0, return_inverse=True, return_counts=True)
    if len(unique) <= max_colors:
        order = _color_order(unique)
        centers = unique[order].astype(np.float64)
        center_counts = counts[order]
        old_to_new = {int(old): int(new) for new, old in enumerate(order)}
        assigned = np.array([old_to_new[int(i)] for i in inverse], dtype=np.int32)
    else:
        centers, center_counts, assigned = _weighted_kmeans(unique.astype(np.float64), counts.astype(np.float64), max_colors)
        order = _color_order(centers)
        remap = {int(old): int(new) for new, old in enumerate(order)}
        centers = centers[order]
        center_counts = center_counts[order]
        assigned = np.array([remap[int(i)] for i in assigned], dtype=np.int32)

    palette_by_code: dict[str, PaletteColor] = {}
    for i, rgb in enumerate(centers):
        code = f'C{i + 1:02d}'
        palette_by_code[code] = _palette_color(code, f'颜色 {i + 1}', rgb_to_hex(np.rint(rgb).astype(int)), i + 1)

    codes = np.array(list(palette_by_code.keys()), dtype=object)
    out[mask] = codes[assigned]
    return out, palette_by_code


def _color_order(colors: np.ndarray) -> np.ndarray:
    return np.array(sorted(
        range(len(colors)),
        key=lambda i: color_sort_key(rgb_to_hex(np.rint(colors[i]).astype(int))),
    ), dtype=np.int32)


def _weighted_kmeans(unique: np.ndarray, counts: np.ndarray, k: int) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    k = min(k, len(unique))
    centers = _initial_centers(unique, counts, k)
    assigned = np.zeros(len(unique), dtype=np.int32)
    for _ in range(10):
        dist = np.sum((unique[:, None, :] - centers[None, :, :]) ** 2, axis=2)
        next_assigned = np.argmin(dist, axis=1).astype(np.int32)
        next_centers = centers.copy()
        for i in range(k):
            members = next_assigned == i
            if np.any(members):
                weights = counts[members]
                next_centers[i] = np.average(unique[members], axis=0, weights=weights)
        changed = bool(np.any(next_assigned != assigned)) or float(np.sum((next_centers - centers) ** 2)) > 0.5
        assigned = next_assigned
        centers = next_centers
        if not changed:
            break

    used = sorted(set(int(i) for i in assigned))
    remap = {old: new for new, old in enumerate(used)}
    compact = np.zeros((len(used), 3), dtype=np.float64)
    compact_counts = np.zeros(len(used), dtype=np.float64)
    compact_assigned = np.array([remap[int(i)] for i in assigned], dtype=np.int32)
    for i in range(len(used)):
        members = compact_assigned == i
        weights = counts[members]
        compact[i] = np.average(unique[members], axis=0, weights=weights)
        compact_counts[i] = float(np.sum(weights))
    return compact, compact_counts, compact_assigned


def _initial_centers(unique: np.ndarray, counts: np.ndarray, k: int) -> np.ndarray:
    first = int(np.argmax(counts))
    chosen = [first]
    while len(chosen) < k:
        dist = np.min(np.sum((unique[:, None, :] - unique[chosen][None, :, :]) ** 2, axis=2), axis=1)
        score = dist * np.sqrt(counts)
        score[chosen] = -1
        idx = int(np.argmax(score))
        if score[idx] <= 0:
            remaining = [i for i in np.argsort(-counts) if int(i) not in chosen]
            if not remaining:
                break
            idx = int(remaining[0])
        chosen.append(idx)
    return unique[chosen].astype(np.float64)


def _palette_color(code: str, name: str, hex_color: str, sort_order: int) -> PaletteColor:
    lab = tuple(float(v) for v in rgb_to_lab(np.array(PaletteColor(code, name, hex_color).rgb)).tolist())
    return PaletteColor(code=code, name=name, hex=hex_color.upper(), sort_order=sort_order, lab=lab)
