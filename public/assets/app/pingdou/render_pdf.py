from __future__ import annotations


def svg_to_printable_html(svg: str, title: str = 'Pingdou 图纸') -> str:
    """MVP PDF path: open this HTML and use browser print/save as PDF.

    A later milestone may replace this with direct vector PDF generation. The SVG remains
    vector, so browser-generated PDF keeps rect/text sharp in common browsers.
    """
    return f"""<!doctype html>
<html lang=\"zh-CN\">
<head>
<meta charset=\"utf-8\" />
<title>{title}</title>
<style>
@page {{ size: auto; margin: 10mm; }}
body {{ margin: 0; font-family: Arial, sans-serif; }}
svg {{ max-width: 100%; height: auto; }}
</style>
</head>
<body>{svg}</body>
</html>"""
