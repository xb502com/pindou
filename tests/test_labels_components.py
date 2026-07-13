from __future__ import annotations

import numpy as np

from pingdou.components import label_per_color
from pingdou.labels import build_prefix_map, index_to_letters, readable_text_color
from pingdou.palette import PaletteColor


def test_index_to_letters():
    assert index_to_letters(0) == 'a'
    assert index_to_letters(25) == 'z'
    assert index_to_letters(26) == 'aa'


def test_readable_text_color_adapts_to_background():
    assert readable_text_color('#000000') == '#E0E0E0'
    assert readable_text_color('#FFFFFF') == '#303030'


def test_label_per_color_numbers_each_bead_continuously_by_color():
    color_grid = np.array([
        ['BLACK', '', 'RED', 'RED'],
        ['BLACK', '', '', ''],
        ['', '', 'BLACK', ''],
    ], dtype=object)
    mask = color_grid != ''
    labels_per_color, display_labels, blocks_per_color, prefix_map = label_per_color(color_grid, mask)
    assert len(blocks_per_color['BLACK']) == 2
    assert len(blocks_per_color['RED']) == 1
    black_prefix = prefix_map['BLACK']
    red_prefix = prefix_map['RED']
    assert black_prefix == 'a'
    assert red_prefix == 'b'
    assert display_labels[0, 0] == f'{black_prefix}1'
    assert display_labels[1, 0] == f'{black_prefix}2'
    assert display_labels[2, 2] == f'{black_prefix}3'
    assert display_labels[0, 2] == f'{red_prefix}1'
    assert display_labels[0, 3] == f'{red_prefix}2'
    assert labels_per_color['BLACK'][2, 2] == 3


def test_prefix_map_sorts_similar_colors_dark_to_light_and_grayscale():
    palette = {
        'LIGHT_RED': PaletteColor('LIGHT_RED', '浅红', '#FF8888'),
        'DARK_BLUE': PaletteColor('DARK_BLUE', '深蓝', '#000088'),
        'DARK_RED': PaletteColor('DARK_RED', '深红', '#880000'),
    }
    prefixes = build_prefix_map(['LIGHT_RED', 'DARK_BLUE', 'DARK_RED'], palette_by_code=palette)
    assert prefixes['DARK_RED'] == 'a'
    assert prefixes['LIGHT_RED'] == 'b'
    assert prefixes['DARK_BLUE'] == 'c'

    bw = build_prefix_map(['BW_WHITE', 'BW_BLACK', 'BW_GRAY'])
    assert bw == {'BW_WHITE': 'c', 'BW_BLACK': 'a', 'BW_GRAY': 'b'}
