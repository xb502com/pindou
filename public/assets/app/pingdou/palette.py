from __future__ import annotations

from dataclasses import dataclass
import json
from pathlib import Path
from typing import Iterable

import numpy as np


@dataclass(frozen=True)
class PaletteColor:
    code: str
    name: str
    hex: str
    sort_order: int = 0
    lab: tuple[float, float, float] | None = None

    @property
    def rgb(self) -> tuple[int, int, int]:
        return hex_to_rgb(self.hex)


@dataclass(frozen=True)
class Palette:
    palette_id: str
    name: str
    colors: tuple[PaletteColor, ...]

    @property
    def by_code(self) -> dict[str, PaletteColor]:
        return {c.code: c for c in self.colors}


def hex_to_rgb(hex_color: str) -> tuple[int, int, int]:
    value = hex_color.strip().lstrip('#')
    if len(value) != 6:
        raise ValueError(f"invalid hex color: {hex_color}")
    return int(value[0:2], 16), int(value[2:4], 16), int(value[4:6], 16)


def rgb_to_hex(rgb: Iterable[int]) -> str:
    r, g, b = [max(0, min(255, int(v))) for v in rgb]
    return f"#{r:02X}{g:02X}{b:02X}"


def _pivot_rgb(v: np.ndarray) -> np.ndarray:
    v = v / 255.0
    return np.where(v > 0.04045, ((v + 0.055) / 1.055) ** 2.4, v / 12.92)


def rgb_to_lab(rgb: np.ndarray | tuple[int, int, int]) -> np.ndarray:
    """Convert sRGB to CIE Lab using D65 white point."""
    arr = np.asarray(rgb, dtype=np.float64)
    original_shape = arr.shape
    arr = arr.reshape(-1, 3)
    linear = _pivot_rgb(arr)
    matrix = np.array([
        [0.4124564, 0.3575761, 0.1804375],
        [0.2126729, 0.7151522, 0.0721750],
        [0.0193339, 0.1191920, 0.9503041],
    ])
    xyz = linear @ matrix.T
    xyz = xyz / np.array([0.95047, 1.00000, 1.08883])
    eps = 216 / 24389
    kappa = 24389 / 27
    f = np.where(xyz > eps, np.cbrt(xyz), (kappa * xyz + 16) / 116)
    l = 116 * f[:, 1] - 16
    a = 500 * (f[:, 0] - f[:, 1])
    b = 200 * (f[:, 1] - f[:, 2])
    lab = np.stack([l, a, b], axis=1)
    return lab.reshape(original_shape)


def load_palette(path: str | Path) -> Palette:
    data = json.loads(Path(path).read_text(encoding='utf-8'))
    colors: list[PaletteColor] = []
    for item in data.get('colors', []):
        lab = tuple(float(v) for v in rgb_to_lab(np.array(hex_to_rgb(item['hex']))).tolist())
        colors.append(PaletteColor(
            code=item['code'],
            name=item.get('name', item['code']),
            hex=item['hex'].upper(),
            sort_order=int(item.get('sort_order', 0)),
            lab=lab,
        ))
    colors.sort(key=lambda c: (c.sort_order, c.code))
    return Palette(data.get('palette_id', 'palette'), data.get('name', 'Palette'), tuple(colors))
