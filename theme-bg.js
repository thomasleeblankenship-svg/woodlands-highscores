'use strict';
// Woodlands animated backdrop: a moonlit valley with a pine forest, a castle on a hill,
// mountains, stars, mist and fireflies. Procedural geometry only (three.js r128).
window.WoodlandsScene = (canvas, opts = {}) => {
  const T = window.THREE;
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
  const scene = new T.Scene();
  scene.fog = new T.FogExp2(0x1b1f33, 0.0105);
  const camera = new T.PerspectiveCamera(55, 1, 0.1, 900);
  const clock = new T.Clock();
  const U = { uTime: { value: 0 } };

  // ---------- helpers ----------
  const glowTex = (inner, outer, size = 128) => {
    const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d');
    const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gr.addColorStop(0, inner); gr.addColorStop(0.35, outer); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, size, size); const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; return t;
  };
  const merge = geos => {   // merge non-indexed geometries (position + normal)
    const parts = geos.map(g => g.index ? g.toNonIndexed() : g);
    const n = parts.reduce((s, g) => s + g.attributes.position.count, 0), pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
    let o = 0; for (const g of parts) { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); o += g.attributes.position.count; }
    const m = new T.BufferGeometry(); m.setAttribute('position', new T.BufferAttribute(pos, 3)); m.setAttribute('normal', new T.BufferAttribute(nor, 3)); return m;
  };
  const rand = (() => { let s = 1234567; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  const CASTLE = { x: 30, z: -118 };
  const height = (x, z) => {
    let h = 2.2 * Math.sin(x * 0.045) * Math.cos(z * 0.04) + 1.4 * Math.sin(x * 0.11 + 1.3) * Math.sin(z * 0.09 + 0.7) + 0.6 * Math.sin(x * 0.23 + z * 0.19);
    h -= 3.2 * Math.exp(-(x * x) / (2 * 11 * 11));                              // valley path
    h += Math.max(0, -z - 70) * 0.06;                                            // land rises into the distance
    h += 15 * Math.exp(-((x - CASTLE.x) ** 2 + (z - CASTLE.z) ** 2) / (2 * 20 * 20));   // castle hill
    return h;
  };

  // ---------- sky dome, stars, moon ----------
  scene.add(new T.Mesh(new T.SphereGeometry(600, 40, 20), new T.ShaderMaterial({
    side: T.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new T.Color(0x050816) }, mid: { value: new T.Color(0x18203f) }, low: { value: new T.Color(0x4a3452) }, moonDir: { value: new T.Vector3(-0.35, 0.32, -0.88).normalize() } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: 'uniform vec3 top,mid,low,moonDir; varying vec3 vP; void main(){ float h = vP.y; vec3 c = mix(low, mid, smoothstep(-0.05,0.25,h)); c = mix(c, top, smoothstep(0.25,0.9,h)); float m = max(dot(vP, moonDir),0.); c += vec3(0.55,0.6,0.85) * pow(m, 18.) * 0.35 + vec3(0.9,0.6,0.4) * pow(max(1.-abs(h),0.),10.)*0.12; gl_FragColor = vec4(c,1.); }',
  })));
  {
    const N = 1800, p = new Float32Array(N * 3), ph = new Float32Array(N), sz = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const u = rand() * Math.PI * 2, v = Math.acos(1 - rand() * 0.95), r = 560;
      p.set([r * Math.sin(v) * Math.cos(u), r * Math.cos(v) + 20, r * Math.sin(v) * Math.sin(u)], i * 3); ph[i] = rand() * 6.28; sz[i] = 0.6 + rand() * rand() * 3.2;
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(p, 3)); g.setAttribute('phase', new T.BufferAttribute(ph, 1)); g.setAttribute('size', new T.BufferAttribute(sz, 1));
    scene.add(new T.Points(g, new T.ShaderMaterial({
      uniforms: U, transparent: true, depthWrite: false, fog: false, blending: T.AdditiveBlending,
      vertexShader: 'attribute float phase; attribute float size; uniform float uTime; varying float vA; void main(){ vA = 0.55 + 0.45*sin(uTime*1.7 + phase*3.); gl_PointSize = size * (1.0 + 0.25*sin(uTime + phase)); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
      fragmentShader: 'varying float vA; void main(){ float d = length(gl_PointCoord-0.5); float a = smoothstep(0.5,0.0,d); gl_FragColor = vec4(vec3(1.,0.95,0.85), a*vA); }',
    })));
  }
  const moon = new T.Sprite(new T.SpriteMaterial({ map: glowTex('rgba(255,250,235,1)', 'rgba(190,205,255,0.35)', 256), fog: false, depthWrite: false, transparent: true }));
  moon.position.set(-190, 175, -470); moon.scale.set(150, 150, 1); scene.add(moon);
  const moonDisc = new T.Sprite(new T.SpriteMaterial({ map: glowTex('rgba(255,252,240,1)', 'rgba(255,248,225,0.95)', 128), fog: false, depthWrite: false, transparent: true }));
  moonDisc.position.copy(moon.position); moonDisc.scale.set(30, 30, 1); scene.add(moonDisc);

  // ---------- lights ----------
  scene.add(new T.HemisphereLight(0x7080c0, 0x0c0d08, 0.6));
  const moonLight = new T.DirectionalLight(0xa9bcff, 0.85); moonLight.position.set(-190, 175, -470).normalize().multiplyScalar(100); scene.add(moonLight);
  const castleGlow = new T.PointLight(0xff9a4a, 2.2, 90, 2); castleGlow.position.set(CASTLE.x, height(CASTLE.x, CASTLE.z) + 12, CASTLE.z + 8); scene.add(castleGlow);

  // ---------- mountains (layered silhouettes) ----------
  [[-230, 0x262c48, 48, 0.011, 1.7], [-300, 0x2a3150, 72, 0.008, 4.2], [-390, 0x30375a, 105, 0.0055, 0.6]].forEach(([z, col, amp, f, off]) => {
    const s = new T.Shape(); s.moveTo(-700, -20);
    for (let x = -700; x <= 700; x += 6) {
      const y = amp * (0.55 * Math.abs(Math.sin(x * f + off)) + 0.3 * Math.abs(Math.sin(x * f * 2.7 + off * 2)) + 0.15 * Math.sin(x * f * 6.1 + off)) + 8;
      s.lineTo(x, y);
    }
    s.lineTo(700, -20); s.lineTo(-700, -20);
    const m = new T.Mesh(new T.ShapeGeometry(s), new T.MeshBasicMaterial({ color: col, fog: true })); m.position.set(0, 0, z); scene.add(m);
    // snow caps catching the moonlight on the farthest range
    if (z < -350) { const cap = m.clone(); cap.material = new T.MeshBasicMaterial({ color: 0x5a6390, fog: true, transparent: true, opacity: 0.35 }); cap.position.z = z + 0.5; cap.scale.y = 1.0; scene.add(cap); m.scale.y = 0.93; }
  });

  // ---------- ground ----------
  {
    const g = new T.PlaneGeometry(520, 520, 170, 170); g.rotateX(-Math.PI / 2); g.translate(0, 0, -180);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, height(p.getX(i), p.getZ(i)));
    g.computeVertexNormals();
    scene.add(new T.Mesh(g, new T.MeshStandardMaterial({ color: 0x1f3324, roughness: 1, metalness: 0, flatShading: true })));
  }

  // ---------- pine forest (instanced, swaying in the wind) ----------
  {
    const tiers = [[2.6, 3.2, 1.2], [2.0, 2.8, 2.9], [1.35, 2.4, 4.4], [0.7, 1.8, 5.7]].map(([r, h, y]) => { const c = new T.ConeGeometry(r, h, 7); c.translate(0, y, 0); return c; });
    const foliageGeo = merge(tiers), trunkGeo = new T.CylinderGeometry(0.22, 0.32, 1.6, 6); trunkGeo.translate(0, 0.4, 0);
    const foliageMat = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, flatShading: true });
    foliageMat.onBeforeCompile = sh => {
      sh.uniforms.uTime = U.uTime;
      sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>',
        '#include <begin_vertex>\n float sway = sin(uTime*1.1 + instanceMatrix[3].x*0.21 + instanceMatrix[3].z*0.17) * 0.045 * position.y;\n transformed.x += sway; transformed.z += sway*0.5;');
    };
    const N = 900, fol = new T.InstancedMesh(foliageGeo, foliageMat, N), trunk = new T.InstancedMesh(trunkGeo, new T.MeshStandardMaterial({ color: 0x3a2716, roughness: 1 }), N);
    const m = new T.Matrix4(), q = new T.Quaternion(), sc = new T.Vector3(), ps = new T.Vector3(), col = new T.Color(); let k = 0;
    for (let tries = 0; k < N && tries < 8000; tries++) {
      const x = (rand() - 0.5) * 380, z = 25 - rand() * 300;
      if (Math.abs(x) < 7 + Math.max(0, -z) * 0.02) continue;                                   // keep the valley path clear
      if (Math.hypot(x - CASTLE.x, z - CASTLE.z) < 22) continue;                                // and the castle hill top
      if (z > 5 && Math.abs(x) < 22) continue;                                                  // open foreground
      const s = 0.8 + rand() * 1.1; ps.set(x, height(x, z) - 0.2, z); q.setFromAxisAngle(new T.Vector3(0, 1, 0), rand() * 6.28); sc.set(s, s * (0.85 + rand() * 0.4), s);
      m.compose(ps, q, sc); fol.setMatrixAt(k, m); trunk.setMatrixAt(k, m);
      col.setHSL(0.36 + rand() * 0.06, 0.32 + rand() * 0.15, 0.13 + rand() * 0.08); fol.setColorAt(k, col); k++;
    }
    fol.count = trunk.count = k; scene.add(fol, trunk);
  }

  // ---------- castle on the hill ----------
  const flicker = [];
  {
    const base = height(CASTLE.x, CASTLE.z) - 1.2, grp = new T.Group(); grp.position.set(CASTLE.x, base, CASTLE.z); grp.rotation.y = -0.35;
    const stone = new T.MeshStandardMaterial({ color: 0x55545e, roughness: 0.95, flatShading: true }), stone2 = new T.MeshStandardMaterial({ color: 0x46454f, roughness: 1, flatShading: true });
    const roof = new T.MeshStandardMaterial({ color: 0x5a2228, roughness: 0.8, flatShading: true });
    const add = (geo, mat, x, y, z) => { const me = new T.Mesh(geo, mat); me.position.set(x, y, z); grp.add(me); return me; };
    const crenels = (len, y, z0, rotY, cx, cz) => { const g = new T.Group(); for (let i = -len / 2 + 0.6; i < len / 2; i += 1.6) { const c = new T.Mesh(new T.BoxGeometry(0.8, 0.9, 1.1), stone); c.position.set(i, y, 0); g.add(c); } g.position.set(cx, 0, cz); g.rotation.y = rotY; grp.add(g); };
    const W = 22, H = 6.5;   // curtain walls
    add(new T.BoxGeometry(W, H, 1.6), stone2, 0, H / 2, -W / 2); add(new T.BoxGeometry(W, H, 1.6), stone2, 0, H / 2, W / 2);
    add(new T.BoxGeometry(1.6, H, W), stone2, -W / 2, H / 2, 0); add(new T.BoxGeometry(1.6, H, W), stone2, W / 2, H / 2, 0);
    crenels(W, H + 0.45, 0, 0, 0, -W / 2); crenels(W, H + 0.45, 0, 0, 0, W / 2); crenels(W, H + 0.45, 0, Math.PI / 2, -W / 2, 0); crenels(W, H + 0.45, 0, Math.PI / 2, W / 2, 0);
    const banners = [];
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {   // corner towers
      const tx = x * W / 2, tz = z * W / 2, th = 11 + (x + z === 0 ? 2 : 0);
      add(new T.CylinderGeometry(2.4, 2.7, th, 10), stone, tx, th / 2, tz);
      add(new T.ConeGeometry(3.1, 5.5, 10), roof, tx, th + 2.75, tz);
      const pole = add(new T.CylinderGeometry(0.07, 0.07, 3, 4), stone2, tx, th + 6.6, tz);
      const flag = new T.Mesh(new T.PlaneGeometry(2.2, 1.1, 8, 1), new T.MeshStandardMaterial({ color: x > 0 ? 0xb3382e : 0xd9b25f, side: T.DoubleSide, roughness: 0.7 }));
      flag.position.set(tx + 1.1, th + 7.4, tz); grp.add(flag); banners.push(flag);
    }
    add(new T.BoxGeometry(9, 17, 9), stone, 0, 8.5, 0);              // keep
    add(new T.ConeGeometry(7.2, 7, 4), roof, 0, 20.5, 0).rotation.y = Math.PI / 4;
    add(new T.CylinderGeometry(1.6, 1.8, 6, 8), stone, 3.6, 19, 3.6); add(new T.ConeGeometry(2.1, 3.6, 8), roof, 3.6, 23.8, 3.6);
    add(new T.BoxGeometry(5, 5.5, 2.4), stone, 0, 2.75, W / 2 + 0.6);  // gatehouse
    const winMat = new T.MeshBasicMaterial({ color: 0xffb066, fog: true });
    for (let i = 0; i < 16; i++) {
      const side = i % 4, f = new T.Mesh(new T.PlaneGeometry(0.7, 1.1), winMat.clone());
      const y = 4 + (i % 3) * 4, off = ((i * 7) % 5 - 2) * 1.6;
      if (side === 0) f.position.set(off, y, 4.55); else if (side === 1) { f.position.set(4.55, y, off); f.rotation.y = Math.PI / 2; } else if (side === 2) { f.position.set(off, y, -4.55); f.rotation.y = Math.PI; } else { f.position.set(-4.55, y, off); f.rotation.y = -Math.PI / 2; }
      grp.add(f); flicker.push({ m: f.material, p: rand() * 10, s: 2 + rand() * 4 });
    }
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const f = new T.Mesh(new T.PlaneGeometry(0.6, 1), winMat.clone()); f.position.set(x * W / 2 + x * 0.3, 8, z * W / 2 + 2.65 * Math.sign(z)); if (z < 0) f.rotation.y = Math.PI; grp.add(f); flicker.push({ m: f.material, p: rand() * 10, s: 3 }); }
    grp.userData.banners = banners; scene.add(grp); scene.userData.castle = grp;
    const halo = new T.Sprite(new T.SpriteMaterial({ map: glowTex('rgba(255,170,90,0.55)', 'rgba(255,130,60,0.12)'), depthWrite: false, transparent: true, blending: T.AdditiveBlending }));
    halo.position.set(CASTLE.x, base + 12, CASTLE.z); halo.scale.set(70, 50, 1); scene.add(halo);
  }

  // ---------- mist banks ----------
  const mists = [];
  {
    const tex = glowTex('rgba(190,200,230,0.55)', 'rgba(170,180,215,0.18)', 128);
    for (let i = 0; i < 16; i++) {
      const s = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.16 + rand() * 0.1 }));
      const z = -10 - rand() * 180; s.position.set((rand() - 0.5) * 260, height(0, z) + 2 + rand() * 4, z); s.scale.set(80 + rand() * 60, 14 + rand() * 10, 1);
      scene.add(s); mists.push({ s, v: 0.6 + rand() * 1.2 });
    }
  }

  // ---------- fireflies ----------
  {
    const N = 320, p = new Float32Array(N * 3), ph = new Float32Array(N);
    for (let i = 0; i < N; i++) { const x = (rand() - 0.5) * 130, z = 22 - rand() * 110; p.set([x, height(x, z) + 0.8 + rand() * 6, z], i * 3); ph[i] = rand() * 100; }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(p, 3)); g.setAttribute('phase', new T.BufferAttribute(ph, 1));
    scene.add(new T.Points(g, new T.ShaderMaterial({
      uniforms: U, transparent: true, depthWrite: false, blending: T.AdditiveBlending,
      vertexShader: 'attribute float phase; uniform float uTime; varying float vA; void main(){ vec3 p = position; p.x += sin(uTime*0.35+phase)*2.2; p.y += sin(uTime*0.6+phase*1.7)*0.9; p.z += cos(uTime*0.3+phase*0.7)*2.2; vA = pow(max(0., sin(uTime*1.3+phase*2.3)), 3.); vec4 mv = modelViewMatrix*vec4(p,1.); gl_PointSize = 70. / -mv.z; gl_Position = projectionMatrix*mv; }',
      fragmentShader: 'varying float vA; void main(){ float d = length(gl_PointCoord-0.5); float a = smoothstep(0.5,0.,d); gl_FragColor = vec4(1.,0.85,0.4, a*a*vA); }',
    })));
  }

  // ---------- shooting star ----------
  const meteor = new T.Sprite(new T.SpriteMaterial({ map: glowTex('rgba(255,255,255,1)', 'rgba(200,220,255,0.4)', 64), fog: false, transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
  meteor.scale.set(4, 4, 1); meteor.visible = false; scene.add(meteor); let meteorAt = 6, mFrom = new T.Vector3(), mTo = new T.Vector3();

  // ---------- interaction & loop ----------
  let mx = 0, my = 0, tx = 0, ty = 0;
  addEventListener('pointermove', e => { tx = e.clientX / innerWidth - 0.5; ty = e.clientY / innerHeight - 0.5; }, { passive: true });
  const resize = () => { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w < 700 ? 68 : 55; camera.updateProjectionMatrix(); if (opts.reduce) frame(0); };
  const frame = dt => {
    const t = clock.elapsedTime; U.uTime.value = t;
    mx += (tx - mx) * 0.04; my += (ty - my) * 0.04;
    const sy = Math.min(scrollY, 1600) / 1600;
    camera.position.set(Math.sin(t * 0.045) * 7 + mx * 6, 11 + Math.sin(t * 0.07) * 0.6 - my * 2 + sy * 5, 34 + Math.sin(t * 0.03) * 5 - sy * 10);
    camera.lookAt(mx * 10 + 6, 1.5 - my * 3 - sy * 2, -90);
    for (const f of flicker) f.m.color.setRGB(1, 0.62 + 0.12 * Math.sin(t * f.s + f.p) + 0.06 * Math.sin(t * 13 + f.p), 0.32);
    castleGlow.intensity = 2 + 0.35 * Math.sin(t * 3.1) + 0.2 * Math.sin(t * 7.3);
    const banners = scene.userData.castle.userData.banners;
    for (let i = 0; i < banners.length; i++) { const b = banners[i], pos = b.geometry.attributes.position; for (let j = 0; j < pos.count; j++) { const x = pos.getX(j) + 1.1; pos.setZ(j, Math.sin(t * 4 + x * 2.2 + i) * 0.18 * x); } pos.needsUpdate = true; }
    for (const m of mists) { m.s.position.x += m.v * dt; if (m.s.position.x > 160) m.s.position.x = -160; }
    if (t > meteorAt && !meteor.visible) { meteor.visible = true; mFrom.set(-200 + Math.random() * 300, 230 + Math.random() * 60, -460); mTo.copy(mFrom).add(new T.Vector3(160 + Math.random() * 80, -90, 0)); meteor.userData.t0 = t; }
    if (meteor.visible) { const k = (t - meteor.userData.t0) / 1.1; if (k >= 1) { meteor.visible = false; meteorAt = t + 7 + Math.random() * 12; } else { meteor.position.lerpVectors(mFrom, mTo, k); meteor.material.opacity = Math.sin(k * Math.PI); } }
    renderer.render(scene, camera);
  };
  addEventListener('resize', resize); resize();
  if (opts.reduce) { clock.start(); clock.elapsedTime = 12; frame(0); return; }
  let last = performance.now();
  const loop = now => {
    requestAnimationFrame(loop);
    if (document.hidden) { last = now; return; }
    const dt = Math.min(0.05, (now - last) / 1000); last = now; clock.elapsedTime += dt; frame(dt);
  };
  requestAnimationFrame(loop);
};
