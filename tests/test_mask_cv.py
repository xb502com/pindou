from __future__ import annotations

from pingdou.mask_cv import build_mask


def rect_cells(r0, c0, r1, c1):
    cells = []
    for c in range(c0, c1 + 1):
        cells.append((r0, c))
        cells.append((r1, c))
    for r in range(r0, r1 + 1):
        cells.append((r, c0))
        cells.append((r, c1))
    return cells


def test_empty_boundary_means_full_board():
    result = build_mask([], 5, 6)
    assert not result.errors
    assert result.mask is not None
    assert result.mask.shape == (5, 6)
    assert result.mask.all()


def test_single_closed_rect_fills_inside_and_excludes_outside():
    result = build_mask(rect_cells(1, 1, 4, 4), 8, 8)
    assert not result.errors
    mask = result.mask
    assert mask is not None
    assert mask[2, 2]
    assert mask[0, 0] is False or not bool(mask[0, 0])


def test_figure_eight_shared_edge_is_valid_union():
    cells = rect_cells(1, 1, 4, 4) + rect_cells(4, 1, 7, 4)  # share one edge row
    result = build_mask(cells, 10, 7)
    assert not result.errors
    mask = result.mask
    assert mask is not None
    assert mask[2, 2]
    assert mask[6, 2]


def test_touching_or_overlapping_loops_are_valid():
    cells = rect_cells(1, 1, 4, 4) + rect_cells(3, 3, 6, 6)
    result = build_mask(cells, 9, 9)
    assert not result.errors
    assert result.mask is not None
    assert result.mask[2, 2]
    assert result.mask[5, 5]


def test_nested_loop_uses_outermost_region():
    cells = rect_cells(1, 1, 8, 8) + rect_cells(3, 3, 5, 5)
    result = build_mask(cells, 11, 11)
    assert not result.errors
    mask = result.mask
    assert mask is not None
    assert mask[2, 2]
    assert mask[4, 4]
    assert not bool(mask[0, 0])


def test_multiple_independent_loops_union_is_valid():
    cells = rect_cells(1, 1, 3, 3) + rect_cells(6, 6, 8, 8)
    result = build_mask(cells, 10, 10)
    assert not result.errors
    assert result.mask is not None
    assert result.mask[2, 2]
    assert result.mask[7, 7]
    assert not bool(result.mask[0, 0])


def test_external_spur_does_not_make_closed_loop_invalid():
    cells = rect_cells(2, 2, 6, 6) + [(1, 2), (0, 2)]
    result = build_mask(cells, 9, 9)
    assert not result.errors
    assert result.mask is not None
    assert result.mask[4, 4]
    assert not bool(result.mask[1, 1])


def test_out_of_range_boundary_cells_fallback_to_full_board():
    result = build_mask([(-1, -1), (99, 99)], 4, 4)
    assert not result.errors
    assert result.mask is not None
    assert result.mask.all()
