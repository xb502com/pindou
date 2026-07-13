const DEFAULT_PALETTE = {
  palette_id: 'basic_demo_v1',
  name: 'Basic Demo Palette',
  colors: [
    { code: 'A01', name: 'Black', hex: '#111111', sort_order: 1 },
    { code: 'B01', name: 'White', hex: '#F5F5F5', sort_order: 2 },
    { code: 'C01', name: 'Red', hex: '#D62020', sort_order: 3 },
    { code: 'D01', name: 'Yellow', hex: '#FACC15', sort_order: 4 },
    { code: 'E01', name: 'Blue', hex: '#2563EB', sort_order: 5 },
    { code: 'F01', name: 'Green', hex: '#16A34A', sort_order: 6 },
  ],
};

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz';

let appState = {
  image: null,
  palette: null,
  paletteByCode: new Map(),
  sourcePaletteColors: [],
  sourcePaletteByCode: new Map(),
  boundaryCells: new Set(),
  colorGrid: null,
  displayLabels: null,
  mask: null,
  rows: [],
  blocksPerColor: new Map(),
  focus: 'all',
  painting: false,
  eraseMode: false,
  previewMask: null,
  boundaryErrors: [],
  boundaryDebounceTimer: null,
  paintStroke: null,
  syncingGrid: false,
  editColor: '',
};

export async function mountNativePingdouApp(root) {
  root.innerHTML = renderShell();
  injectStyle();
  await loadPalette();
  bindEvents();
  setStatus('已进入浏览器原生 MVP 模式：可上传图片、生成图纸并导出 SVG/PNG/CSV。');
}

function renderShell() {
  return `
    <div class="pd-app">
      <header class="pd-hero">
        <div>
          <p class="pd-kicker">Pingdou v0.7 · 本地运行</p>
          <h1>拼豆图生成器</h1>
          <p>上传图片后在浏览器内完成网格采样、色板转换、分色标序和导出。图片不会上传服务器。</p>
        </div>
        <div class="pd-privacy">🔒 纯前端本地处理</div>
      </header>

      <section class="pd-panel pd-controls">
        <label class="pd-file">
          <span>上传图片 PNG/JPG/WebP</span>
          <input id="pd-file" type="file" accept="image/png,image/jpeg,image/webp" />
        </label>
        <label>模式
          <select id="pd-color-mode">
            <option value="color">彩色模式</option>
            <option value="grayscale">黑白灰模式</option>
          </select>
        </label>
        <label>最大颜色<input id="pd-max-colors" type="number" min="8" max="26" value="8" /></label>
        <label>列数 W<input id="pd-grid-w" type="number" min="4" max="200" value="32" title="按图片长宽比自动联动行数，格子保持正方形" /></label>
        <label>行数 H<input id="pd-grid-h" type="number" min="4" max="200" value="32" title="按图片长宽比自动联动列数，格子保持正方形" /></label>
        <button id="pd-generate" class="pd-primary" type="button">生成图纸</button>
      </section>

      <section class="pd-panel pd-boundary-help">
        <strong>围圈说明：</strong>不画边界时默认整板有效。需要局部区域时，可在下方预览上拖拽涂边界格；蓝色为边界，单击同一格可取消，点击“生成图纸”后自动填充圈内。支持嵌套圈，最终以最外围的圈为准。
        <div class="pd-inline-actions">
          <button id="pd-draw-mode" type="button">绘制边界</button>
          <button id="pd-erase-mode" type="button">擦除边界</button>
          <button id="pd-clear-boundary" type="button">清空边界</button>
        </div>
      </section>

      <div id="pd-status" class="pd-status"></div>

      <main class="pd-grid-layout">
        <section class="pd-panel">
          <div class="pd-section-title"><h2>图片与网格预览</h2><span id="pd-boundary-count">边界 0 格</span></div>
          <canvas id="pd-preview" width="960" height="640"></canvas>
        </section>

        <section class="pd-panel">
          <div class="pd-section-title"><h2>图纸预览</h2><div class="pd-preview-controls"><select id="pd-focus"><option value="all">全部颜色</option></select><select id="pd-edit-color" disabled><option value="">修色关闭</option></select></div></div>
          <div id="pd-svg-preview" class="pd-svg-preview"><p>生成后显示 SVG 矢量图纸。</p></div>
          <div class="pd-actions">
            <button id="pd-download-svg" type="button" disabled>下载 SVG</button>
            <button id="pd-download-png" type="button" disabled>下载 PNG</button>
            <button id="pd-download-csv" type="button" disabled>下载 CSV</button>
            <button id="pd-print-pdf" type="button" disabled>打印/另存 PDF</button>
            <button id="pd-download-project" type="button" disabled>下载工程 JSON</button>
          </div>
        </section>
      </main>

      <section class="pd-panel">
        <h2>颜色清单</h2>
        <div id="pd-usage" class="pd-table-wrap"><p>暂无数据。</p></div>
      </section>
    </div>
  `;
}

function injectStyle() {
  if (document.getElementById('pd-native-style')) return;
  const style = document.createElement('style');
  style.id = 'pd-native-style';
  style.textContent = `
    .pd-app{max-width:1280px;margin:0 auto;padding:28px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#0f172a}
    .pd-hero{display:flex;justify-content:space-between;gap:24px;align-items:center;margin-bottom:18px;padding:28px;border-radius:24px;background:linear-gradient(135deg,#eff6ff,#f5f3ff);box-shadow:0 18px 50px rgba(15,23,42,.08)}
    .pd-hero h1{margin:0 0 8px;font-size:34px}.pd-hero p{margin:0;color:#475569;line-height:1.7}.pd-kicker{font-weight:800;color:#2563eb}.pd-privacy{padding:12px 16px;background:#fff;border-radius:999px;font-weight:700;white-space:nowrap}
    .pd-panel{background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:18px;margin-bottom:16px;box-shadow:0 10px 30px rgba(15,23,42,.06)}
    .pd-controls{display:grid;grid-template-columns:2fr repeat(4,minmax(110px,1fr)) auto;gap:12px;align-items:end}.pd-controls label,.pd-file{display:flex;flex-direction:column;gap:6px;font-size:13px;font-weight:700;color:#334155}.pd-controls input,.pd-controls select{height:38px;border:1px solid #cbd5e1;border-radius:10px;padding:0 10px;background:#fff}.pd-file input{padding:8px;height:auto}.pd-primary{background:#2563eb;color:white;border-color:#2563eb}
    button{height:38px;border:1px solid #cbd5e1;border-radius:10px;background:#fff;padding:0 14px;font-weight:800;cursor:pointer}button:disabled{opacity:.45;cursor:not-allowed}.pd-inline-actions{display:inline-flex;gap:8px;margin-left:12px;flex-wrap:wrap}.pd-boundary-help{color:#475569;line-height:1.7}.pd-status{min-height:22px;margin:8px 4px 16px;color:#2563eb;font-weight:700}.pd-status.pd-error{color:#dc2626}
    .pd-grid-layout{display:grid;grid-template-columns:minmax(420px,1fr) minmax(420px,1fr);gap:16px}.pd-section-title{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:12px}.pd-preview-controls{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.pd-preview-controls select{height:34px;border:1px solid #cbd5e1;border-radius:9px;padding:0 8px;background:#fff}.pd-section-title h2,.pd-panel h2{margin:0;font-size:20px}#pd-preview{width:100%;max-height:72vh;border:1px solid #cbd5e1;border-radius:14px;background:#f8fafc;touch-action:none}.pd-svg-preview{min-height:260px;overflow:auto;border:1px dashed #cbd5e1;border-radius:14px;padding:12px;background:#f8fafc}.pd-svg-preview svg{max-width:100%;height:auto;background:white}.pd-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.pd-table-wrap{overflow:auto}.pd-table{width:100%;border-collapse:collapse;font-size:14px}.pd-table th,.pd-table td{padding:9px 10px;border-bottom:1px solid #e2e8f0;text-align:left}.pd-swatch{display:inline-block;width:16px;height:16px;border:1px solid #94a3b8;border-radius:4px;vertical-align:-3px;margin-right:8px}
    .pd-svg-preview{-webkit-overflow-scrolling:touch;overscroll-behavior:contain}.pd-controls input,.pd-controls select,.pd-preview-controls select,button{font-size:16px}
    @media (max-width:1000px){.pd-grid-layout{grid-template-columns:1fr}.pd-controls{grid-template-columns:1fr 1fr}.pd-hero{display:block}.pd-privacy{display:inline-block;margin-top:14px}.pd-inline-actions{display:flex;margin:10px 0 0}}
    @media (max-width:640px){.pd-app{padding:12px}.pd-hero{padding:18px;border-radius:18px;margin-bottom:12px}.pd-hero h1{font-size:26px}.pd-panel{padding:12px;border-radius:14px}.pd-controls{grid-template-columns:1fr;gap:10px}.pd-grid-layout{gap:10px}.pd-section-title{align-items:flex-start;flex-direction:column}.pd-preview-controls{width:100%;display:grid;grid-template-columns:1fr;gap:8px}.pd-preview-controls select{width:100%}#pd-preview{max-height:56vh}.pd-svg-preview{max-height:68vh;padding:8px}.pd-actions{display:grid;grid-template-columns:1fr 1fr}.pd-actions button{width:100%;padding:0 8px}.pd-inline-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.pd-inline-actions button{width:100%}.pd-inline-actions button:last-child{grid-column:1/-1}.pd-table{font-size:13px}.pd-table th,.pd-table td{padding:7px 8px}}
    @media (max-width:380px){.pd-actions{grid-template-columns:1fr}.pd-hero h1{font-size:23px}}
  `;
  document.head.appendChild(style);
}

async function loadPalette() {
  let data = DEFAULT_PALETTE;
  try {
    const res = await fetch('/assets/palettes/basic.json', { cache: 'no-cache' });
    if (res.ok) data = await res.json();
  } catch (_) {
    data = DEFAULT_PALETTE;
  }
  const colors = (data.colors || DEFAULT_PALETTE.colors)
    .map((color) => ({ ...color, hex: String(color.hex).toUpperCase(), lab: rgbToLab(hexToRgb(color.hex)) }))
    .sort((a, b) => (Number(a.sort_order || 0) - Number(b.sort_order || 0)) || String(a.code).localeCompare(String(b.code)));
  appState.palette = { ...data, colors };
  appState.sourcePaletteColors = colors;
  appState.sourcePaletteByCode = new Map(colors.map((c) => [String(c.code), c]));
  appState.paletteByCode = new Map(colors.map((c) => [String(c.code), c]));
}

function bindEvents() {
  const file = byId('pd-file');
  file.addEventListener('change', handleFile);
  byId('pd-grid-w').addEventListener('change', () => handleGridDimChange('w'));
  byId('pd-grid-h').addEventListener('change', () => handleGridDimChange('h'));
  byId('pd-generate').addEventListener('click', generatePattern);
  byId('pd-color-mode').addEventListener('change', updateColorModeUi);
  updateColorModeUi();
  byId('pd-clear-boundary').addEventListener('click', () => { appState.boundaryCells.clear(); appState.previewMask = null; appState.boundaryErrors = []; updateBoundaryCount(); drawPreview(); setStatus('已清空边界；未涂边界时默认整板有效。'); });
  byId('pd-draw-mode').addEventListener('click', () => { appState.eraseMode = false; setStatus('绘制模式：在预览图上拖拽涂蓝色边界格，单击已标记格可取消。'); });
  byId('pd-erase-mode').addEventListener('click', () => { appState.eraseMode = true; setStatus('擦除模式：在预览图上拖拽擦除边界格。'); });
  byId('pd-focus').addEventListener('change', (event) => { appState.focus = event.target.value; refreshOutputs(); });
  byId('pd-edit-color').addEventListener('change', (event) => {
    appState.editColor = event.target.value;
    if (appState.editColor) setStatus('修色模式：在右侧图纸上点击需要修改的方格，即可改成所选颜色并自动重算编号/数量。');
    refreshOutputs();
  });
  byId('pd-download-svg').addEventListener('click', () => downloadText('pingdou.svg', renderCurrentSvg(), 'image/svg+xml;charset=utf-8'));
  byId('pd-download-csv').addEventListener('click', () => downloadText('pingdou.csv', buildCsv(), 'text/csv;charset=utf-8'));
  byId('pd-download-png').addEventListener('click', downloadPng);
  byId('pd-print-pdf').addEventListener('click', openPrintPage);
  byId('pd-download-project').addEventListener('click', downloadProject);

  const canvas = byId('pd-preview');
  canvas.addEventListener('pointerdown', (event) => {
    appState.painting = true;
    appState.paintStroke = { moved: false, startKey: null, startWasBoundary: false, lastKey: null };
    canvas.setPointerCapture(event.pointerId);
    paintBoundaryCell(event);
  });
  canvas.addEventListener('pointermove', (event) => { if (appState.painting) paintBoundaryCell(event); });
  canvas.addEventListener('pointerup', (event) => {
    if (appState.painting) finishBoundaryStroke();
    appState.painting = false;
    appState.paintStroke = null;
    updateBoundaryCount();
    validateBoundaryPreview(true);
    try { canvas.releasePointerCapture(event.pointerId); } catch (_) {}
  });
  canvas.addEventListener('pointerleave', () => { appState.painting = false; });
}

function handleFile(event) {
  const selected = event.target.files && event.target.files[0];
  if (!selected) return;
  const url = URL.createObjectURL(selected);
  const img = new Image();
  img.onload = () => {
    URL.revokeObjectURL(url);
    appState.image = img;
    appState.boundaryCells.clear();
    appState.previewMask = null;
    appState.boundaryErrors = [];
    syncGridToImageAspect('w');
    const dims = getGridDims();
    updateBoundaryCount();
    setStatus(`已读取图片：${img.naturalWidth}×${img.naturalHeight}。已按原图比例设为 ${dims.w}×${dims.h}，格子为正方形。`);
    drawPreview();
  };
  img.onerror = () => setError('图片读取失败，请换一张 PNG/JPG/WebP。');
  img.src = url;
}

function drawPreview() {
  const canvas = byId('pd-preview');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!appState.image) {
    ctx.fillStyle = '#64748b';
    ctx.font = '22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('请先上传图片', canvas.width / 2, canvas.height / 2);
    return;
  }
  const box = previewBox(canvas, appState.image);
  ctx.drawImage(appState.image, box.x, box.y, box.w, box.h);
  const dims = getGridDims();
  const gridBox = gridPreviewBox(box, dims);
  drawMaskPreview(ctx, gridBox, dims);
  ctx.save();
  ctx.strokeStyle = 'rgba(15,23,42,.28)';
  ctx.lineWidth = 1;
  for (let c = 0; c <= dims.w; c++) {
    const x = gridBox.x + c * gridBox.cell;
    ctx.beginPath(); ctx.moveTo(x, gridBox.y); ctx.lineTo(x, gridBox.y + gridBox.h); ctx.stroke();
  }
  for (let r = 0; r <= dims.h; r++) {
    const y = gridBox.y + r * gridBox.cell;
    ctx.beginPath(); ctx.moveTo(gridBox.x, y); ctx.lineTo(gridBox.x + gridBox.w, y); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(37,99,235,.58)';
  for (const key of appState.boundaryCells) {
    const [r, c] = key.split(',').map(Number);
    if (r < 0 || r >= dims.h || c < 0 || c >= dims.w) continue;
    ctx.fillRect(gridBox.x + c * gridBox.cell, gridBox.y + r * gridBox.cell, gridBox.cell, gridBox.cell);
  }
  drawBoundaryErrors(ctx, gridBox, dims);
  ctx.restore();
}


function drawMaskPreview(ctx, gridBox, dims) {
  const mask = appState.previewMask;
  if (!mask || !appState.boundaryCells.size) return;
  const cellW = gridBox.cell;
  const cellH = gridBox.cell;
  ctx.save();
  ctx.fillStyle = 'rgba(34,197,94,.20)';
  for (let r = 0; r < dims.h; r++) {
    for (let c = 0; c < dims.w; c++) {
      if (!mask[r] || !mask[r][c] || appState.boundaryCells.has(`${r},${c}`)) continue;
      ctx.fillRect(gridBox.x + c * cellW, gridBox.y + r * cellH, cellW, cellH);
    }
  }
  ctx.restore();
}

function drawBoundaryErrors(ctx, gridBox, dims) {
  const cells = new Set();
  for (const error of appState.boundaryErrors || []) {
    for (const cell of error.cells || []) cells.add(`${cell[0]},${cell[1]}`);
  }
  if (!cells.size) return;
  const cellW = gridBox.cell;
  const cellH = gridBox.cell;
  ctx.save();
  ctx.fillStyle = 'rgba(220,38,38,.66)';
  ctx.strokeStyle = '#991b1b';
  ctx.lineWidth = 2;
  for (const key of cells) {
    const [r, c] = key.split(',').map(Number);
    if (r < 0 || r >= dims.h || c < 0 || c >= dims.w) continue;
    const x = gridBox.x + c * cellW, y = gridBox.y + r * cellH;
    ctx.fillRect(x, y, cellW, cellH);
    ctx.strokeRect(x, y, cellW, cellH);
  }
  ctx.restore();
}

function scheduleBoundaryValidation() {
  if (appState.boundaryDebounceTimer) clearTimeout(appState.boundaryDebounceTimer);
  appState.boundaryDebounceTimer = setTimeout(() => validateBoundaryPreview(false), 500);
}

function validateBoundaryPreview(showStatus) {
  if (appState.boundaryDebounceTimer) {
    clearTimeout(appState.boundaryDebounceTimer);
    appState.boundaryDebounceTimer = null;
  }
  if (!appState.image) return;
  sanitizeBoundaryCells();
  if (!appState.boundaryCells.size) {
    appState.previewMask = null;
    appState.boundaryErrors = [];
    if (showStatus) setStatus('未绘制边界：生成时将默认整板有效。');
    drawPreview();
    return;
  }
  const dims = getGridDims();
  const result = buildMask(appState.boundaryCells, dims.h, dims.w);
  appState.previewMask = result.mask;
  appState.boundaryErrors = result.errors;
  if (result.errors.length) {
    if (showStatus) setError(result.errors[0].message);
  } else if (showStatus) {
    setStatus(`已识别围圈范围：${sumBool(result.mask)} 格有效。绿色为自动填充范围，蓝色为边界。`);
  }
  drawPreview();
}

function sanitizeBoundaryCells() {
  const dims = getGridDims();
  let changed = false;
  for (const key of Array.from(appState.boundaryCells)) {
    const [r, c] = key.split(',').map(Number);
    if (!(r >= 0 && r < dims.h && c >= 0 && c < dims.w)) {
      appState.boundaryCells.delete(key);
      changed = true;
    }
  }
  if (changed) updateBoundaryCount();
}

function paintBoundaryCell(event) {
  if (!appState.image) return;
  const canvas = byId('pd-preview');
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (event.clientX - rect.left) * scaleX;
  const y = (event.clientY - rect.top) * scaleY;
  const dims = getGridDims();
  const gridBox = gridPreviewBox(previewBox(canvas, appState.image), dims);
  if (x < gridBox.x || x >= gridBox.x + gridBox.w || y < gridBox.y || y >= gridBox.y + gridBox.h) return;
  const c = Math.min(dims.w - 1, Math.max(0, Math.floor((x - gridBox.x) / gridBox.cell)));
  const r = Math.min(dims.h - 1, Math.max(0, Math.floor((y - gridBox.y) / gridBox.cell)));
  const key = `${r},${c}`;
  const stroke = appState.paintStroke || (appState.paintStroke = { moved: false, startKey: null, startWasBoundary: false, lastKey: null });
  if (stroke.startKey === null) {
    stroke.startKey = key;
    stroke.startWasBoundary = appState.boundaryCells.has(key);
  }
  if (stroke.lastKey === key) return;
  if (stroke.lastKey !== null && stroke.lastKey !== key) stroke.moved = true;
  stroke.lastKey = key;
  if (appState.eraseMode) appState.boundaryCells.delete(key);
  else appState.boundaryCells.add(key);
  updateBoundaryCount();
  scheduleBoundaryValidation();
  drawPreview();
}

function finishBoundaryStroke() {
  const stroke = appState.paintStroke;
  if (!stroke || appState.eraseMode) return;
  if (!stroke.moved && stroke.startKey && stroke.startWasBoundary) {
    appState.boundaryCells.delete(stroke.startKey);
  }
}

function generatePattern() {
  if (!appState.image) {
    setError('请先上传图片。');
    return;
  }
  const dims = getGridDims();
  const maskResult = buildMask(appState.boundaryCells, dims.h, dims.w);
  if (maskResult.errors.length) {
    appState.mask = null;
    appState.previewMask = maskResult.mask;
    appState.boundaryErrors = maskResult.errors;
    drawPreview();
    setError(maskResult.errors[0].message);
    return;
  }
  const rgbGrid = sampleGridMean(appState.image, dims.h, dims.w);
  const colorOptions = currentColorOptions();
  const quantized = buildColorGrid(rgbGrid, maskResult.mask, colorOptions);
  const colorGrid = quantized.colorGrid;
  appState.palette = { palette_id: colorOptions.mode === 'grayscale' ? 'black_white_gray' : 'p_beads_limited', name: colorOptions.mode === 'grayscale' ? '黑白灰' : `P 系列拼豆色板（最多 ${colorOptions.maxColors} 色）`, colors: quantized.colors };
  appState.paletteByCode = new Map(quantized.colors.map((color) => [color.code, color]));
  const labelResult = labelPerColor(colorGrid, maskResult.mask);
  appState.colorGrid = colorGrid;
  appState.displayLabels = labelResult.displayLabels;
  appState.mask = maskResult.mask;
  appState.previewMask = maskResult.mask;
  appState.boundaryErrors = [];
  appState.blocksPerColor = labelResult.blocksPerColor;
  appState.rows = usageByColor(colorGrid, maskResult.mask, labelResult.blocksPerColor, labelResult.prefixMap);
  appState.focus = 'all';
  refreshOutputs();
  const modeText = colorOptions.mode === 'grayscale' ? '黑白灰 3 色' : `彩色最多 ${colorOptions.maxColors} 色，实际 ${appState.rows.length} 色`;
  setStatus(`生成完成：${dims.w}×${dims.h}，${modeText}，有效拼豆 ${appState.rows.reduce((s, r) => s + r.total_beads, 0)} 颗。`);
}

function sampleGridMean(image, gridH, gridW) {
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const out = Array.from({ length: gridH }, () => Array.from({ length: gridW }, () => [0, 0, 0]));
  for (let r = 0; r < gridH; r++) {
    const y0 = Math.round(r * canvas.height / gridH);
    const y1 = Math.max(y0 + 1, Math.round((r + 1) * canvas.height / gridH));
    for (let c = 0; c < gridW; c++) {
      const x0 = Math.round(c * canvas.width / gridW);
      const x1 = Math.max(x0 + 1, Math.round((c + 1) * canvas.width / gridW));
      let rr = 0, gg = 0, bb = 0, count = 0;
      for (let y = y0; y < Math.min(y1, canvas.height); y++) {
        for (let x = x0; x < Math.min(x1, canvas.width); x++) {
          const i = (y * canvas.width + x) * 4;
          rr += data[i]; gg += data[i + 1]; bb += data[i + 2]; count += 1;
        }
      }
      out[r][c] = [Math.round(rr / count), Math.round(gg / count), Math.round(bb / count)];
    }
  }
  return out;
}

function currentColorOptions() {
  const mode = byId('pd-color-mode')?.value === 'grayscale' ? 'grayscale' : 'color';
  return { mode, maxColors: clamp(Number(byId('pd-max-colors')?.value || 8), 8, 26) };
}

function updateColorModeUi() {
  const options = currentColorOptions();
  const max = byId('pd-max-colors');
  if (max) max.disabled = options.mode === 'grayscale';
}

function buildColorGrid(rgbGrid, mask, options) {
  if (options.mode === 'grayscale') return quantizeToGrayscale(rgbGrid, mask);
  if (appState.sourcePaletteColors.length) return quantizeToBeadPalette(rgbGrid, mask, appState.sourcePaletteColors, options.maxColors);
  return quantizeToDynamicColors(rgbGrid, mask, options.maxColors);
}

function quantizeToGrayscale(rgbGrid, mask) {
  const colors = [
    { code: 'BW_BLACK', name: '黑', hex: '#111111', sort_order: 1, lab: rgbToLab(hexToRgb('#111111')) },
    { code: 'BW_GRAY', name: '灰', hex: '#808080', sort_order: 2, lab: rgbToLab(hexToRgb('#808080')) },
    { code: 'BW_WHITE', name: '白', hex: '#F5F5F5', sort_order: 3, lab: rgbToLab(hexToRgb('#F5F5F5')) },
  ];
  const colorGrid = rgbGrid.map((row, r) => row.map((rgb, c) => {
    if (!mask[r][c]) return '';
    const y = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
    if (y < 85) return 'BW_BLACK';
    if (y > 170) return 'BW_WHITE';
    return 'BW_GRAY';
  }));
  return { colorGrid, colors };
}


function quantizeToBeadPalette(rgbGrid, mask, sourceColors, maxColors) {
  const h = rgbGrid.length, w = rgbGrid[0].length;
  const initialGrid = Array.from({ length: h }, () => Array(w).fill(''));
  const counts = new Map();
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
    if (!mask[r][c]) continue;
    const color = nearestPaletteColor(rgbGrid[r][c], sourceColors);
    initialGrid[r][c] = color.code;
    counts.set(color.code, (counts.get(color.code) || 0) + 1);
  }
  const sourceByCode = new Map(sourceColors.map((color) => [color.code, color]));
  let selectedColors = Array.from(counts.keys()).map((code) => sourceByCode.get(code)).filter(Boolean);
  if (selectedColors.length > maxColors) {
    const entries = selectedColors.map((color) => ({ key: color.code, rgb: hexToRgb(color.hex), count: counts.get(color.code), color }));
    const centers = kMeansPalette(entries, maxColors);
    const selectedCodes = [];
    for (const center of centers) {
      const candidates = entries.slice().sort((a, b) => rgbDistance2(center.rgb, a.rgb) - rgbDistance2(center.rgb, b.rgb));
      const pick = candidates.find((entry) => !selectedCodes.includes(entry.key));
      if (pick) selectedCodes.push(pick.key);
    }
    entries.sort((a, b) => (b.count - a.count) || comparePaletteEntryColor(a, b));
    for (const entry of entries) {
      if (selectedCodes.length >= maxColors) break;
      if (!selectedCodes.includes(entry.key)) selectedCodes.push(entry.key);
    }
    selectedColors = selectedCodes.map((code) => sourceByCode.get(code)).filter(Boolean);
  }
  selectedColors = selectedColors.sort((a, b) => compareColorKeys(colorSortKey(a.hex), colorSortKey(b.hex)) || String(a.code).localeCompare(String(b.code)));

  const colorGrid = Array.from({ length: h }, () => Array(w).fill(''));
  const finalCounts = new Map();
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
    if (!mask[r][c]) continue;
    const color = nearestPaletteColor(rgbGrid[r][c], selectedColors);
    colorGrid[r][c] = color.code;
    finalCounts.set(color.code, (finalCounts.get(color.code) || 0) + 1);
  }
  return { colorGrid, colors: selectedColors.filter((color) => finalCounts.has(color.code)) };
}

function quantizeToDynamicColors(rgbGrid, mask, maxColors) {
  const h = rgbGrid.length, w = rgbGrid[0].length;
  const entriesByKey = new Map();
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
    if (!mask[r][c]) continue;
    const rgb = rgbGrid[r][c].map((v) => clamp(Math.round(v), 0, 255));
    const key = rgb.join(',');
    const item = entriesByKey.get(key) || { key, rgb, count: 0 };
    item.count += 1;
    entriesByKey.set(key, item);
  }
  const entries = Array.from(entriesByKey.values());
  if (!entries.length) return { colorGrid: Array.from({ length: h }, () => Array(w).fill('')), colors: [] };

  let paletteEntries;
  if (entries.length <= maxColors) {
    paletteEntries = entries.slice().sort(comparePaletteEntryColor);
  } else {
    paletteEntries = kMeansPalette(entries, maxColors).sort(comparePaletteEntryColor);
  }
  const colors = paletteEntries.map((entry, i) => ({
    code: `C${String(i + 1).padStart(2, '0')}`,
    name: `颜色 ${i + 1}`,
    hex: rgbToHex(entry.rgb),
    sort_order: i + 1,
    lab: rgbToLab(entry.rgb),
  }));

  const exactMap = entries.length <= maxColors ? new Map(paletteEntries.map((entry, i) => [entry.key, colors[i].code])) : null;
  const colorGrid = Array.from({ length: h }, () => Array(w).fill(''));
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
    if (!mask[r][c]) continue;
    const rgb = rgbGrid[r][c].map((v) => clamp(Math.round(v), 0, 255));
    colorGrid[r][c] = exactMap ? exactMap.get(rgb.join(',')) : nearestColorCode(rgb, colors);
  }
  return { colorGrid, colors };
}

function kMeansPalette(entries, maxColors) {
  const k = Math.min(maxColors, entries.length);
  const centers = chooseInitialCenters(entries, k).map((entry) => entry.rgb.map(Number));
  for (let iter = 0; iter < 10; iter++) {
    const sums = Array.from({ length: k }, () => [0, 0, 0, 0]);
    for (const entry of entries) {
      const idx = nearestCenterIndex(entry.rgb, centers);
      const weight = entry.count;
      sums[idx][0] += entry.rgb[0] * weight;
      sums[idx][1] += entry.rgb[1] * weight;
      sums[idx][2] += entry.rgb[2] * weight;
      sums[idx][3] += weight;
    }
    let changed = false;
    for (let i = 0; i < k; i++) {
      if (!sums[i][3]) continue;
      const next = [sums[i][0] / sums[i][3], sums[i][1] / sums[i][3], sums[i][2] / sums[i][3]];
      if (rgbDistance2(next, centers[i]) > 0.5) changed = true;
      centers[i] = next;
    }
    if (!changed) break;
  }
  const sums = Array.from({ length: k }, () => [0, 0, 0, 0]);
  for (const entry of entries) {
    const idx = nearestCenterIndex(entry.rgb, centers);
    const weight = entry.count;
    sums[idx][0] += entry.rgb[0] * weight;
    sums[idx][1] += entry.rgb[1] * weight;
    sums[idx][2] += entry.rgb[2] * weight;
    sums[idx][3] += weight;
  }
  return sums
    .filter((sum) => sum[3] > 0)
    .map((sum) => ({ rgb: [Math.round(sum[0] / sum[3]), Math.round(sum[1] / sum[3]), Math.round(sum[2] / sum[3])], count: sum[3] }));
}

function chooseInitialCenters(entries, k) {
  const sorted = entries.slice().sort((a, b) => (b.count - a.count) || a.key.localeCompare(b.key));
  const centers = [sorted[0]];
  while (centers.length < k) {
    let best = null, bestScore = -1;
    for (const entry of entries) {
      const nearest = Math.min(...centers.map((center) => rgbDistance2(entry.rgb, center.rgb)));
      const score = nearest * Math.sqrt(entry.count);
      if (score > bestScore) { bestScore = score; best = entry; }
    }
    if (!best || centers.some((center) => center.key === best.key)) break;
    centers.push(best);
  }
  while (centers.length < k) centers.push(sorted[centers.length]);
  return centers;
}


function nearestPaletteColor(rgb, colors) {
  const lab = rgbToLab(rgb);
  let best = colors[0], bestDist = Infinity;
  for (const color of colors) {
    const colorLab = color.lab || rgbToLab(hexToRgb(color.hex));
    const dist = (lab[0] - colorLab[0]) ** 2 + (lab[1] - colorLab[1]) ** 2 + (lab[2] - colorLab[2]) ** 2;
    if (dist < bestDist) { bestDist = dist; best = color; }
  }
  return best;
}

function nearestColorCode(rgb, colors) {
  let best = colors[0], bestDist = Infinity;
  for (const color of colors) {
    const dist = rgbDistance2(rgb, hexToRgb(color.hex));
    if (dist < bestDist) { bestDist = dist; best = color; }
  }
  return best.code;
}

function nearestCenterIndex(rgb, centers) {
  let best = 0, bestDist = Infinity;
  for (let i = 0; i < centers.length; i++) {
    const dist = rgbDistance2(rgb, centers[i]);
    if (dist < bestDist) { bestDist = dist; best = i; }
  }
  return best;
}

function rgbDistance2(a, b) {
  const dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2];
  return dr * dr + dg * dg + db * db;
}

function rgbToHex(rgb) {
  return '#' + rgb.map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0').toUpperCase()).join('');
}

function buildMask(boundarySet, h, w) {
  const boundary = Array.from({ length: h }, () => Array(w).fill(false));
  let boundaryCount = 0;
  for (const key of boundarySet) {
    const [r, c] = key.split(',').map(Number);
    if (r >= 0 && r < h && c >= 0 && c < w && !boundary[r][c]) { boundary[r][c] = true; boundaryCount += 1; }
  }
  if (!boundaryCount) return { mask: Array.from({ length: h }, () => Array(w).fill(true)), errors: [] };
  const mask = fillByExterior(boundary);
  if (sumBool(mask) <= sumBool(boundary)) {
    return { mask, errors: [{ code: 'NO_CLOSED_AREA', message: '还没有形成可识别的封闭范围，请继续补齐边界。' }] };
  }
  return { mask, errors: [] };
}

function fillByExterior(boundary) {
  const h = boundary.length, w = boundary[0].length, ph = h + 2, pw = w + 2;
  const blocked = Array.from({ length: ph }, () => Array(pw).fill(false));
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) blocked[r + 1][c + 1] = boundary[r][c];
  const visited = Array.from({ length: ph }, () => Array(pw).fill(false));
  const q = [[0, 0]];
  visited[0][0] = true;
  for (let qi = 0; qi < q.length; qi++) {
    const [r, c] = q[qi];
    for (const [nr, nc] of [[r + 1, c], [r - 1, c], [r, c + 1], [r, c - 1]]) {
      if (nr >= 0 && nr < ph && nc >= 0 && nc < pw && !visited[nr][nc] && !blocked[nr][nc]) {
        visited[nr][nc] = true;
        q.push([nr, nc]);
      }
    }
  }
  return Array.from({ length: h }, (_, r) => Array.from({ length: w }, (_, c) => !visited[r + 1][c + 1] || boundary[r][c]));
}

function detectNested(boundary) {
  const comps = boundaryComponents(boundary);
  if (comps.length < 2) return [];
  const masks = comps.map((comp) => {
    const b = Array.from({ length: boundary.length }, () => Array(boundary[0].length).fill(false));
    for (const [r, c] of comp) b[r][c] = true;
    return fillByExterior(b);
  });
  const compSets = comps.map((comp) => new Set(comp.map(([r, c]) => `${r},${c}`)));
  const errors = [];
  for (let i = 0; i < comps.length; i++) {
    for (let j = 0; j < comps.length; j++) {
      if (i === j) continue;
      if (componentsTouch(comps[j], compSets[i], boundary.length, boundary[0].length)) continue;
      if (comps[j].every(([r, c]) => masks[i][r][c])) {
        errors.push({ code: 'NESTED_LOOP', message: '检测到圈套圈：当前版本不支持在一个范围内再挖洞。', cells: comps[j] });
      }
    }
  }
  return errors.slice(0, 1);
}

function boundaryComponents(boundary) {
  const h = boundary.length, w = boundary[0].length;
  const seen = Array.from({ length: h }, () => Array(w).fill(false));
  const comps = [];
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
    if (!boundary[r][c] || seen[r][c]) continue;
    const comp = [], q = [[r, c]];
    seen[r][c] = true;
    for (let qi = 0; qi < q.length; qi++) {
      const [cr, cc] = q[qi]; comp.push([cr, cc]);
      for (const [nr, nc] of neighbors8(cr, cc, h, w)) if (boundary[nr][nc] && !seen[nr][nc]) { seen[nr][nc] = true; q.push([nr, nc]); }
    }
    comps.push(comp);
  }
  return comps;
}

function componentsTouch(comp, otherSet, h, w) {
  for (const [r, c] of comp) {
    if (otherSet.has(`${r},${c}`)) return true;
    for (const [nr, nc] of neighbors8(r, c, h, w)) if (otherSet.has(`${nr},${nc}`)) return true;
  }
  return false;
}

function labelPerColor(colorGrid, mask) {
  const h = colorGrid.length, w = colorGrid[0].length;
  const counts = new Map();
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) if (mask[r][c] && colorGrid[r][c]) counts.set(colorGrid[r][c], (counts.get(colorGrid[r][c]) || 0) + 1);
  const codes = Array.from(counts.keys());
  const prefixMap = buildPrefixMap(codes, counts);
  const displayLabels = Array.from({ length: h }, () => Array(w).fill(''));
  const blocksPerColor = new Map();
  for (const code of codes.sort((a, b) => prefixMap.get(a).localeCompare(prefixMap.get(b)))) {
    const raw = connectedComponents(colorGrid, mask, code);
    const metas = [];
    for (let rawId = 1; rawId <= raw.maxId; rawId++) {
      const cells = [];
      for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) if (raw.labels[r][c] === rawId) cells.push([r, c]);
      if (!cells.length) continue;
      cells.sort((a, b) => (a[0] - b[0]) || (a[1] - b[1]));
      metas.push({ rawId, cells, count: cells.length, min_r: cells[0][0], min_c: cells[0][1] });
    }
    metas.sort((a, b) => (a.min_r - b.min_r) || (a.min_c - b.min_c));
    const blocks = [];
    let serial = 1;
    metas.forEach((meta, index) => {
      const startId = serial;
      for (const [r, c] of meta.cells) {
        displayLabels[r][c] = `${prefixMap.get(code)}${serial}`;
        serial += 1;
      }
      const endId = serial - 1;
      const prefix = prefixMap.get(code);
      const label = startId === endId ? `${prefix}${startId}` : `${prefix}${startId}-${prefix}${endId}`;
      blocks.push({ id: index + 1, label, code, prefix, count: meta.count, min_r: meta.min_r, min_c: meta.min_c, start_id: startId, end_id: endId });
    });
    blocksPerColor.set(code, blocks);
  }
  return { displayLabels, blocksPerColor, prefixMap };
}

function connectedComponents(colorGrid, mask, code) {
  const h = colorGrid.length, w = colorGrid[0].length;
  const labels = Array.from({ length: h }, () => Array(w).fill(0));
  let current = 0;
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
    if (!mask[r][c] || colorGrid[r][c] !== code || labels[r][c]) continue;
    current += 1;
    const q = [[r, c]];
    labels[r][c] = current;
    for (let qi = 0; qi < q.length; qi++) {
      const [cr, cc] = q[qi];
      for (const [nr, nc] of neighbors8(cr, cc, h, w)) {
        if (mask[nr][nc] && colorGrid[nr][nc] === code && !labels[nr][nc]) { labels[nr][nc] = current; q.push([nr, nc]); }
      }
    }
  }
  return { labels, maxId: current };
}

function usageByColor(colorGrid, mask, blocksPerColor, prefixMap) {
  return Array.from(blocksPerColor.keys()).sort((a, b) => prefixMap.get(a).localeCompare(prefixMap.get(b))).map((code) => {
    const color = appState.paletteByCode.get(code) || { code, name: code, hex: '#FFFFFF' };
    let total = 0;
    for (let r = 0; r < colorGrid.length; r++) for (let c = 0; c < colorGrid[0].length; c++) if (mask[r][c] && colorGrid[r][c] === code) total++;
    return { prefix: prefixMap.get(code), code, name: color.name, hex: color.hex, total_beads: total, block_count: blocksPerColor.get(code).length };
  });
}

function refreshOutputs() {
  const hasPattern = Boolean(appState.colorGrid && appState.displayLabels && appState.mask);
  byId('pd-download-svg').disabled = !hasPattern;
  byId('pd-download-png').disabled = !hasPattern;
  byId('pd-download-csv').disabled = !hasPattern;
  byId('pd-print-pdf').disabled = !hasPattern;
  byId('pd-download-project').disabled = !hasPattern;
  updateEditColorSelect(hasPattern);
  if (!hasPattern) return;
  const focus = byId('pd-focus');
  const previous = appState.focus;
  focus.innerHTML = '<option value="all">全部颜色</option>' + appState.rows.map((row) => `<option value="${escapeAttr(row.code)}">${escapeHtml(row.prefix)} · ${escapeHtml(row.code)} ${escapeHtml(row.name)}</option>`).join('');
  focus.value = previous;
  appState.focus = focus.value || 'all';
  byId('pd-svg-preview').innerHTML = renderCurrentSvg();
  bindSvgEditEvents();
  renderUsageTable();
}

function updateEditColorSelect(hasPattern) {
  const edit = byId('pd-edit-color');
  if (!edit) return;
  edit.disabled = !hasPattern;
  if (!hasPattern) {
    edit.innerHTML = '<option value="">修色关闭</option>';
    appState.editColor = '';
    return;
  }
  const usedCodes = new Set(appState.rows.map((row) => row.code));
  const usedColors = appState.rows.map((row) => appState.paletteByCode.get(row.code) || row);
  const canUseSourcePalette = appState.palette?.palette_id !== 'black_white_gray' && appState.sourcePaletteColors.length;
  const extraColors = canUseSourcePalette
    ? appState.sourcePaletteColors.filter((color) => !usedCodes.has(color.code))
    : [];
  edit.innerHTML = '<option value="">修色关闭</option>'
    + `<optgroup label="当前已用颜色">${usedColors.map(colorOptionHtml).join('')}</optgroup>`
    + (extraColors.length ? `<optgroup label="全部 P 色号">${extraColors.map(colorOptionHtml).join('')}</optgroup>` : '');
  if (appState.editColor && (usedCodes.has(appState.editColor) || extraColors.some((color) => color.code === appState.editColor))) {
    edit.value = appState.editColor;
  } else {
    appState.editColor = '';
    edit.value = '';
  }
}

function colorOptionHtml(color) {
  const code = color.code || '';
  const name = color.name || color.name_cn || code;
  const hex = color.hex || '';
  return `<option value="${escapeAttr(code)}">${escapeHtml(code)} · ${escapeHtml(name)} ${escapeHtml(hex)}</option>`;
}

function bindSvgEditEvents() {
  const svg = byId('pd-svg-preview')?.querySelector('svg');
  if (!svg) return;
  svg.style.cursor = appState.editColor ? 'crosshair' : '';
  svg.addEventListener('click', handleSvgEditClick);
}

function handleSvgEditClick(event) {
  if (!appState.editColor || !appState.colorGrid || !appState.mask) return;
  const svg = event.currentTarget;
  const rect = svg.getBoundingClientRect();
  const viewBox = svg.viewBox.baseVal;
  const viewW = viewBox && viewBox.width ? viewBox.width : Number(svg.getAttribute('width'));
  const viewH = viewBox && viewBox.height ? viewBox.height : Number(svg.getAttribute('height'));
  const x = (event.clientX - rect.left) / rect.width * viewW;
  const y = (event.clientY - rect.top) / rect.height * viewH;
  const h = appState.colorGrid.length, w = appState.colorGrid[0].length;
  const cell = viewW / w;
  if (y < 0 || y >= h * cell || x < 0 || x >= w * cell) return;
  const r = Math.floor(y / cell);
  const c = Math.floor(x / cell);
  applyManualColor(r, c, appState.editColor);
}

function applyManualColor(r, c, code) {
  if (!appState.mask?.[r]?.[c]) return;
  if (!code || appState.colorGrid[r][c] === code) return;
  const color = appState.paletteByCode.get(code) || appState.sourcePaletteByCode.get(code);
  if (!color) return;
  appState.paletteByCode.set(code, color);
  if (appState.palette && !appState.palette.colors.some((item) => item.code === code)) appState.palette.colors = [...appState.palette.colors, color];
  appState.colorGrid[r][c] = code;
  relabelCurrentPattern();
  setStatus(`已修色：第 ${r + 1} 行、第 ${c + 1} 列改为 ${code} ${color.name || ''}，编号和数量已自动重算。`);
}

function relabelCurrentPattern() {
  const labelResult = labelPerColor(appState.colorGrid, appState.mask);
  appState.displayLabels = labelResult.displayLabels;
  appState.blocksPerColor = labelResult.blocksPerColor;
  appState.rows = usageByColor(appState.colorGrid, appState.mask, labelResult.blocksPerColor, labelResult.prefixMap);
  if (appState.focus !== 'all' && !appState.rows.some((row) => row.code === appState.focus)) appState.focus = 'all';
  refreshOutputs();
}

function renderUsageTable() {
  byId('pd-usage').innerHTML = `
    <table class="pd-table">
      <thead><tr><th>前缀</th><th>颜色</th><th>色号</th><th>名称</th><th>颗数</th><th>块数</th></tr></thead>
      <tbody>${appState.rows.map((row) => `
        <tr><td><strong>${escapeHtml(row.prefix)}</strong></td><td><span class="pd-swatch" style="background:${escapeAttr(row.hex)}"></span>${escapeHtml(row.hex)}</td><td>${escapeHtml(row.code)}</td><td>${escapeHtml(row.name)}</td><td>${row.total_beads}</td><td>${row.block_count}</td></tr>
      `).join('')}</tbody>
    </table>`;
}

function renderCurrentSvg() {
  return renderSvg(appState.colorGrid, appState.displayLabels, appState.mask, appState.rows, appState.focus);
}

function renderSvg(colorGrid, displayLabels, mask, rows, focus = 'all') {
  const h = colorGrid.length, w = colorGrid[0].length;
  const cell = Number(byId('pd-svg-cell')?.value || 24);
  const legendH = rows.length ? 26 * (rows.length + 1) : 0;
  const width = w * cell;
  const height = h * cell + legendH;
  const fontSize = Math.max(5, Math.floor(cell * 0.28));
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Pingdou 拼豆图纸">`, '<rect width="100%" height="100%" fill="#ffffff"/>'];
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
    if (!mask[r][c]) continue;
    const code = colorGrid[r][c];
    const color = appState.paletteByCode.get(code) || { hex: '#FFFFFF' };
    const active = focus === 'all' || focus === code;
    const fill = active ? color.hex : '#F1F5F9';
    const opacity = active ? '1' : '0.38';
    const x = c * cell, y = r * cell;
    parts.push(`<rect x="${x}" y="${y}" width="${cell}" height="${cell}" fill="${escapeAttr(fill)}" opacity="${opacity}"/>`);
    const label = active ? displayLabels[r][c] : '';
    if (label) {
      parts.push(`<text x="${(x + cell / 2).toFixed(2)}" y="${(y + cell / 2).toFixed(2)}" text-anchor="middle" dominant-baseline="central" font-family="Arial, sans-serif" font-size="${fontSize}" fill="${readableTextColor(fill)}">${escapeHtml(label)}</text>`);
    }
  }
  parts.push(gridPath(w, h, cell));
  if (rows.length) {
    const y0 = h * cell + 20;
    parts.push(`<text x="0" y="${y0}" font-size="14" font-family="Arial" font-weight="700">颜色图例</text>`);
    rows.forEach((row, i) => {
      const y = y0 + 24 * (i + 1);
      const dim = focus !== 'all' && focus !== row.code;
      parts.push(`<rect x="0" y="${y - 14}" width="14" height="14" fill="${escapeAttr(row.hex)}" stroke="#999" opacity="${dim ? '0.35' : '1'}"/>`);
      parts.push(`<text x="20" y="${y}" font-size="12" font-family="Arial" fill="${dim ? '#94A3B8' : '#303030'}">${escapeHtml(`${row.prefix} = ${row.code} / ${row.name} / ${row.total_beads}颗 / ${row.block_count}块`)}</text>`);
    });
  }
  parts.push('</svg>');
  return parts.join('\n');
}

function gridPath(w, h, cell) {
  const cmds = [];
  for (let x = 0; x <= w; x++) cmds.push(`M ${x * cell} 0 V ${h * cell}`);
  for (let y = 0; y <= h; y++) cmds.push(`M 0 ${y * cell} H ${w * cell}`);
  return `<path d="${cmds.join(' ')}" stroke="#CBD5E1" stroke-width="0.5" fill="none"/>`;
}

function buildCsv() {
  const lines = [['# colors'], ['prefix','code','name','hex','total_beads','block_count']];
  for (const row of appState.rows) lines.push([row.prefix, row.code, row.name, row.hex, row.total_beads, row.block_count]);
  lines.push([], ['# blocks'], ['label','prefix','code','count','min_r','min_c']);
  for (const [code, blocks] of appState.blocksPerColor.entries()) for (const block of blocks) lines.push([block.label, block.prefix, code, block.count, block.min_r, block.min_c]);
  return lines.map((line) => line.map(csvCell).join(',')).join('\n');
}

function downloadPng() {
  const svg = renderCurrentSvg();
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth * 2;
    canvas.height = img.naturalHeight * 2;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((pngBlob) => {
      URL.revokeObjectURL(url);
      if (pngBlob) downloadBlob('pingdou.png', pngBlob);
    }, 'image/png');
  };
  img.onerror = () => { URL.revokeObjectURL(url); setError('PNG 生成失败，请先下载 SVG。'); };
  img.src = url;
}

function openPrintPage() {
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>Pingdou 图纸</title><style>@page{size:auto;margin:10mm}body{margin:0;font-family:Arial,sans-serif}svg{max-width:100%;height:auto}</style></head><body>${renderCurrentSvg()}<script>setTimeout(()=>print(),300)<\/script></body></html>`;
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener,noreferrer');
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function downloadProject() {
  const data = {
    version: 7,
    grid: getGridDims(),
    focus: appState.focus,
    color_mode: currentColorOptions().mode,
    max_colors: currentColorOptions().maxColors,
    palette_id: appState.palette?.palette_id || '',
    palette: appState.palette?.colors || [],
    boundary_cells: Array.from(appState.boundaryCells).map((key) => key.split(',').map(Number)),
    color_grid: appState.colorGrid,
    display_labels: appState.displayLabels,
    mask: appState.mask,
    rows: appState.rows,
    blocks: Array.from(appState.blocksPerColor.entries()).flatMap(([code, blocks]) => blocks.map((block) => ({ ...block, code }))),
  };
  downloadText('pingdou-project.json', JSON.stringify(data, null, 2), 'application/json;charset=utf-8');
}

function previewBox(canvas, img) {
  const margin = 18;
  const maxW = canvas.width - margin * 2, maxH = canvas.height - margin * 2;
  const scale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight);
  const w = img.naturalWidth * scale, h = img.naturalHeight * scale;
  return { x: (canvas.width - w) / 2, y: (canvas.height - h) / 2, w, h };
}

function gridPreviewBox(box, dims) {
  const cell = Math.max(1, Math.min(box.w / dims.w, box.h / dims.h));
  const w = dims.w * cell;
  const h = dims.h * cell;
  return { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, w, h, cell };
}

function handleGridDimChange(changed) {
  syncGridToImageAspect(changed);
  sanitizeBoundaryCells();
  validateBoundaryPreview(false);
  updateBoundaryCount();
  drawPreview();
}

function syncGridToImageAspect(changed = 'w') {
  if (!appState.image || appState.syncingGrid) return;
  appState.syncingGrid = true;
  const wInput = byId('pd-grid-w');
  const hInput = byId('pd-grid-h');
  const aspect = appState.image.naturalWidth / appState.image.naturalHeight;
  let w = clamp(Number(wInput.value || 32), 4, 200);
  let h = clamp(Number(hInput.value || 32), 4, 200);
  if (changed === 'h') {
    w = clamp(Math.round(h * aspect), 4, 200);
    h = clamp(Math.round(w / aspect), 4, 200);
  } else {
    h = clamp(Math.round(w / aspect), 4, 200);
    w = clamp(Math.round(h * aspect), 4, 200);
  }
  wInput.value = String(w);
  hInput.value = String(h);
  appState.syncingGrid = false;
}

function getGridDims() {
  return { w: clamp(Number(byId('pd-grid-w').value || 32), 4, 200), h: clamp(Number(byId('pd-grid-h').value || 32), 4, 200) };
}

function buildPrefixMap(codes, counts) {
  // 黑白灰按深到浅：黑 a、灰 b、白 c。
  const fixed = new Map([['BW_BLACK', 'a'], ['BW_GRAY', 'b'], ['BW_WHITE', 'c']]);
  const result = new Map();
  for (const code of codes) if (fixed.has(code)) result.set(code, fixed.get(code));
  const dynamicCodes = codes.filter((code) => !fixed.has(code));
  const offset = result.size;
  dynamicCodes
    .sort((a, b) => compareColorCodes(a, b, counts))
    .forEach((code, i) => result.set(code, indexToLetters(offset + i)));
  return result;
}

function compareColorCodes(a, b, counts = new Map()) {
  const ca = appState.paletteByCode.get(a);
  const cb = appState.paletteByCode.get(b);
  if (ca?.hex && cb?.hex) return compareColorKeys(colorSortKey(ca.hex), colorSortKey(cb.hex)) || String(a).localeCompare(String(b));
  return ((counts.get(b) || 0) - (counts.get(a) || 0)) || String(a).localeCompare(String(b));
}

function comparePaletteEntryColor(a, b) {
  return compareColorKeys(colorSortKey(rgbToHex(a.rgb)), colorSortKey(rgbToHex(b.rgb))) || rgbToHex(a.rgb).localeCompare(rgbToHex(b.rgb));
}

function compareColorKeys(a, b) {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] < b[i]) return -1;
    if (a[i] > b[i]) return 1;
  }
  return a.length - b.length;
}

function colorSortKey(hex) {
  const [r, g, b] = hexToRgb(hex);
  const [h, s, l] = rgbToHsl(r, g, b);
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  if (s < 0.12) return [0, 0, luminance, 1 - s];
  const hueBucket = Math.floor(((h + 15) % 360) / 30);
  return [1, hueBucket, luminance, h];
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  const d = max - min;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0));
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return [h, s, l];
}

function indexToLetters(index) {
  let n = index, out = '';
  do { out = ALPHABET[n % 26] + out; n = Math.floor(n / 26) - 1; } while (n >= 0);
  return out;
}

function neighbors8(r, c, h, w) {
  const out = [];
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (dr || dc) {
    const nr = r + dr, nc = c + dc;
    if (nr >= 0 && nr < h && nc >= 0 && nc < w) out.push([nr, nc]);
  }
  return out;
}

function rgbToLab(rgb) {
  let [r, g, b] = rgb.map((v) => Number(v) / 255);
  [r, g, b] = [r, g, b].map((v) => v > 0.04045 ? ((v + 0.055) / 1.055) ** 2.4 : v / 12.92);
  let x = r * 0.4124564 + g * 0.3575761 + b * 0.1804375;
  let y = r * 0.2126729 + g * 0.7151522 + b * 0.0721750;
  let z = r * 0.0193339 + g * 0.1191920 + b * 0.9503041;
  x /= 0.95047; y /= 1.00000; z /= 1.08883;
  const f = (v) => v > 216 / 24389 ? Math.cbrt(v) : ((24389 / 27) * v + 16) / 116;
  const fx = f(x), fy = f(y), fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function hexToRgb(hex) {
  const value = String(hex).trim().replace(/^#/, '');
  return [parseInt(value.slice(0, 2), 16), parseInt(value.slice(2, 4), 16), parseInt(value.slice(4, 6), 16)];
}

function readableTextColor(hex) {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 128 ? '#E0E0E0' : '#303030';
}

function sumBool(grid) { return grid.reduce((s, row) => s + row.filter(Boolean).length, 0); }
function clamp(value, min, max) { return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min)); }
function byId(id) { return document.getElementById(id); }
function updateBoundaryCount() {
  const dims = getGridDims();
  let valid = 0;
  for (const key of appState.boundaryCells) {
    const [r, c] = key.split(',').map(Number);
    if (r >= 0 && r < dims.h && c >= 0 && c < dims.w) valid += 1;
  }
  byId('pd-boundary-count').textContent = `边界 ${valid} 格`;
}
function setStatus(text) { const el = byId('pd-status'); el.textContent = text; el.classList.remove('pd-error'); }
function setError(text) { const el = byId('pd-status'); el.textContent = text; el.classList.add('pd-error'); }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])); }
function escapeAttr(value) { return escapeHtml(value); }
function csvCell(value) { const text = String(value ?? ''); return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; }
function downloadText(filename, text, type) { downloadBlob(filename, new Blob([text], { type })); }
function downloadBlob(filename, blob) { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
