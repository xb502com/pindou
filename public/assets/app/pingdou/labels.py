from __future__ import annotations

from typing import Iterable
import colorsys

from .palette import hex_to_rgb


ALPHABET = "abcdefghijklmnopqrstuvwxyz"


def index_to_letters(index: int) -> str:
    """0 -> a, 25 -> z, 26 -> aa."""
    if index < 0:
        raise ValueError('index must be >= 0')
    out = ""
    n = index
    while True:
        out = ALPHABET[n % 26] + out
        n = n // 26 - 1
        if n < 0:
            return out


def readable_text_color(hex_color: str) -> str:
    r, g, b = hex_to_rgb(hex_color)
    luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
    return "#E0E0E0" if luminance < 128 else "#303030"



def build_prefix_map(
    codes: Iterable[str],
    counts: dict[str, int] | None = None,
    style: str = 'short_letter',
    palette_by_code: dict | None = None,
) -> dict[str, str]:
    codes = list(dict.fromkeys(codes))
    # 黑白灰也按“从深到浅”：黑 a、灰 b、白 c。
    fixed = {'BW_BLACK': 'a', 'BW_GRAY': 'b', 'BW_WHITE': 'c'}
    result = {code: fixed[code] for code in codes if code in fixed}
    dynamic_codes = [code for code in codes if code not in fixed]
    dynamic_codes.sort(key=lambda c: color_code_sort_key(c, palette_by_code, counts))
    offset = len(result)
    result.update({code: index_to_letters(offset + i) for i, code in enumerate(dynamic_codes)})
    return result


def color_code_sort_key(code: str, palette_by_code: dict | None = None, counts: dict[str, int] | None = None):
    color = palette_by_code.get(code) if palette_by_code else None
    hex_color = getattr(color, 'hex', None) if color is not None else None
    if hex_color:
        return (*color_sort_key(hex_color), code)
    # 没有颜色信息时退回到数量大优先，保证旧调用稳定。
    return (9, 0, 0, -int(counts.get(code, 0) if counts else 0), code)


def color_sort_key(hex_color: str) -> tuple[int, int, float, float]:
    """Perceptual-ish order: similar hues stay together, each group dark -> light.

    Achromatic colors come first as black/gray/white. Chromatic colors are grouped
    by hue buckets (red/orange/yellow/green/cyan/blue/purple), and each bucket is
    sorted from dark to light. This makes a,b,c... useful as a color finding aid.
    """
    r, g, b = hex_to_rgb(hex_color)
    rf, gf, bf = r / 255.0, g / 255.0, b / 255.0
    h, l, s = colorsys.rgb_to_hls(rf, gf, bf)
    hue = h * 360.0
    luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
    if s < 0.12:
        return (0, 0, luminance, 1 - s)
    hue_bucket = int(((hue + 15) % 360) // 30)
    return (1, hue_bucket, luminance, hue)
