'use strict';
// Woodlands theme: backdrop layers, header crest, 3D card tilt, and the animated 3D scene.
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // backdrop layers (scene canvas, shading, film grain)
  const layer = (tag, id) => { const el = document.createElement(tag); el.id = id; el.setAttribute('aria-hidden', 'true'); document.body.prepend(el); return el; };
  layer('div', 'bgGrain'); layer('div', 'bgShade'); const canvas = layer('canvas', 'bgScene');

  // heraldic crest (original design: shield, pine tree, crossed axes)
  const CREST = `<svg class="crest" viewBox="0 0 76 88" aria-hidden="true"><defs>
    <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff0c0"/><stop offset=".5" stop-color="#d9b25f"/><stop offset="1" stop-color="#8a6328"/></linearGradient>
    <linearGradient id="cf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#25402c"/><stop offset="1" stop-color="#11201a"/></linearGradient></defs>
    <path d="M38 3 70 13v26c0 22-14 38-32 46C20 77 6 61 6 39V13Z" fill="url(#cf)" stroke="url(#cg)" stroke-width="3.5"/>
    <path d="M38 11 63 19v20c0 17-10 30-25 37C23 69 13 56 13 39V19Z" fill="none" stroke="#d9b25f" stroke-opacity=".45" stroke-width="1"/>
    <g stroke="url(#cg)" stroke-width="3" stroke-linecap="round"><path d="M18 64 56 26"/><path d="M58 64 20 26"/></g>
    <path d="M52 24c3-1 7 1 8 4l-6 6c-1-4-3-6-6-6Z M24 24c-3-1-7 1-8 4l6 6c1-4 3-6 6-6Z" fill="url(#cg)"/>
    <path d="M38 18 50 36h-6l9 12h-7l10 13H30l10-13h-7l9-12h-6Z" fill="#2f6b45" stroke="#0b160f" stroke-width="1.2" transform="translate(-2 0)"/>
    <rect x="34.5" y="61" width="3" height="7" fill="#5a3a1c"/></svg>`;
  document.querySelectorAll('.brand').forEach(b => { const s = b.querySelector('span'); if (s) s.outerHTML = CREST; else b.insertAdjacentHTML('afterbegin', CREST); });
  document.querySelectorAll('.intro').forEach(el => { if (getComputedStyle(el).textAlign === 'center') el.classList.add('centered'); });

  // 3D tilt with a candle-glow highlight that follows the pointer
  if (!reduce && matchMedia('(pointer:fine)').matches) {
    const SEL = '.card,.metric,.mini,.fact';
    let active = null;
    const reset = el => { el.classList.remove('tilting'); el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); };
    document.addEventListener('pointermove', e => {
      const el = e.target.closest && e.target.closest(SEL);
      if (active && active !== el) { reset(active); active = null; }
      if (!el) return;
      if (!el.classList.contains('tilt')) el.classList.add('tilt');
      active = el; el.classList.add('tilting');
      const r = el.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      const k = r.width > 500 ? 2.5 : 6;   // big panels tilt less
      el.style.setProperty('--ry', ((px - .5) * k).toFixed(2) + 'deg'); el.style.setProperty('--rx', ((.5 - py) * k).toFixed(2) + 'deg');
      el.style.setProperty('--mx', (px * 100).toFixed(1) + '%'); el.style.setProperty('--my', (py * 100).toFixed(1) + '%');
    }, { passive: true });
    document.addEventListener('pointerleave', () => { if (active) reset(active); active = null; });
  }

  // animated scene (three.js loaded by the page); falls back to the CSS gradient if WebGL is unavailable
  const start = () => { try { if (window.THREE && window.WoodlandsScene) window.WoodlandsScene(canvas, { reduce }); } catch (e) { console.warn('3D backdrop unavailable:', e); } };
  if (document.readyState === 'complete') start(); else addEventListener('load', start);
})();
