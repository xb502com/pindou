from __future__ import annotations

import io
from pathlib import Path
from PIL import Image
import streamlit as st

from pingdou.components import label_per_color
from pingdou.grid import image_to_rgb_array, sample_grid_mean
from pingdou.mask_cv import build_mask
from pingdou.palette import load_palette
from pingdou.quantize import quantize_grid
from pingdou.render_svg import render_svg
from pingdou.stats import usage_by_color
from pingdou.export import blocks_csv

st.set_page_config(page_title='Pingdou 拼豆图生成器', layout='wide')
st.title('Pingdou 拼豆图生成器 v0.7')
st.caption('纯前端 WebAssembly 本地计算：图片不上传，按颜色分块标序，SVG/PDF 清晰导出。')

st.info('开发提示：当前 UI 为 MVP 骨架。完整绘制画布将在后续接入 stlite 前端组件；核心算法已放入 pingdou 包。')

uploaded = st.file_uploader('上传图片（本地处理）', type=['png', 'jpg', 'jpeg', 'webp'])
image: Image.Image | None = None
if uploaded:
    image = Image.open(io.BytesIO(uploaded.getvalue()))

mode = st.radio('生成模式', ['color', 'grayscale'], format_func=lambda x: '彩色模式' if x == 'color' else '黑白灰模式', horizontal=True)
max_colors = st.number_input('彩色模式最大颜色数', min_value=8, max_value=26, value=8, step=1, disabled=(mode == 'grayscale'))

if image:
    aspect = image.width / image.height
    base = st.radio('精细度调整方式', ['cols', 'rows'], format_func=lambda x: '改列数，自动算行数' if x == 'cols' else '改行数，自动算列数', horizontal=True)
    if base == 'cols':
        grid_w = st.number_input('列数 W', min_value=4, max_value=200, value=32, step=1)
        grid_h = max(4, min(200, int(round(int(grid_w) / aspect))))
    else:
        grid_h = st.number_input('行数 H', min_value=4, max_value=200, value=32, step=1)
        grid_w = max(4, min(200, int(round(int(grid_h) * aspect))))
    st.caption(f'已按原图比例锁定为 {int(grid_w)}×{int(grid_h)}；导出的每个拼豆格都是正方形。')

    st.image(image, caption='原图预览', use_container_width=True)
    rgb = image_to_rgb_array(image)
    rgb_grid = sample_grid_mean(rgb, int(grid_h), int(grid_w))

    # MVP 默认整板；绘制画布接入后 boundary_cells 来自用户涂边界。
    boundary_cells: list[tuple[int, int]] = []
    mask_result = build_mask(boundary_cells, int(grid_h), int(grid_w))
    mask = mask_result.mask
    if mask is None:
        st.error(mask_result.errors[0].message if mask_result.errors else 'mask 生成失败')
        st.stop()

    palette_path = Path(__file__).parents[1] / 'palettes' / 'basic.json'
    source_palette = load_palette(palette_path)
    color_grid, palette_by_code = quantize_grid(rgb_grid, mask, mode=mode, max_colors=int(max_colors), palette_by_code=source_palette.by_code)
    labels_per_color, display_labels, blocks_per_color, prefix_map = label_per_color(color_grid, mask, palette_by_code=palette_by_code)
    rows = usage_by_color(color_grid, mask, blocks_per_color, prefix_map, palette_by_code)

    st.subheader('颜色清单')
    st.dataframe(rows, use_container_width=True)

    svg = render_svg(color_grid, display_labels, mask, palette_by_code, cell=24, legend_rows=rows)
    st.download_button('下载 SVG 矢量图纸', svg.encode('utf-8'), file_name='pingdou.svg', mime='image/svg+xml')
    csv_text = blocks_csv(rows, blocks_per_color)
    st.download_button('下载 CSV 清单', csv_text.encode('utf-8-sig'), file_name='pingdou.csv', mime='text/csv')

    st.subheader('SVG 预览')
    st.components.v1.html(svg, height=min(900, int(grid_h) * 24 + 260), scrolling=True)
else:
    st.write('请先上传图片。首次访问若正在加载 WASM，请等待本地 Python 算力中心初始化完成。')
