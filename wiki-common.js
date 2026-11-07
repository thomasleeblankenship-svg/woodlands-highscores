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
W.legendHtml = () => Object.values(W.MAPSTYLE).map(([c, , t]) => `<span><i style="background:${c}"></i>${W.esc(t)}</span>`).join('') + '<span><i style="background:repeating-linear-gradient(45deg,#9b2f2a 0 2px,#e6d5ae 2px 5px)"></i>Wilderness</span><span><i style="background:#a4472c"></i>Building</span>';
W.INK = '#2a1d10';
W.compass = (g, x, y, r) => {   // a small inked compass rose
  g.save(); g.translate(x, y);
  g.strokeStyle = W.INK; g.fillStyle = '#f1e4c4'; g.lineWidth = 1.2; g.beginPath(); g.arc(0, 0, r, 0, 7); g.fill(); g.stroke(); g.beginPath(); g.arc(0, 0, r * 0.82, 0, 7); g.stroke();
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, l = i % 2 ? r * 0.55 : r * 0.95; g.save(); g.rotate(a); g.beginPath(); g.moveTo(0, -l); g.lineTo(r * 0.13, 0); g.lineTo(0, r * 0.13); g.lineTo(-r * 0.13, 0); g.closePath(); g.fillStyle = i === 0 ? '#9b2f2a' : i % 2 ? '#8a7350' : W.INK; g.fill(); g.restore(); }
  g.fillStyle = W.INK; g.font = `bold ${Math.round(r * 0.42)}px Cinzel,Georgia,serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('N', 0, -r - r * 0.32);
  g.restore();
};

// view: {x0,x1,z0,z1} in world units, or {cave} for a dungeon. Returns hover lookup.
W.drawMap = (cv, M, view, opt = {}) => {
  const cssW = cv.parentElement.clientWidth || 900, dpr = Math.min(2, window.devicePixelRatio || 1);
  const cave = view.cave;
  const b = cave ? { x0: cave.ox - 4, x1: cave.ox + cave.W * 4 + 4, z0: cave.oz - 4, z1: cave.oz + cave.H * 4 + 4 } : view;
  const ww = b.x1 - b.x0, wh = b.z1 - b.z0, cssH = Math.min(cssW * wh / ww, opt.maxH || 900);
  const scale = Math.min(cssW / ww, cssH / wh);
  cv.width = Math.round(ww * scale * dpr); cv.height = Math.round(wh * scale * dpr); cv.style.height = (wh * scale) + 'px'; cv.style.width = (ww * scale) + 'px';
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const X = x => (x - b.x0) * scale, Z = z => (z - b.z0) * scale, S = v => v * scale;
  const zoomed = ww < 320;
  const PW = ww * scale, PH = wh * scale;
  // aged parchment base with soft stains
  const parchment = (base, edge) => {
    g.fillStyle = base; g.fillRect(0, 0, PW, PH);
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 14; i++) { const x = rnd() * PW, y = rnd() * PH, r = 40 + rnd() * Math.max(PW, PH) * 0.25, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(120,85,40,0.07)'); gr.addColorStop(1, 'rgba(120,85,40,0)'); g.fillStyle = gr; g.fillRect(0, 0, PW, PH); }
    const v = g.createRadialGradient(PW / 2, PH / 2, Math.min(PW, PH) * 0.35, PW / 2, PH / 2, Math.max(PW, PH) * 0.75); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, edge); g.fillStyle = v; g.fillRect(0, 0, PW, PH);
  };
  const rect = (x, z, w, d, rot, fill, stroke, lw = 1) => { g.save(); g.translate(X(x), Z(z)); g.rotate(-rot); g.fillStyle = fill; g.fillRect(-S(w) / 2, -S(d) / 2, S(w), S(d)); if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.strokeRect(-S(w) / 2, -S(d) / 2, S(w), S(d)); } g.restore(); };
  const hatch = (x, y, w, h, color, gap = 6) => { g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); g.strokeStyle = color; g.lineWidth = 1; g.beginPath(); for (let k = -h; k < w; k += gap) { g.moveTo(x + k, y + h); g.lineTo(x + k + h, y); } g.stroke(); g.restore(); };
  if (cave) {
    parchment('#e3d3ac', 'rgba(70,45,15,0.45)');
    const t = 4 * scale, ox = X(cave.ox), oy = Z(cave.oz);
    cave.grid.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] === '#') { g.fillStyle = '#5a4630'; g.fillRect(ox + i * t, oy + j * t, t + .5, t + .5); } });
    cave.grid.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] === '#') hatch(ox + i * t, oy + j * t, t + .5, t + .5, 'rgba(30,20,10,0.55)', 4); });
    g.strokeStyle = W.INK; g.lineWidth = 2;   // ink outline along wall edges
    cave.grid.forEach((row, j) => { for (let i = 0; i < row.length; i++) { if (row[i] === '#') continue; const wall = (a, b) => (cave.grid[b] || '')[a] === '#'; const x = ox + i * t, y = oy + j * t; g.beginPath(); if (wall(i, j - 1)) { g.moveTo(x, y); g.lineTo(x + t, y); } if (wall(i, j + 1)) { g.moveTo(x, y + t); g.lineTo(x + t, y + t); } if (wall(i - 1, j)) { g.moveTo(x, y); g.lineTo(x, y + t); } if (wall(i + 1, j)) { g.moveTo(x + t, y); g.lineTo(x + t, y + t); } g.stroke(); } });
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
  // sea, then landmasses with inked coasts and a shallow-water halo
  parchment('#b9c7bf', 'rgba(40,40,30,0.5)');
  g.strokeStyle = 'rgba(42,29,16,0.10)'; g.lineWidth = 1;
  for (let y = 8; y < PH; y += 14) { g.beginPath(); for (let x = 0; x <= PW; x += 8) g.lineTo(x, y + Math.sin(x * 0.08 + y) * 1.6); g.stroke(); }
  const lands = [...M.regions.map(r => [r.c[0], r.c[1], r.r]), ...M.isles.map(([x, z, r]) => [x, z, r])];
  for (const [x, z, r] of lands) { g.beginPath(); g.arc(X(x), Z(z), S(r) + 7, 0, 7); g.fillStyle = 'rgba(232,222,190,0.55)'; g.fill(); }
  for (const [x, z, r] of lands) { const gr = g.createRadialGradient(X(x), Z(z), S(r) * 0.2, X(x), Z(z), S(r)); gr.addColorStop(0, '#eadcb6'); gr.addColorStop(0.85, '#e0cfa2'); gr.addColorStop(1, '#cbb582'); g.beginPath(); g.arc(X(x), Z(z), S(r), 0, 7); g.fillStyle = gr; g.fill(); g.lineWidth = 2; g.strokeStyle = W.INK; g.stroke(); g.lineWidth = 0.8; g.beginPath(); g.arc(X(x), Z(z), S(r) + 3.5, 0, 7); g.stroke(); }
  if (M.wild) { const wx = X(M.wild.x0), wy = Z(M.wild.z0), wW = S(M.wild.x1 - M.wild.x0), wH = S(M.wild.z1 - M.wild.z0); g.fillStyle = 'rgba(155,47,42,0.08)'; g.fillRect(wx, wy, wW, wH); hatch(wx, wy, wW, wH, 'rgba(155,47,42,0.35)', 9); g.strokeStyle = 'rgba(155,47,42,0.7)'; g.setLineDash([8, 5]); g.strokeRect(wx, wy, wW, wH); g.setLineDash([]); }
  for (const [x, z, r] of M.lakes) { g.beginPath(); g.arc(X(x), Z(z), S(r), 0, 7); g.fillStyle = '#9fb7b4'; g.fill(); g.strokeStyle = '#3d5a66'; g.lineWidth = 1.2; g.stroke(); }
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (const rv of M.rivers) { const w = rv[rv.length - 1], ptsR = rv.slice(0, -1), path = () => { g.beginPath(); ptsR.forEach(([x, z], i) => i ? g.lineTo(X(x), Z(z)) : g.moveTo(X(x), Z(z))); }; path(); g.strokeStyle = '#3d5a66'; g.lineWidth = Math.max(2.5, S(w)) + 2; g.stroke(); path(); g.strokeStyle = '#9fb7b4'; g.lineWidth = Math.max(1.5, S(w)); g.stroke(); }
  for (const [x, z, w, d, rot] of M.walls) rect(x, z, w, Math.max(d, 0.8), rot, '#6b5a48', W.INK, 0.6);
  for (const [x, z, w, d, rot] of M.buildings) { rect(x + 0.6, z + 0.6, w, d, rot, 'rgba(42,29,16,0.25)'); rect(x, z, w, d, rot, '#a4472c', W.INK, 1.2); }
  // markers
  const order = ['mob', 'npc', 'farm', 'hunt', 'course', 'stall', 'altar', 'station', 'shop', 'bank', 'poi', 'portal', 'boss'];
  const shown = M.pts.filter(p => p[0] >= b.x0 && p[0] <= b.x1 && p[1] >= b.z0 && p[1] <= b.z1 && (!opt.kinds || opt.kinds.has(p[2]))).sort((a, c) => order.indexOf(a[2]) - order.indexOf(c[2]));
  const r = zoomed ? 6 : 4;
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
  // labels: place names always; at town zoom every marker and building gets one if it fits
  const taken = [], free = (x, y, w, h) => { if (taken.some(t => x < t[0] + t[2] && x + w > t[0] && y < t[1] + t[3] && y + h > t[1])) return false; taken.push([x, y, w, h]); return true; };
  g.textBaseline = 'middle';
  const label = (x, y, text, col, size, bold, center, italic) => {
    g.font = (italic ? 'italic ' : '') + (bold ? '700 ' : '600 ') + size + 'px ' + (bold ? 'Cinzel,Georgia,serif' : '"Alegreya Sans",Georgia,serif'); const w = g.measureText(text).width, lx = center ? x - w / 2 : x + 8;
    if (!free(lx - 2, y - size / 2 - 2, w + 4, size + 4)) return; g.textAlign = 'left'; g.lineWidth = 4; g.strokeStyle = 'rgba(240,228,196,0.92)'; g.strokeText(text, lx, y); g.fillStyle = col; g.fillText(text, lx, y);
  };
  for (const [x, z, name, kind] of M.labels) if (x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1) label(X(x), Z(z) - (zoomed ? S(14) : 0), name, kind === 'region' ? '#6b4e2a' : W.INK, zoomed ? 20 : kind === 'region' ? 13 : 15, true, true);
  for (const [x, z, , , , name] of M.lakes.map(l => [l[0], l[1], 0, 0, 0, l[3]])) if (name && name !== 'pool' && x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1) label(X(x), Z(z), name, '#2f4f5c', 12, false, true, true);
  if (zoomed) {
    for (const p of shown.slice().reverse()) label(X(p[0]), Z(p[1]), p[3].length > 40 ? p[3].slice(0, 38) + '…' : p[3], (W.MAPSTYLE[p[2]] || [W.INK])[0], 12, false);
    for (const [x, z, , , , name] of M.buildings) if (name && x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1) label(X(x), Z(z), name, '#5a2414', 11, false, true, true);
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
  // hover lookup: nearest marker within 12px
  return (mx, my) => { let best = null, bd = 144; for (const p of shown) { const dx = X(p[0]) - mx, dy = Z(p[1]) - my, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = p; } } return best; };
};
W.attachTip = (cv, tip, lookupRef) => {
  cv.addEventListener('mousemove', e => {
    const rc = cv.getBoundingClientRect(), p = lookupRef.fn && lookupRef.fn(e.clientX - rc.left, e.clientY - rc.top);
    if (!p) { tip.style.display = 'none'; return; }
    tip.textContent = p[3] + '  (' + Math.round(p[0]) + ', ' + Math.round(p[1]) + ')'; tip.style.display = 'block';
    tip.style.left = (e.clientX - rc.left) + 'px'; tip.style.top = (e.clientY - rc.top) + 'px';
  });
  cv.addEventListener('mouseleave', () => { tip.style.display = 'none'; });
};
