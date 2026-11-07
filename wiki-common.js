'use strict';
// Shared helpers for the Woodlands wiki pages: data loading, formatting and the map renderer.
const W = {};
W.$ = id => document.getElementById(id);
W.esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
W.fmt = n => n == null || n === '' ? '—' : Number(n).toLocaleString();
W.pct = p => p == null ? '—' : (p >= 1 ? '100%' : (Math.round(p * 1000) / 10) + '%');
W.load = () => fetch('./data/wiki.json', { cache: 'no-cache' }).then(r => { if (!r.ok) throw Error('HTTP ' + r.status); return r.json(); });
W.hash = () => Object.fromEntries(new URLSearchParams(location.hash.slice(1)));
W.setHash = obj => history.replaceState(null, '', '#' + new URLSearchParams(Object.entries(obj).filter(([, v]) => v != null && v !== '')).toString());

// ---------- map renderer ----------
// inked-parchment palette
W.MAPSTYLE = {
  bank: ['#2f7d46', 'square', 'Bank'], shop: ['#2c5f9e', 'square', 'Shop'], npc: ['#5b4a38', 'dot', 'NPC'], station: ['#c0601a', 'triangle', 'Station'],
  mob: ['#b02a20', 'dot', 'Monster spawn'], boss: ['#6a2696', 'star', 'Boss'], portal: ['#127a72', 'ring', 'Dungeon entrance'], altar: ['#9a7d12', 'diamond', 'Shrine / altar'],
  stall: ['#8a5626', 'square', 'Stall'], farm: ['#4c8526', 'diamond', 'Farm patch'], hunt: ['#7a5424', 'diamond', 'Trapping grounds'], course: ['#2a7398', 'diamond', 'Wayfaring course'],
  poi: ['#2a1d10', 'ring', 'Point of interest'],
};
// map layers: what each toggle chip shows
W.LAYERS = [
  { id: 'places', name: 'Towns & people', col: '#2c5f9e', kinds: ['npc', 'shop', 'bank', 'station', 'stall', 'altar', 'poi', 'farm', 'hunt', 'course'] },
  { id: 'portal', name: 'Dungeon entrances', col: '#127a72', kinds: ['portal'] },
  { id: 'mob', name: 'Monster spawns', col: '#b02a20', kinds: ['mob'] },
  { id: 'boss', name: 'Bosses', col: '#6a2696', kinds: ['boss'] },
  { id: 'tree', name: 'Trees', col: '#3f6b2a', res: 'tree' },
  { id: 'ore', name: 'Rocks & ores', col: '#7a6a58', res: 'ore' },
  { id: 'plant', name: 'Herbs & plants', col: '#8c3f8a', res: 'plant' },
  { id: 'fish', name: 'Fishing spots', col: '#2a6f9e', spots: true },
];
W.resCat = t => t.skill === 'Lumbering' ? 'tree' : t.skill === 'Mining' ? 'ore' : 'plant';
W.INK = '#2a1d10';
W.compass = (g, x, y, r) => {   // a small inked compass rose
  g.save(); g.translate(x, y);
  g.strokeStyle = W.INK; g.fillStyle = '#f1e4c4'; g.lineWidth = 1.2; g.beginPath(); g.arc(0, 0, r, 0, 7); g.fill(); g.stroke(); g.beginPath(); g.arc(0, 0, r * 0.82, 0, 7); g.stroke();
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, l = i % 2 ? r * 0.55 : r * 0.95; g.save(); g.rotate(a); g.beginPath(); g.moveTo(0, -l); g.lineTo(r * 0.13, 0); g.lineTo(0, r * 0.13); g.lineTo(-r * 0.13, 0); g.closePath(); g.fillStyle = i === 0 ? '#9b2f2a' : i % 2 ? '#8a7350' : W.INK; g.fill(); g.restore(); }
  g.fillStyle = W.INK; g.font = `bold ${Math.round(r * 0.42)}px Cinzel,Georgia,serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('N', 0, -r - r * 0.32);
  g.restore();
};

// ---------- terrain: shaded relief, inked coastlines and contour lines from the height maps ----------
const lerpHex = (stops, t) => {
  t = Math.max(0, Math.min(1, t)); let k = 0; while (k < stops.length - 2 && t > stops[k + 1][0]) k++;
  const [t0, c0] = stops[k], [t1, c1] = stops[k + 1], f = (t - t0) / ((t1 - t0) || 1);
  return [0, 1, 2].map(i => c0[i] + (c1[i] - c0[i]) * f);
};
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const LAND = [[0, hex('#dfe1b4')], [0.18, hex('#e6ddb2')], [0.45, hex('#dccb98')], [0.7, hex('#c7ad7c')], [0.88, hex('#ad9067')], [1, hex('#f2ece0')]];
const SEA = [[0, hex('#cfdccf')], [0.35, hex('#bccbc2')], [1, hex('#a9bbb4')]];
W.SEA_DEEP = '#a9bbb4';
// marching squares: line segments where the height grid crosses `level` (flat array of x,z pairs in world units)
function contour(hs, w, h, level, x0, z0, step) {
  const out = [];
  for (let j = 0; j < h - 1; j++) for (let i = 0; i < w - 1; i++) {
    const a = hs[j * w + i], b = hs[j * w + i + 1], c = hs[(j + 1) * w + i + 1], d = hs[(j + 1) * w + i];
    const idx = (a > level) << 3 | (b > level) << 2 | (c > level) << 1 | (d > level);
    if (idx === 0 || idx === 15) continue;
    const X = x0 + i * step, Z = z0 + j * step, f = (p, q) => (level - p) / ((q - p) || 1e-9);
    const T = () => [X + f(a, b) * step, Z], R = () => [X + step, Z + f(b, c) * step], B = () => [X + f(d, c) * step, Z + step], L = () => [X, Z + f(a, d) * step];
    const seg = (p, q) => out.push(p[0], p[1], q[0], q[1]);
    switch (idx) {
      case 1: case 14: seg(L(), B()); break; case 2: case 13: seg(B(), R()); break; case 3: case 12: seg(L(), R()); break;
      case 4: case 11: seg(T(), R()); break; case 6: case 9: seg(T(), B()); break; case 7: case 8: seg(T(), L()); break;
      case 5: case 10: seg(T(), R()); seg(L(), B()); break;
    }
  }
  return new Float32Array(out);
}
const loadImg = src => new Promise((ok, no) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => no(Error('could not load ' + src)); im.src = src; });
const pixels = im => { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0); return g.getImageData(0, 0, im.width, im.height).data; };
W.prepTerrain = M => {
  if (M._terrain) return M._terrain;
  return M._terrain = Promise.all(Object.entries(M.terrain || {}).map(async ([id, t]) => {
    const px = pixels(await loadImg(t.img)), n = t.w * t.h, hs = new Float32Array(n), span = t.max - t.min;
    for (let k = 0; k < n; k++) hs[k] = t.min + px[k * 4] / 255 * span;
    // colour + hillshade (light from the north-west)
    const cv = document.createElement('canvas'); cv.width = t.w; cv.height = t.h;
    const g = cv.getContext('2d'), img = g.createImageData(t.w, t.h), wy = t.water, top = Math.max(t.max, wy + 1);
    for (let j = 0; j < t.h; j++) for (let i = 0; i < t.w; i++) {
      const k = j * t.w + i, v = hs[k];
      const dx = (hs[j * t.w + Math.min(t.w - 1, i + 1)] - hs[j * t.w + Math.max(0, i - 1)]) / (2 * t.step), dz = (hs[Math.min(t.h - 1, j + 1) * t.w + i] - hs[Math.max(0, j - 1) * t.w + i]) / (2 * t.step);
      let col;
      if (v <= wy) col = lerpHex(SEA, (wy - v) / 4);
      else { const shade = Math.max(0.72, Math.min(1.18, 1 + (-dx - dz) * 0.9)); col = lerpHex(LAND, (v - wy) / (top - wy)).map(c => c * shade); }
      img.data[k * 4] = col[0]; img.data[k * 4 + 1] = col[1]; img.data[k * 4 + 2] = col[2]; img.data[k * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const range = top - wy, every = [1, 2, 3, 4, 5, 8, 10].find(s => range / s <= 7) || 15, levels = [];
    for (let L = wy + every; L < t.max; L += every) levels.push(contour(hs, t.w, t.h, L, t.x0, t.z0, t.step));
    const out = { id, t, canvas: cv, coast: contour(hs, t.w, t.h, wy, t.x0, t.z0, t.step), ripples: [0.6, 1.5].map(d => contour(hs, t.w, t.h, wy - d, t.x0, t.z0, t.step)), levels };
    if (t.wild) {   // wilderness mask as a soft alpha image
      const wp = pixels(await loadImg(t.wild.img)), wc = document.createElement('canvas'); wc.width = t.wild.w; wc.height = t.wild.h;
      const wg = wc.getContext('2d'), wi = wg.createImageData(t.wild.w, t.wild.h);
      const hAt = (x, z) => { const i = Math.round((x - t.x0) / t.step), j = Math.round((z - t.z0) / t.step); return i < 0 || j < 0 || i >= t.w || j >= t.h ? -1e9 : hs[j * t.w + i]; };
      for (let j = 0; j < t.wild.h; j++) for (let i = 0; i < t.wild.w; i++) {   // only where it's wild AND land
        const k = j * t.wild.w + i; wi.data[k * 4] = 155; wi.data[k * 4 + 1] = 47; wi.data[k * 4 + 2] = 42;
        wi.data[k * 4 + 3] = wp[k * 4] && hAt(t.x0 + i * t.wild.step, t.z0 + j * t.wild.step) > wy ? 255 : 0;
      }
      wg.putImageData(wi, 0, 0); out.wild = wc;
    }
    return out;
  })).catch(e => { console.warn('[map] terrain unavailable:', e); return []; });
};

// view: {x0,x1,z0,z1} in world units, or {cave} for a dungeon.
// opt: { mobName, terrain (from prepTerrain), layers:Set of layer ids, focus:{res|spot:index}, size:{w,h} }
// Returns a hover lookup (mx,my) -> {x,z,text} and records the projection on cv._proj.
W.drawMap = (cv, M, view, opt = {}) => {
  const cssW = (opt.size && opt.size.w) || cv.parentElement.clientWidth || 900, dpr = Math.min(2, window.devicePixelRatio || 1);
  const cave = view.cave;
  const b = cave ? { x0: cave.ox - 4, x1: cave.ox + cave.W * 4 + 4, z0: cave.oz - 4, z1: cave.oz + cave.H * 4 + 4 } : view;
  const ww = b.x1 - b.x0, wh = b.z1 - b.z0, cssH = (opt.size && opt.size.h) || Math.min(cssW * wh / ww, opt.maxH || 900);
  const scale = Math.min(cssW / ww, cssH / wh);
  const cw = Math.round(ww * scale * dpr), ch = Math.round(wh * scale * dpr);
  if (cv.width !== cw || cv.height !== ch) { cv.width = cw; cv.height = ch; }
  cv.style.height = (wh * scale) + 'px'; cv.style.width = (ww * scale) + 'px';
  cv._proj = { b, scale };
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const X = x => (x - b.x0) * scale, Z = z => (z - b.z0) * scale, S = v => v * scale;
  const zoomed = ww < 320;
  const PW = ww * scale, PH = wh * scale;
  const inView = (x, z, pad = 0) => x >= b.x0 - pad && x <= b.x1 + pad && z >= b.z0 - pad && z <= b.z1 + pad;
  const stains = edge => {   // aged-parchment stains and a dark vignette, laid over everything
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 14; i++) { const x = rnd() * PW, y = rnd() * PH, r = 40 + rnd() * Math.max(PW, PH) * 0.25, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(120,85,40,0.07)'); gr.addColorStop(1, 'rgba(120,85,40,0)'); g.fillStyle = gr; g.fillRect(0, 0, PW, PH); }
    const v = g.createRadialGradient(PW / 2, PH / 2, Math.min(PW, PH) * 0.35, PW / 2, PH / 2, Math.max(PW, PH) * 0.75); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, edge); g.fillStyle = v; g.fillRect(0, 0, PW, PH);
  };
  const rect = (x, z, w, d, rot, fill, stroke, lw = 1) => { g.save(); g.translate(X(x), Z(z)); g.rotate(-rot); g.fillStyle = fill; g.fillRect(-S(w) / 2, -S(d) / 2, S(w), S(d)); if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.strokeRect(-S(w) / 2, -S(d) / 2, S(w), S(d)); } g.restore(); };
  const hatch = (x, y, w, h, color, gap = 6) => { g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); g.strokeStyle = color; g.lineWidth = 1; g.beginPath(); for (let k = -h; k < w; k += gap) { g.moveTo(x + k, y + h); g.lineTo(x + k + h, y); } g.stroke(); g.restore(); };
  if (cave) {
    g.fillStyle = '#e3d3ac'; g.fillRect(0, 0, PW, PH);
    const t = 4 * scale, ox = X(cave.ox), oy = Z(cave.oz);
    cave.grid.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] === '#') { g.fillStyle = '#5a4630'; g.fillRect(ox + i * t, oy + j * t, t + .5, t + .5); } });
    cave.grid.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] === '#') hatch(ox + i * t, oy + j * t, t + .5, t + .5, 'rgba(30,20,10,0.55)', 4); });
    g.strokeStyle = W.INK; g.lineWidth = 2;   // ink outline along wall edges
    cave.grid.forEach((row, j) => { for (let i = 0; i < row.length; i++) { if (row[i] === '#') continue; const wall = (a, b) => (cave.grid[b] || '')[a] === '#'; const x = ox + i * t, y = oy + j * t; g.beginPath(); if (wall(i, j - 1)) { g.moveTo(x, y); g.lineTo(x + t, y); } if (wall(i, j + 1)) { g.moveTo(x, y + t); g.lineTo(x + t, y + t); } if (wall(i - 1, j)) { g.moveTo(x, y); g.lineTo(x, y + t); } if (wall(i + 1, j)) { g.moveTo(x + t, y); g.lineTo(x + t, y + t); } g.stroke(); } });
    stains('rgba(70,45,15,0.45)');
    g.textAlign = 'center'; g.textBaseline = 'middle';
    cave.rooms.forEach(ro => {
      if (!ro.r) return; const [rx, ry, rw, rh] = ro.r, cx = ox + (rx + rw / 2) * t, cy = oy + (ry + rh / 2) * t;
      if (ro.exit) { g.strokeStyle = '#127a72'; g.lineWidth = 2.5; g.setLineDash([6, 4]); g.strokeRect(ox + rx * t + 3, oy + ry * t + 3, rw * t - 6, rh * t - 6); g.setLineDash([]); }
      const lines = ro.exit ? ['⇧ Exit'] : Object.entries(ro.mobs || {}).map(([m, n]) => `${n}× ${(opt.mobName && opt.mobName(m)) || m}`);
      g.font = 'bold 13px Cinzel,Georgia,serif';
      lines.forEach((l, k) => { const y = cy + (k - (lines.length - 1) / 2) * 16; g.lineWidth = 4; g.strokeStyle = 'rgba(240,228,196,0.9)'; g.strokeText(l, cx, y); g.fillStyle = ro.exit ? '#127a72' : '#8f1f17'; g.fillText(l, cx, y); });
    });
    W.compass(g, PW - 36, 42, 22);
    return () => null;
  }
  const ters = (opt.terrain || []).filter(T => T.t.x0 <= b.x1 && T.t.x0 + T.t.w * T.t.step >= b.x0 && T.t.z0 <= b.z1 && T.t.z0 + T.t.h * T.t.step >= b.z0);
  const segs = (arr, style, lw, dash) => { if (!arr.length) return; g.beginPath(); for (let k = 0; k < arr.length; k += 4) { if (!inView(arr[k], arr[k + 1], 4)) continue; g.moveTo(X(arr[k]), Z(arr[k + 1])); g.lineTo(X(arr[k + 2]), Z(arr[k + 3])); } g.strokeStyle = style; g.lineWidth = lw; g.setLineDash(dash || []); g.stroke(); g.setLineDash([]); };
  // sea
  g.fillStyle = W.SEA_DEEP; g.fillRect(0, 0, PW, PH);
  g.strokeStyle = 'rgba(42,29,16,0.08)'; g.lineWidth = 1;
  for (let y = 8; y < PH; y += 14) { g.beginPath(); for (let x = 0; x <= PW; x += 8) g.lineTo(x, y + Math.sin(x * 0.08 + y) * 1.6); g.stroke(); }
  // regions with terrain: shaded relief + inked contours; anything else falls back to simple circles
  const covered = (x, z) => ters.some(T => x >= T.t.x0 && x <= T.t.x0 + (T.t.w - 1) * T.t.step && z >= T.t.z0 && z <= T.t.z0 + (T.t.h - 1) * T.t.step);
  const lands = [...M.regions.map(r => [r.c[0], r.c[1], r.r]), ...M.isles.map(([x, z, r]) => [x, z, r])].filter(([x, z]) => !covered(x, z));
  for (const [x, z, r] of lands) { g.beginPath(); g.arc(X(x), Z(z), S(r) + 7, 0, 7); g.fillStyle = 'rgba(232,222,190,0.55)'; g.fill(); }
  for (const [x, z, r] of lands) { const gr = g.createRadialGradient(X(x), Z(z), S(r) * 0.2, X(x), Z(z), S(r)); gr.addColorStop(0, '#eadcb6'); gr.addColorStop(0.85, '#e0cfa2'); gr.addColorStop(1, '#cbb582'); g.beginPath(); g.arc(X(x), Z(z), S(r), 0, 7); g.fillStyle = gr; g.fill(); g.lineWidth = 2; g.strokeStyle = W.INK; g.stroke(); g.lineWidth = 0.8; g.beginPath(); g.arc(X(x), Z(z), S(r) + 3.5, 0, 7); g.stroke(); }
  for (const T of ters) {
    const t = T.t; g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(T.canvas, X(t.x0 - t.step / 2), Z(t.z0 - t.step / 2), S(t.w * t.step), S(t.h * t.step));
    T.levels.forEach((L, k) => segs(L, k % 2 ? 'rgba(90,62,30,0.22)' : 'rgba(90,62,30,0.34)', k % 2 ? 0.6 : 0.9));
    segs(T.ripples[1], 'rgba(47,79,92,0.25)', 0.7); segs(T.ripples[0], 'rgba(47,79,92,0.4)', 0.8);
    if (T.wild) {   // wilderness: red hatching masked to the real wild area, with a dashed border
      const off = document.createElement('canvas'); off.width = Math.ceil(PW); off.height = Math.ceil(PH); const og = off.getContext('2d');
      og.fillStyle = 'rgba(155,47,42,0.10)'; og.fillRect(0, 0, PW, PH); og.strokeStyle = 'rgba(155,47,42,0.45)'; og.lineWidth = 1; og.beginPath(); for (let k = -PH; k < PW; k += 9) { og.moveTo(k, PH); og.lineTo(k + PH, 0); } og.stroke();
      og.globalCompositeOperation = 'destination-in'; og.imageSmoothingEnabled = true; const s = t.wild.step;
      og.drawImage(T.wild, X(t.x0 - s / 2), Z(t.z0 - s / 2), S(t.wild.w * s), S(t.wild.h * s));
      g.drawImage(off, 0, 0, PW, PH);
    }
    segs(T.coast, W.INK, 1.8);
  }
  if (M.wild && !ters.some(T => T.wild)) { const wx = X(M.wild.x0), wy = Z(M.wild.z0), wW = S(M.wild.x1 - M.wild.x0), wH = S(M.wild.z1 - M.wild.z0); g.fillStyle = 'rgba(155,47,42,0.08)'; g.fillRect(wx, wy, wW, wH); hatch(wx, wy, wW, wH, 'rgba(155,47,42,0.35)', 9); g.strokeStyle = 'rgba(155,47,42,0.7)'; g.setLineDash([8, 5]); g.strokeRect(wx, wy, wW, wH); g.setLineDash([]); }
  for (const [x, z, r] of M.lakes) { g.beginPath(); g.arc(X(x), Z(z), S(r), 0, 7); g.fillStyle = '#b4c6c0'; g.fill(); g.strokeStyle = '#3d5a66'; g.lineWidth = 1.2; g.stroke(); }
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (const rv of M.rivers) { const w = rv[rv.length - 1], ptsR = rv.slice(0, -1), path = () => { g.beginPath(); ptsR.forEach(([x, z], i) => i ? g.lineTo(X(x), Z(z)) : g.moveTo(X(x), Z(z))); }; path(); g.strokeStyle = '#3d5a66'; g.lineWidth = Math.max(2.5, S(w)) + 2; g.stroke(); path(); g.strokeStyle = '#b4c6c0'; g.lineWidth = Math.max(1.5, S(w)); g.stroke(); }
  for (const [x, z, w, d, rot] of M.walls) rect(x, z, w, Math.max(d, 0.8), rot, '#6b5a48', W.INK, 0.6);
  for (const [x, z, w, d, rot] of M.buildings) { rect(x + 0.6, z + 0.6, w, d, rot, 'rgba(42,29,16,0.25)'); rect(x, z, w, d, rot, '#a4472c', W.INK, 1.2); }
  stains('rgba(40,40,30,0.45)');
  // which layers are on
  const layers = opt.layers || new Set(W.LAYERS.map(l => l.id)), focus = opt.focus || null;
  const kindOn = new Set(W.LAYERS.filter(l => l.kinds && layers.has(l.id)).flatMap(l => l.kinds));
  const hits = [];   // everything hoverable: [x, z, text]
  // gathering nodes and fishing spots (under the other markers)
  const RES = M.res || { types: [], pts: [] }, SP = M.spots || { types: [], pts: [] };
  const resR = Math.max(1.6, Math.min(5, scale * 1.1));
  const resText = t => `${t.name} — ${t.skill} ${t.lvl ?? '?'} · ${t.item}`;
  const spotText = t => `Fishing: ${t.name} (lv ${t.lvl ?? '?'}${t.tool ? ', ' + t.tool : ''})${t.catches.length ? ' · ' + t.catches.join(', ') : ''}`;
  const glyph = (x, y, cat, col, r, strong) => {
    g.beginPath();
    if (cat === 'tree') g.arc(x, y, r, 0, 7);
    else if (cat === 'ore') { g.moveTo(x, y - r * 1.25); g.lineTo(x + r * 1.1, y); g.lineTo(x, y + r * 1.25); g.lineTo(x - r * 1.1, y); g.closePath(); }
    else { g.moveTo(x, y - r * 1.3); g.lineTo(x + r * 1.15, y + r * 0.9); g.lineTo(x - r * 1.15, y + r * 0.9); g.closePath(); }
    g.fillStyle = col; g.fill(); g.lineWidth = strong ? 1.6 : Math.min(1, r * 0.45); g.strokeStyle = strong ? '#fff7e0' : 'rgba(30,20,10,0.85)'; g.stroke();
  };
  const halo = (x, y, R) => {   // a glowing gold ring so found resources stand out at any zoom
    const gr = g.createRadialGradient(x, y, 0, x, y, R); gr.addColorStop(0, 'rgba(255,240,180,0.95)'); gr.addColorStop(0.6, 'rgba(255,214,110,0.55)'); gr.addColorStop(1, 'rgba(255,214,110,0)');
    g.beginPath(); g.arc(x, y, R, 0, 7); g.fillStyle = gr; g.fill(); g.beginPath(); g.arc(x, y, R * 0.72, 0, 7); g.lineWidth = 1.6; g.strokeStyle = '#9b2f2a'; g.stroke();
  };
  const typeCol = (t, cat) => cat === 'tree' ? ({ tree: '#5d8a3a', oak: '#4a7a2c', willow: '#7a9a4a', maple: '#a8642a', yew: '#2e5a32', teak: '#7a5a2a', mahogany: '#7a3a22', ironwood: '#4a4a52', elder: '#5a6a8a', redwood: '#8a2a1a' }[t.id] || '#3f6b2a') : (t.col || (cat === 'ore' ? '#7a6a58' : '#8c3f8a'));
  RES.pts.forEach(([x, z, ti]) => {
    const t = RES.types[ti], cat = W.resCat(t), isFocus = focus && focus.res === ti;
    if (focus ? !isFocus : !layers.has(cat)) return; if (!inView(x, z, 2)) return;
    if (isFocus) halo(X(x), Z(z), 11);
    glyph(X(x), Z(z), cat, typeCol(t, cat), isFocus ? Math.max(4.5, resR * 1.5) : resR, isFocus); hits.push([x, z, resText(t)]);
  });
  SP.pts.forEach(([x, z, ti]) => {
    const t = SP.types[ti], isFocus = focus && focus.spot === ti;
    if (focus ? !isFocus : !layers.has('fish')) return; if (!inView(x, z, 2)) return;
    const r = (isFocus ? 1.6 : 1) * Math.max(3, Math.min(7, scale * 1.6)), cx = X(x), cy = Z(z);
    if (isFocus) halo(cx, cy, r + 8);
    g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fillStyle = 'rgba(240,248,250,0.85)'; g.fill(); g.lineWidth = 1.6; g.strokeStyle = '#2a6f9e'; g.stroke();
    g.beginPath(); g.moveTo(cx - r * 0.6, cy); g.quadraticCurveTo(cx - r * 0.3, cy - r * 0.45, cx, cy); g.quadraticCurveTo(cx + r * 0.3, cy + r * 0.45, cx + r * 0.6, cy); g.lineWidth = 1.2; g.stroke();
    hits.push([x, z, spotText(t)]);
  });
  // markers
  const order = ['mob', 'npc', 'farm', 'hunt', 'course', 'stall', 'altar', 'station', 'shop', 'bank', 'poi', 'portal', 'boss'];
  const shown = focus ? [] : M.pts.filter(p => inView(p[0], p[1]) && kindOn.has(p[2])).sort((a, c) => order.indexOf(a[2]) - order.indexOf(c[2]));
  const r = zoomed ? 6 : scale > 2 ? 5 : 4;
  for (const [x0, z0, k] of shown) {
    const [col, shape] = W.MAPSTYLE[k] || ['#fff', 'dot'], x = X(x0), y = Z(z0);
    g.fillStyle = col; g.strokeStyle = 'rgba(245,234,205,0.95)'; g.lineWidth = 1.6; g.beginPath();
    if (shape === 'square') g.rect(x - r, y - r, 2 * r, 2 * r);
    else if (shape === 'triangle') { g.moveTo(x, y - r * 1.3); g.lineTo(x + r * 1.2, y + r); g.lineTo(x - r * 1.2, y + r); g.closePath(); }
    else if (shape === 'diamond') { g.moveTo(x, y - r * 1.2); g.lineTo(x + r, y); g.lineTo(x, y + r * 1.2); g.lineTo(x - r, y); g.closePath(); }
    else if (shape === 'star') { for (let i = 0; i < 10; i++) { const a = Math.PI / 5 * i - Math.PI / 2, rr = i % 2 ? r * .8 : r * 2; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); }
    else if (shape === 'ring') { g.arc(x, y, r * 1.3, 0, 7); g.lineWidth = 3; g.strokeStyle = col; g.stroke(); g.beginPath(); g.arc(x, y, r * .5, 0, 7); }
    else g.arc(x, y, r * .8, 0, 7);
    g.fill(); if (shape !== 'ring') g.stroke();
  }
  for (const p of shown) hits.push([p[0], p[1], p[3]]);
  // labels: place names always; at town zoom every marker and building gets one if it fits
  const taken = [], free = (x, y, w, h) => { if (taken.some(t => x < t[0] + t[2] && x + w > t[0] && y < t[1] + t[3] && y + h > t[1])) return false; taken.push([x, y, w, h]); return true; };
  g.textBaseline = 'middle';
  const label = (x, y, text, col, size, bold, center, italic) => {
    g.font = (italic ? 'italic ' : '') + (bold ? '700 ' : '600 ') + size + 'px ' + (bold ? 'Cinzel,Georgia,serif' : '"Alegreya Sans",Georgia,serif'); const w = g.measureText(text).width, lx = center ? x - w / 2 : x + 8;
    if (!free(lx - 2, y - size / 2 - 2, w + 4, size + 4)) return; g.textAlign = 'left'; g.lineWidth = 4; g.strokeStyle = 'rgba(240,228,196,0.92)'; g.strokeText(text, lx, y); g.fillStyle = col; g.fillText(text, lx, y);
  };
  for (const [x, z, name, kind] of M.labels) if (inView(x, z)) label(X(x), Z(z) - (zoomed ? S(14) : 0), name, kind === 'region' ? '#6b4e2a' : W.INK, zoomed ? 20 : kind === 'region' ? 13 : 15, true, true);
  for (const [x, z, , , , name] of M.lakes.map(l => [l[0], l[1], 0, 0, 0, l[3]])) if (name && name !== 'pool' && inView(x, z)) label(X(x), Z(z), name, '#2f4f5c', 12, false, true, true);
  if (zoomed) {
    for (const p of shown.slice().reverse()) label(X(p[0]), Z(p[1]), p[3].length > 40 ? p[3].slice(0, 38) + '…' : p[3], (W.MAPSTYLE[p[2]] || [W.INK])[0], 12, false);
    for (const [x, z, , , , name] of M.buildings) if (name && inView(x, z)) label(X(x), Z(z), name, '#5a2414', 11, false, true, true);
  } else {
    for (const p of shown.filter(p => p[2] === 'boss' || p[2] === 'portal').reverse()) label(X(p[0]), Z(p[1]), p[3], W.MAPSTYLE[p[2]][0], 12, false);
  }
  // scale bar, compass and a double ink frame
  const unit = [5, 10, 25, 50, 100, 250, 500].find(u => S(u) > 70) || 1000, H = wh * scale;
  g.fillStyle = 'rgba(240,228,196,0.85)'; g.fillRect(12, H - 34, S(unit) + 20, 24); g.strokeStyle = W.INK; g.lineWidth = 1; g.strokeRect(12, H - 34, S(unit) + 20, 24);
  for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? '#f1e4c4' : W.INK; g.fillRect(22 + S(unit) * i / 4, H - 16, S(unit) / 4, 4); }
  g.strokeRect(22, H - 16, S(unit), 4); g.fillStyle = W.INK; g.font = '600 11px Cinzel,Georgia,serif'; g.textAlign = 'left'; g.fillText(unit + ' units', 22, H - 24);
  W.compass(g, PW - 40, 46, 24);
  g.strokeStyle = W.INK; g.lineWidth = 2; g.strokeRect(5, 5, PW - 10, PH - 10); g.lineWidth = 0.8; g.strokeRect(10, 10, PW - 20, PH - 20);
  // hover lookup: nearest hoverable thing within 12px
  return (mx, my) => { let best = null, bd = 144; for (const p of hits) { const dx = X(p[0]) - mx, dy = Z(p[1]) - my, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = p; } } return best; };
};
W.attachTip = (cv, tip, lookupRef) => {
  cv.addEventListener('mousemove', e => {
    if (lookupRef.dragging) { tip.style.display = 'none'; return; }
    const rc = cv.getBoundingClientRect(), p = lookupRef.fn && lookupRef.fn(e.clientX - rc.left, e.clientY - rc.top);
    if (!p) { tip.style.display = 'none'; return; }
    tip.textContent = p[2] + '  (' + Math.round(p[0]) + ', ' + Math.round(p[1]) + ')'; tip.style.display = 'block';
    tip.style.left = (e.clientX - rc.left) + 'px'; tip.style.top = (e.clientY - rc.top) + 'px';
  });
  cv.addEventListener('mouseleave', () => { tip.style.display = 'none'; });
};
