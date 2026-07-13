from __future__ import annotations

from pathlib import Path

import numpy as np

from pingdou.palette import load_palette
from pingdou.render_svg import render_svg


def test_load_palette_and_render_svg_contains_vector_nodes():
    palette = load_palette(Path('public/assets/palettes/basic.json'))
    assert 'P01' in palette.by_code
    assert 'P18' in palette.by_code
    color_grid = np.array([['P18', 'P01']], dtype=object)
    display = np.array([['a1', 'b1']], dtype=object)
    mask = np.array([[True, True]])
    svg = render_svg(color_grid, display, mask, palette.by_code, cell=20)
    assert '<svg' in svg
    assert '<rect' in svg
    assert '<text' in svg
    assert 'a1' in svg


def test_dynamic_quantize_limits_color_count_and_grayscale_codes():
    from pingdou.quantize import quantize_grid

    rgb_grid = np.array([
        [[0, 0, 0], [255, 255, 255], [128, 128, 128]],
        [[255, 0, 0], [0, 255, 0], [0, 0, 255]],
        [[255, 255, 0], [0, 255, 255], [255, 0, 255]],
    ], dtype=np.uint8)
    mask = np.ones((3, 3), dtype=bool)
    source_palette = load_palette(Path('public/assets/palettes/basic.json'))
    color_grid, palette = quantize_grid(rgb_grid, mask, mode='color', max_colors=8, palette_by_code=source_palette.by_code)
    assert len(set(color_grid[mask].tolist())) <= 8
    assert len(palette) <= 8
    assert all(str(code).startswith('P') for code in set(color_grid[mask].tolist()))

    gray_grid, gray_palette = quantize_grid(rgb_grid, mask, mode='grayscale')
    assert set(gray_grid[mask].tolist()) <= {'BW_BLACK', 'BW_WHITE', 'BW_GRAY'}
    assert {'BW_BLACK', 'BW_WHITE', 'BW_GRAY'} <= set(gray_palette)
