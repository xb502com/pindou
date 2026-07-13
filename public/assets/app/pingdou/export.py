from __future__ import annotations

import csv
import io


def blocks_csv(color_rows: list[dict], blocks_per_color: dict) -> str:
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(['# colors'])
    writer.writerow(['prefix', 'code', 'name', 'hex', 'total_beads', 'block_count'])
    for row in color_rows:
        writer.writerow([row.get('prefix'), row.get('code'), row.get('name'), row.get('hex'), row.get('total_beads'), row.get('block_count')])
    writer.writerow([])
    writer.writerow(['# blocks'])
    writer.writerow(['label', 'prefix', 'code', 'count', 'min_r', 'min_c'])
    for code, blocks in blocks_per_color.items():
        for block in blocks:
            writer.writerow([block.label, block.prefix, code, block.count, block.min_r, block.min_c])
    return buf.getvalue()
