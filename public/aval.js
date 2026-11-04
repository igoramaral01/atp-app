// ---------- AVALIAÇÕES FÍSICAS + CORPO 3D ----------
// Usa os globais do app principal (CURATH, AID, FS, ROLE, esc, modal, etc.).
(function () {
  const PER = [
    ['pe', 'Pescoço'], ['tx', 'Tórax'],
    ['brD', 'Braço relaxado D'], ['brE', 'Braço relaxado E'],
    ['btD', 'Braço tensionado D'], ['btE', 'Braço tensionado E'],
    ['abD', 'Antebraço D'], ['abE', 'Antebraço E'],
    ['abdo', 'Abdômen'], ['cint', 'Cintura'], ['quad', 'Quadril'],
    ['puD', 'Punho D'], ['puE', 'Punho E'],
    ['csD', 'Coxa sup. D'], ['csE', 'Coxa sup. E'],
    ['cmD', 'Coxa média D'], ['cmE', 'Coxa média E'],
    ['ciD', 'Coxa inf. D'], ['ciE', 'Coxa inf. E'],
    ['suD', 'Tríceps sural D'], ['suE', 'Tríceps sural E'],
    ['toD', 'Tornozelo D'], ['toE', 'Tornozelo E'],
  ];
  const PERL = Object.fromEntries(PER);
  const num = v => { const n = parseFloat(String(v ?? '').replace(',', '.')); return isFinite(n) ? n : null; };
  const f1 = (v, d = 1) => v == null ? '–' : (Math.round(v * 10 ** d) / 10 ** d).toLocaleString('pt-BR');
  const fmtD = iso => iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : '';
  const avals = () => ((CURATH && CURATH.avals) || []).slice().sort((a, b) => String(a.data).localeCompare(String(b.data)));
  const imc = a => { const p = num(a.peso), h = num(a.altura); return p && h ? p / (h * h) : null; };
  const novoIdx = a => { const p = num(a.peso), h = num(a.altura); return p && h ? 1.3 * p / Math.pow(h, 2.5) : null; };
  const clsImc = v => v == null ? '' : v < 18.5 ? 'Abaixo do peso' : v < 25 ? 'Peso normal' : v < 30 ? 'Sobrepeso' : v < 35 ? 'Obesidade I' : v < 40 ? 'Obesidade II' : 'Obesidade III';
  const vo2Cooper = m => m ? (m - 504.9) / 44.73 : null;

  let sel = -1, cmpPrev = true, metric = 'peso';
  const fixSel = () => { const n = avals().length; if (sel < 0 || sel >= n) sel = n - 1; return sel; };

  // ---------- comparação ----------
  function deltas(a, b) {
    const out = {}; let dim = 0, seg = 0, aum = 0;
    for (const [k] of PER) {
      const x = num(a.per && a.per[k]), y = num(b && b.per && b.per[k]);
      if (x == null || y == null) continue;
      const d = x - y; out[k] = d;
      if (Math.abs(d) < 0.25) seg++; else if (d < 0) dim++; else aum++;
    }
    return { d: out, dim, seg, aum };
  }

  // ---------- corpo 3D (Three.js + superfície implícita) ----------
  // O corpo é uma "escultura" feita de formas arredondadas (elipsoides e cones arredondados)
  // fundidas suavemente; o tamanho de cada forma sai das medidas (circunferências).
  let three = null;
  const loadScript = src => new Promise((ok, err) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = err; document.head.appendChild(s); });
  async function loadThree() {
    if (!window.THREE) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js');
    if (!THREE.MarchingCubes) await loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/objects/MarchingCubes.js');
  }
  const rC = C => C / (2 * Math.PI) / 100;                               // circunferência (cm) -> raio (m)
  const eAx = (C, k) => { const a = C / (Math.PI * (1 + k)) / 100 * 1.02; return [a, a * k]; }; // elipse -> semieixos

  // primitivas: e = elipsoide {c:[x,y,z], r:[rx,ry,rz]}, c = cone arredondado {a:[..], b:[..], ra, rb}
  function bodyPrims(a, sexo) {
    const F = sexo !== 'M', m = k => num(a.per && a.per[k]);
    const H = num(a.altura) || (F ? 1.62 : 1.75), s = H / 1.65;
    const side = (k, d) => m(k) ?? d;
    const quad = m('quad') ?? (m('cint') && m('cint') > 95 ? m('cint') : (F ? 100 : 96));
    const cint = (m('cint') != null && m('cint') <= 95) ? m('cint') : (F ? 80 : 86);
    const abdo = m('abdo') ?? cint + 3, tx = m('tx') ?? (F ? 94 : 100), pe = m('pe') ?? (F ? 34 : 39);
    const P = []; let KK = 0.09; const E = (key, c, r, k) => P.push({ t: 'e', key, c, r, k: k ?? KK }), K = (key, A, B, ra, rb, k) => P.push({ t: 'c', key, a: A, b: B, ra, rb, k: k ?? KK });
    const Y = v => v * s;
    // tronco
    const [hx, hz] = eAx(quad, F ? 0.74 : 0.70); E('quad', [0, Y(0.875), -0.01 * s], [hx * 0.95, Y(0.13), hz * 0.93]);
    if (F) { const gr = rC(quad) * 0.43; E('quad', [-0.066 * s, Y(0.85), -hz * 0.4], [gr, gr * 1.05, gr * 0.95], 0.05); E('quad', [0.066 * s, Y(0.85), -hz * 0.4], [gr, gr * 1.05, gr * 0.95], 0.05); }
    const [ax, az] = eAx(abdo, 0.78); E('abdo', [0, Y(0.975), 0.01 * s], [ax * 0.93, Y(0.11), az * 0.93]);
    const [wx, wz] = eAx(cint, 0.72); E('cint', [0, Y(1.06), 0], [wx * 0.94, Y(0.11), wz * 0.94]);
    const [tx_, tz] = eAx(tx * (F ? 0.93 : 0.96), F ? 0.66 : 0.64); E('tx', [0, Y(1.2), -0.006 * s], [tx_ * 0.95, Y(0.14), tz * 0.97]);
    if (F) { const br = 0.055 * s * Math.max(0.8, Math.min(1.35, tx / 94)); E('tx', [-0.058 * s, Y(1.2), tz * 0.6], [br * 1.05, br * 0.95, br * 0.88], 0.045); E('tx', [0.058 * s, Y(1.2), tz * 0.6], [br * 1.05, br * 0.95, br * 0.88], 0.045); }
    else { E('tx', [-0.06 * s, Y(1.26), tz * 0.45], [0.075 * s, 0.05 * s, 0.045 * s], 0.05); E('tx', [0.06 * s, Y(1.26), tz * 0.45], [0.075 * s, 0.05 * s, 0.045 * s], 0.05); }
    const shW = (F ? 0.155 : 0.19) * s * Math.max(0.9, Math.min(1.15, tx / (F ? 94 : 100)));
    E('tx', [0, Y(1.345), -0.01 * s], [shW, Y(0.05), 0.065 * s]);
    K('pe', [0, Y(1.34), -0.005 * s], [0, Y(1.5), 0.005 * s], rC(pe) * 1.02, rC(pe) * 0.9, 0.05);
    E(null, [0, Y(1.585), 0.01 * s], [0.072 * s, 0.098 * s, 0.087 * s], 0.035);
    E(null, [0, Y(1.53), 0.045 * s], [0.045 * s, 0.038 * s, 0.04 * s], 0.03); // queixo/mandíbula
    // pernas
    KK = 0.022; const lx = (F ? 0.088 : 0.092) * s;
    for (const [S, sg] of [['D', -1], ['E', 1]]) {
      const cs = side('cs' + S, F ? 60 : 56), cm = side('cm' + S, cs * 0.88), ci = side('ci' + S, cs * 0.72), su = side('su' + S, F ? 36 : 38), to = side('to' + S, 22);
      const hip = [sg * lx, Y(0.83), 0], mid = [sg * lx * 0.97, Y(0.66), 0.004 * s], knee = [sg * lx * 0.86, Y(0.49), 0.012 * s], calf = [sg * lx * 0.84, Y(0.35), -0.016 * s], ank = [sg * lx * 0.82, Y(0.075), -0.01 * s];
      K('cs' + S, hip, mid, rC(cs) * 0.97, rC(cm) * 0.97);
      K('cm' + S, mid, knee, rC(cm) * 0.97, rC(ci) * 0.82);
      K('ci' + S, knee, calf, rC(ci) * 0.8, rC(su) * 0.98);
      K('su' + S, calf, [ank[0], Y(0.2), ank[2]], rC(su) * 0.98, rC(to) * 1.15);
      K('to' + S, [ank[0], Y(0.2), ank[2]], ank, rC(to) * 1.15, rC(to) * 0.95);
      E('to' + S, [ank[0] * 1.02, Y(0.035), 0.045 * s], [0.042 * s, 0.033 * s, 0.115 * s], 0.03); // pé
    }
    // braços
    for (const [S, sg] of [['D', -1], ['E', 1]]) {
      const br = side('br' + S, F ? 27 : 30), ab = side('ab' + S, br * 0.88), pu = side('pu' + S, F ? 15.5 : 17);
      const sh = [sg * (shW * 0.93), Y(1.335), -0.012 * s], el = [sg * (shW * 0.93 + 0.045 * s), Y(1.065), -0.03 * s], fm = [sg * (shW * 0.93 + 0.058 * s), Y(0.97), -0.012 * s], wr = [sg * (shW * 0.93 + 0.072 * s), Y(0.81), 0.01 * s];
      E('br' + S, [sh[0] * 1.0, sh[1] - 0.012 * s, sh[2]], [rC(br) * 1.22, rC(br) * 1.18, rC(br) * 1.12], 0.05); // deltoide
      K('br' + S, sh, el, rC(br) * 1.08, rC(ab) * 0.82);
      K('ab' + S, el, fm, rC(ab) * 0.82, rC(ab) * 1.0);
      K('pu' + S, fm, wr, rC(ab) * 1.0, rC(pu) * 0.95);
      E('pu' + S, [wr[0] + sg * 0.006 * s, Y(0.735), 0.016 * s], [0.026 * s, 0.07 * s, 0.045 * s]); // mão
    }
    return { P, H };
  }
  // distâncias com sinal
  function sdE(px, py, pz, p) { const [cx, cy, cz] = p.c, [rx, ry, rz] = p.r, x = px - cx, y = py - cy, z = pz - cz;
    const k0 = Math.hypot(x / rx, y / ry, z / rz), k1 = Math.hypot(x / (rx * rx), y / (ry * ry), z / (rz * rz)); return k1 ? k0 * (k0 - 1) / k1 : -Math.min(rx, ry, rz); }
  function sdC(px, py, pz, p) { // cone arredondado (aproximação por interpolação linear do raio)
    const [ax, ay, az] = p.a, [bx, by, bz] = p.b, bax = bx - ax, bay = by - ay, baz = bz - az, l2 = bax * bax + bay * bay + baz * baz;
    let t = ((px - ax) * bax + (py - ay) * bay + (pz - az) * baz) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t;
    const qx = px - ax - bax * t, qy = py - ay - bay * t, qz = pz - az - baz * t; return Math.hypot(qx, qy, qz) - (p.ra + (p.rb - p.ra) * t); }
  const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };

  const RES = 96;
  function buildGeometry(spec, colorOf) {
    const mc = three.mc, n = mc.size, half = mc.halfsize, S = spec.H * 0.56, yc = spec.H * 0.5, field = mc.field, pal = mc.palette, P = spec.P;
    const cols = P.map(p => colorOf(p.key));
    for (let z = 0; z < n; z++) { const wz = (z - half) / half * S;
      for (let y = 0; y < n; y++) { const wy = (y - half) / half * S + yc;
        for (let x = 0; x < n; x++) { const wx = (x - half) / half * S, q = x + y * n + z * n * n;
          if (Math.abs(wz) > 0.24 * spec.H / 1.65 || Math.abs(wx) > 0.46 * spec.H / 1.65 || wy < -0.01 || wy > spec.H * 1.08) { field[q] = -0.05; pal[q * 3] = pal[q * 3 + 1] = pal[q * 3 + 2] = 0.8; continue; }
          let d = 1e9, wr = 0, wg = 0, wb = 0, ws = 0;
          for (let i = 0; i < P.length; i++) { const p = P[i], di = p.t === 'e' ? sdE(wx, wy, wz, p) : sdC(wx, wy, wz, p);
            d = d === 1e9 ? di : smin(d, di, p.k);
            if (di < 0.06) { const w = Math.exp(-Math.max(di, 0) / 0.012) * (di < 0 ? 1 + Math.min(4, -di * 60) : 1), c = cols[i]; wr += w * c[0]; wg += w * c[1]; wb += w * c[2]; ws += w; } }
          field[q] = -d; if (ws) { pal[q * 3] = wr / ws; pal[q * 3 + 1] = wg / ws; pal[q * 3 + 2] = wb / ws; } else { pal[q * 3] = BASE[0]; pal[q * 3 + 1] = BASE[1]; pal[q * 3 + 2] = BASE[2]; }
        } } }
    mc.isolation = 0;
    const g = mc.generateBufferGeometry();
    g.scale(S, S, S); g.translate(0, yc, 0); // de volta para metros
    return g;
  }

  const BASE = [0.88, 0.87, 0.9], GREEN = [0.24, 0.84, 0.22], RED = [0.93, 0.18, 0.18];
  function colorFn(dmap) {
    return key => {
      if (!cmpPrev || !key || dmap[key] == null) return BASE;
      const d = dmap[key]; if (Math.abs(d) < 0.25) return BASE;
      const t = 0.5 + 0.5 * Math.min(1, Math.abs(d) / 3), C = d < 0 ? GREEN : RED;
      return [BASE[0] + (C[0] - BASE[0]) * t, BASE[1] + (C[1] - BASE[1]) * t, BASE[2] + (C[2] - BASE[2]) * t];
    };
  }
  function initThree(el) {
    const W = el.clientWidth || 320, Hh = el.clientHeight || 460;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); renderer.setSize(W, Hh);
    renderer.outputEncoding = THREE.sRGBEncoding;
    el.innerHTML = ''; el.appendChild(renderer.domElement);
    const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(28, W / Hh, 0.1, 20);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x2a2a33, 0.75));
    const key = new THREE.DirectionalLight(0xffffff, 0.95); key.position.set(1.6, 2.6, 2.4); scene.add(key);
    const rim = new THREE.DirectionalLight(0xa95ee8, 0.55); rim.position.set(-2.2, 1.4, -1.8); scene.add(rim);
    const rim2 = new THREE.DirectionalLight(0x3fd93a, 0.18); rim2.position.set(2.2, 0.8, -2); scene.add(rim2);
    const grp = new THREE.Group(); scene.add(grp);
    const floor = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.42, 64), new THREE.MeshBasicMaterial({ color: 0x24242b, transparent: true, opacity: 0.9 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = 0.001; scene.add(floor);
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.2, 48), new THREE.MeshBasicMaterial({ color: 0x050507, transparent: true, opacity: 0.65 })); shadow.rotation.x = -Math.PI / 2; scene.add(shadow);
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.48, metalness: 0.04 });
    const mc = new THREE.MarchingCubes(RES, mat, false, true);
    three = { renderer, scene, cam, grp, mat, mc, el, mesh: null, rotY: 0.5, auto: true, job: 0 };
    window.__atp3d = () => three;
    let drag = null; const cv = renderer.domElement; cv.style.touchAction = 'pan-y'; cv.style.cursor = 'grab';
    cv.addEventListener('pointerdown', e => { drag = { x: e.clientX, r: three.rotY }; three.auto = false; cv.setPointerCapture(e.pointerId); cv.style.cursor = 'grabbing'; });
    cv.addEventListener('pointermove', e => { if (drag) three.rotY = drag.r + (e.clientX - drag.x) * 0.012; });
    cv.addEventListener('pointerup', () => { drag = null; cv.style.cursor = 'grab'; });
    cv.addEventListener('dblclick', () => { three.auto = !three.auto; });
    new ResizeObserver(() => { const w = el.clientWidth, h = el.clientHeight; if (!w || !h) return; renderer.setSize(w, h); cam.aspect = w / h; cam.updateProjectionMatrix(); }).observe(el);
    const loop = () => { requestAnimationFrame(loop); if (!el.isConnected || el.offsetParent === null) return; if (three.auto) three.rotY += 0.005; grp.rotation.y = three.rotY; renderer.render(scene, cam); };
    loop();
  }
  const mixP = (A, B, t) => ({ H: A.H + (B.H - A.H) * t, P: A.P.map((p, i) => { const q = B.P[i], o = { ...p }; for (const k of ['c', 'r', 'a', 'b']) if (p[k]) o[k] = p[k].map((v, j) => v + (q[k][j] - v) * t); if (p.ra != null) { o.ra = p.ra + (q.ra - p.ra) * t; o.rb = p.rb + (q.rb - p.rb) * t; } return o; }) });
  function setMesh(spec, colorOf) {
    const g = buildGeometry(spec, colorOf);
    if (three.mesh) { three.grp.remove(three.mesh); three.mesh.geometry.dispose(); }
    three.mesh = new THREE.Mesh(g, three.mat); three.grp.add(three.mesh);
    three.cam.position.set(0, spec.H * 0.55, spec.H * 2.25); three.cam.lookAt(0, spec.H * 0.5, 0);
    three.spec = spec;
  }
  async function show3D(a, prev, sexo, rootEl) {
    const el = rootEl.querySelector('.av3d'); if (!el) return;
    try { await loadThree(); } catch (e) { el.innerHTML = '<div class="empty">Não consegui carregar o 3D. Verifique a internet.</div>'; return; }
    if (!three || three.el !== el) { three = null; initThree(el); }
    const spec = bodyPrims(a, sexo), col = colorFn(prev ? deltas(a, prev).d : {}), job = ++three.job;
    const from = three.spec && three.sexo === sexo && three.spec.P.length === spec.P.length ? three.spec : null; three.sexo = sexo;
    if (!from) return setMesh(spec, col);
    // transição suave: alguns quadros intermediários
    const steps = [0.25, 0.5, 0.75, 1]; let i = 0;
    const next = () => { if (job !== three.job) return; setMesh(i < steps.length - 1 ? mixP(from, spec, steps[i]) : spec, col); if (i < steps.length - 1) { i++; setTimeout(next, 30); } };
    next();
  }

  // ---------- gráfico de evolução ----------
  const METRICS = [['peso', 'Peso (kg)'], ['gordura', '% Gordura'], ['imc', 'IMC'], ['vo2', 'VO₂ máx (ml/kg/min)'], ['cooper', 'Cooper (m)'], ['shuttle', 'Shuttle Run (s)'], ['flexao', 'Flexão (reps)'], ['abdRem', 'Abd. remador (reps)'], ...PER.map(([k, l]) => ['per.' + k, l + ' (cm)'])];
  const getM = (a, k) => k === 'imc' ? imc(a) : k.startsWith('per.') ? num(a.per && a.per[k.slice(4)]) : num(a[k]);
  function evoChart(list, k, label) {
    const pts = list.map(a => ({ iso: a.data, v: getM(a, k) })).filter(p => p.v != null);
    if (pts.length < 2) return '<div class="empty">Precisa de pelo menos 2 avaliações com esse dado para mostrar a evolução.</div>';
    const W = 900, H = 300, L0 = 56, R0 = W - 24, T0 = 24, B0 = H - 44;
    const vs = pts.map(p => p.v), mn = Math.min(...vs), mx = Math.max(...vs), pad = (mx - mn) * 0.2 || 1, lo = mn - pad, hi = mx + pad;
    const x = i => L0 + i * (R0 - L0) / (pts.length - 1), y = v => B0 - (v - lo) / (hi - lo) * (B0 - T0);
    let g = '';
    for (let i = 0; i <= 4; i++) { const v = lo + (hi - lo) * i / 4; g += `<line x1="${L0}" x2="${R0}" y1="${y(v)}" y2="${y(v)}" stroke="#2a2a30"/><text x="${L0 - 8}" y="${y(v) + 4}" fill="#9a9aa3" font-size="12" text-anchor="end" font-family="JetBrains Mono">${f1(v)}</text>`; }
    pts.forEach((p, i) => { g += `<text x="${x(i)}" y="${B0 + 22}" fill="#9a9aa3" font-size="11" text-anchor="middle" font-family="JetBrains Mono">${p.iso.slice(5, 7)}/${p.iso.slice(2, 4)}</text>`; });
    g += `<path d="${pts.map((p, i) => (i ? 'L' : 'M') + x(i) + ' ' + y(p.v)).join('')}" fill="none" stroke="#a95ee8" stroke-width="3" stroke-linejoin="round"/>`;
    g += pts.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.v)}" r="5" fill="#a95ee8"><title>${fmtD(p.iso)}: ${f1(p.v, 2)}</title></circle><text x="${x(i)}" y="${y(p.v) - 11}" fill="#f2f2f2" font-size="12" font-weight="700" text-anchor="middle">${f1(p.v)}</text>`).join('');
    const d = pts[pts.length - 1].v - pts[0].v;
    return `<div class="kpis" style="margin-bottom:8px"><div><b>${f1(pts[0].v)}</b><span>primeira · ${fmtD(pts[0].iso)}</span></div><div><b>${f1(pts[pts.length - 1].v)}</b><span>última · ${fmtD(pts[pts.length - 1].iso)}</span></div><div><b>${d > 0 ? '+' : ''}${f1(d)}</b><span>variação total</span></div></div>
      <div class="scroll gchart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Evolução de ${esc(label)}">${g}</svg></div>`;
  }

  // ---------- tela ----------
  function root(id) { return document.getElementById(id); }
  window.renderAvals = function (where) {
    const el = root(where || 'av-root'); if (!el) return;
    const coach = where !== 'a-av-root' && ROLE !== 'athlete';
    const L = avals(), sexo = (CURATH && CURATH.sexo) || 'F';
    if (!L.length) {
      el.innerHTML = `<div class="empty">Nenhuma avaliação lançada ainda.${coach ? ' Clique em <b>+ Nova avaliação</b> para começar.' : ''}</div>
        ${coach ? `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button class="mini" data-av="new">+ Nova avaliação</button><label class="mini ghost" style="cursor:pointer">Importar avaliações (PDF)<input type="file" accept=".pdf,application/pdf,.json,application/json" data-avimp hidden></label></div>` : ''}`;
      return;
    }
    if (sel < 0 || sel >= L.length) sel = L.length - 1;
    const a = L[sel], prev = sel > 0 ? L[sel - 1] : null, D = prev ? deltas(a, prev) : null, I = imc(a), NI = novoIdx(a);
    const cell = (lab, val, sub) => `<div class="avk"><span>${lab}</span><b>${val}</b>${sub ? `<small>${sub}</small>` : ''}</div>`;
    const dv = (k, unit = '', inv = false) => { if (!prev) return ''; const x = getM(a, k), y = getM(prev, k); if (x == null || y == null) return ''; const d = x - y; if (Math.abs(d) < 0.005) return '<i class="dz">=</i>'; const good = inv ? d > 0 : d < 0; return `<i class="${good ? 'dg' : 'dr'}">${d > 0 ? '+' : ''}${f1(d, 2)}${unit}</i>`; };
    el.innerHTML = `
     <div class="avtop">
       <div class="avdates" role="tablist" aria-label="Avaliações">${L.map((x, i) => `<button role="tab" aria-selected="${i === sel}" data-sel="${i}">${fmtD(x.data).slice(0, 5)}<small>${x.data.slice(0, 4)}</small></button>`).join('')}</div>
       ${coach ? `<div class="avact"><button class="mini ghost" data-av="sexo">Modelo: ${sexo === 'M' ? 'Masculino' : 'Feminino'}</button><label class="mini ghost" style="cursor:pointer">Importar PDF<input type="file" accept=".pdf,application/pdf,.json,application/json" data-avimp hidden></label><button class="mini ghost" data-av="edit">Editar</button><button class="mini ghost" data-av="pdf">Gerar ficha (PDF)</button><button class="mini" data-av="new">+ Nova avaliação</button></div>` : ''}
     </div>
     <div class="avgrid">
       <div class="card av3card">
         <div class="avhead"><b>${fmtD(a.data)}</b><small>${esc(a.tipo || 'Avaliação Física')}${prev ? ' · comparando com ' + fmtD(prev.data) : ' · avaliação base'}</small></div>
         <div class="av3d" aria-label="Corpo 3D montado com as medidas desta avaliação. Arraste para girar."></div>
         <input type="range" id="av-slide" min="0" max="${L.length - 1}" value="${sel}" aria-label="Passar pelas avaliações">
         <div class="avleg"><label><input type="checkbox" id="av-cmp" ${cmpPrev ? 'checked' : ''}> Cores da comparação</label><span class="lg g">diminuiu</span><span class="lg z">manteve</span><span class="lg r">aumentou</span></div>
         ${D ? `<div class="avcount"><span class="g">${D.dim} diminuições</span><span>${D.seg} seguiram</span><span class="r">${D.aum} aumentos</span></div>` : ''}
         <p class="note" style="margin:6px 0 0">Corpo ilustrativo montado com as medidas. Arraste para girar.</p>
       </div>
       <div class="avright">
         <div class="avkpis">
           ${cell('Peso', f1(num(a.peso)) + ' kg', dv('peso', ' kg'))}${cell('Altura', f1(num(a.altura), 3) + ' m')}${cell('Idade', a.idade ?? '–')}
           ${cell('IMC', f1(I, 2), clsImc(I) + ' ' + dv('imc'))}${cell('Novo índice', f1(NI, 2), clsImc(NI))}${cell('% Gordura', a.gordura != null ? f1(num(a.gordura)) + '%' : '–', dv('gordura', '%'))}
           ${cell('VO₂ máx', a.vo2 != null ? f1(num(a.vo2), 2) : '–', 'ml/kg/min ' + dv('vo2', '', true))}${cell('Água', a.agua != null ? f1(num(a.agua), 0) + ' ml' : '–', 'por dia')}${cell('Metab. basal', a.tmb != null ? f1(num(a.tmb), 0) : '–', 'kcal')}
         </div>
         <div class="card"><h3 class="avh3">Testes</h3><div class="avtests">
           ${cell('Cooper (12 min)', a.cooper != null ? f1(num(a.cooper), 0) + ' m' : '–', a.cooper ? 'VO₂ estimado ' + f1(vo2Cooper(num(a.cooper)), 2) + ' ' + dv('cooper', ' m', true) : '')}
           ${cell('Shuttle Run', a.shuttle != null ? f1(num(a.shuttle), 2) + ' s' : '–', dv('shuttle', ' s'))}
           ${cell('Flexão de cotovelo', a.flexao ?? '–', esc(a.flexaoCl || '') + ' ' + dv('flexao', '', true))}
           ${cell('Abdominal remador', a.abdRem ?? '–', esc(a.abdRemCl || '') + ' ' + dv('abdRem', '', true))}
         </div>${a.extra ? `<p class="avobs"><b>${esc(a.extra)}</b></p>` : ''}${a.cooperObs ? `<p class="avobs"><b>Cooper:</b> ${esc(a.cooperObs)}</p>` : ''}${a.shuttleObs ? `<p class="avobs"><b>Shuttle:</b> ${esc(a.shuttleObs)}</p>` : ''}</div>
       </div>
     </div>
     <div class="card" style="margin-top:16px"><div class="rhead"><h3 class="avh3" style="margin:0">Perimetria corporal (cm)</h3>${coach ? '<small style="color:var(--mute)">Toque num valor para editar. Salva sozinho.</small>' : ''}</div><div class="pertab">${PER.map(([k, l]) => { const v = num(a.per && a.per[k]); const d = D && D.d[k]; const cls = d == null ? '' : Math.abs(d) < 0.25 ? 'z' : d < 0 ? 'g' : 'r'; return `<div class="pr"><span>${l}</span>${coach ? `<input class="pin ${cls}" data-pk="${k}" inputmode="decimal" value="${v == null ? '' : String(v).replace('.', ',')}" placeholder="–" aria-label="${l} em cm">` : `<b class="${cls}">${v == null ? '–' : f1(v, 2)}</b>`}<i class="${cls}">${d == null || Math.abs(d) < 0.25 ? (d == null ? '' : '=') : (d > 0 ? '+' : '') + f1(d, 2)}</i></div>`; }).join('')}</div></div>
     ${a.obs || a.saude || a.medic ? `<div class="card" style="margin-top:16px"><h3 class="avh3">Observações</h3>${a.obs ? `<p class="avobs" style="white-space:pre-line">${esc(a.obs)}</p>` : ''}<div class="avmeta">${a.avaliador ? `<span><b>Avaliador:</b> ${esc(a.avaliador)}</span>` : ''}${a.saude ? `<span><b>Histórico de saúde:</b> ${esc(a.saude)}</span>` : ''}${a.medic ? `<span><b>Medicamentos:</b> ${esc(a.medic)}</span>` : ''}${a.risco ? `<span><b>Risco cardiovascular:</b> ${esc(a.risco)}</span>` : ''}${a.consid ? `<span><b>Considerações:</b> ${esc(a.consid)}</span>` : ''}</div></div>` : ''}
     <div class="card" style="margin-top:16px"><div class="rhead"><h3 class="avh3" style="margin:0">Evolução</h3><select id="av-metric" aria-label="Escolha o dado">${METRICS.map(([k, l]) => `<option value="${k}" ${k === metric ? 'selected' : ''}>${l}</option>`).join('')}</select></div><div id="av-evo">${evoChart(L, metric, (METRICS.find(m => m[0] === metric) || [, ''])[1])}</div></div>`;
    show3D(a, prev, sexo, el);
  };

  // ---------- formulário ----------
  function form(a) {
    const isNew = !a; a = a || { data: new Date().toISOString().slice(0, 10), avaliador: (AUTH.currentUser && AUTH.currentUser.displayName) || '', tipo: 'Avaliação Física', per: {} };
    const last = avals().slice(-1)[0];
    if (isNew && last) { a.altura = last.altura; a.idade = last.idade; a.saude = last.saude; a.medic = last.medic; a.risco = last.risco; a.consid = last.consid; }
    const inp = (k, l, t = 'text', ph = '') => `<label class="fl"><span>${l}</span><input id="fa-${k}" type="${t}" ${t === 'number' ? 'step="any" inputmode="decimal"' : ''} value="${esc(a[k] ?? '')}" placeholder="${ph}"></label>`;
    modal.innerHTML = `<div class="mbox avform"><button class="x" aria-label="Fechar">×</button><div class="eyebrow">${isNew ? 'Nova avaliação' : 'Editar avaliação'}</div>
      <div class="fgrid">${inp('data', 'Data', 'date')}${inp('tipo', 'Tipo')}${inp('avaliador', 'Avaliador')}${inp('idade', 'Idade', 'number')}</div>
      <h4>Corpo</h4><div class="fgrid">${inp('peso', 'Peso (kg)', 'number')}${inp('altura', 'Altura (m)', 'number', '1,65')}${inp('gordura', '% Gordura', 'number')}${inp('vo2', 'VO₂ máx', 'number', 'auto pelo Cooper')}${inp('agua', 'Água (ml/dia)', 'number', 'auto: 35 ml × peso')}${inp('tmb', 'Taxa metab. basal', 'number')}</div>
      <h4>Perimetria (cm)</h4><div class="fgrid per">${PER.map(([k, l]) => `<label class="fl"><span>${l}</span><input id="fp-${k}" type="number" step="any" inputmode="decimal" value="${esc(a.per && a.per[k] != null ? a.per[k] : '')}"></label>`).join('')}</div>
      <h4>Testes</h4><div class="fgrid">${inp('cooper', 'Cooper (metros)', 'number')}${inp('shuttle', 'Shuttle Run (s)', 'number')}${inp('flexao', 'Flexão (reps)', 'number')}${inp('flexaoCl', 'Classificação flexão')}${inp('abdRem', 'Abd. remador (reps)', 'number')}${inp('abdRemCl', 'Classificação abdominal')}</div>
      <div class="fgrid one">${inp('extra', 'Outro teste (ex.: 5 km em 32:25)')}${inp('cooperObs', 'Obs. Cooper')}${inp('shuttleObs', 'Obs. Shuttle')}</div>
      <h4>Saúde e observações</h4><div class="fgrid">${inp('saude', 'Histórico de saúde')}${inp('medic', 'Medicamentos')}${inp('risco', 'Risco cardiovascular')}${inp('consid', 'Considerações gerais')}</div>
      <label class="fl one"><span>Objetivo / observação</span><textarea id="fa-obs" rows="3">${esc(a.obs || '')}</textarea></label>
      <div class="amsg" id="fa-msg"></div>
      <div style="display:flex;gap:8px;justify-content:space-between;flex-wrap:wrap;margin-top:8px">${isNew ? '<span></span>' : `<button class="mini ghost warn" id="fa-del">Excluir avaliação</button>`}<button class="big" id="fa-save" style="padding:12px 22px">Salvar avaliação</button></div></div>`;
    modal.hidden = false;
    const g = id => document.getElementById(id);
    g('fa-del') && (g('fa-del').onclick = e => { const b = e.target; if (!b.dataset.arm) { b.dataset.arm = 1; b.textContent = 'Toque de novo para excluir'; return; } sel = -1; saveList(avals().filter(x => x.id !== a.id)).then(() => { close(); renderAvals('av-root'); }); });
    g('fa-save').onclick = async () => {
      const o = { ...a, per: {} };
      for (const k of ['data', 'tipo', 'avaliador', 'flexaoCl', 'abdRemCl', 'extra', 'cooperObs', 'shuttleObs', 'saude', 'medic', 'risco', 'consid']) o[k] = g('fa-' + k).value.trim();
      for (const k of ['idade', 'peso', 'altura', 'gordura', 'vo2', 'agua', 'tmb', 'cooper', 'shuttle', 'flexao', 'abdRem']) { const v = num(g('fa-' + k).value); if (v == null) delete o[k]; else o[k] = v; }
      if (o.altura && o.altura > 3) o.altura = o.altura / 100;
      for (const [k] of PER) { const v = num(g('fp-' + k).value); if (v != null) o.per[k] = v; }
      o.obs = g('fa-obs').value.trim();
      if (o.vo2 == null && o.cooper) o.vo2 = Math.round(vo2Cooper(o.cooper) * 100) / 100;
      if (o.agua == null && o.peso) o.agua = Math.round(o.peso * 35 * 10) / 10;
      if (!o.data) { g('fa-msg').className = 'amsg err'; g('fa-msg').textContent = 'Preencha a data.'; return; }
      o.id = o.id || rid();
      const L = avals().filter(x => x.id !== o.id); L.push(o);
      await saveList(L); sel = avals().findIndex(x => x.id === o.id); close(); renderAvals('av-root');
    };
  }
  async function saveList(L) {
    const clean = JSON.parse(JSON.stringify(L.sort((a, b) => String(a.data).localeCompare(String(b.data)))));
    CURATH.avals = clean; renderAvals('av-root');
    setSync('Salvando…');
    try { await FS.collection('athletes').doc(AID).update({ avals: clean }); setSync('Salvo ✓'); } catch (e) { setSync('Não consegui salvar a avaliação.', 1); }
  }

  // ---------- ficha para imprimir / salvar em PDF ----------
  function ficha() {
    fixSel(); const L = avals(), a = L[sel]; if (!a) return; const prev = sel > 0 ? L[sel - 1] : null, D = prev ? deltas(a, prev) : null, I = imc(a);
    let img = ''; try { if (three && three.renderer) { three.renderer.render(three.scene, three.cam); img = three.renderer.domElement.toDataURL('image/png'); } } catch (e) {}
    const col = d => d == null ? '' : Math.abs(d) < 0.25 ? '#777' : d < 0 ? '#1f9d1a' : '#d81e1e';
    const rows = PER.map(([k, l]) => { const v = num(a.per && a.per[k]), pv = prev && num(prev.per && prev.per[k]), d = D && D.d[k];
      return `<tr><td>${l}</td><td>${pv == null ? '–' : f1(pv, 2)}</td><td style="color:${col(d)};font-weight:700">${v == null ? '–' : f1(v, 2)}</td><td style="color:${col(d)}">${d == null ? '' : Math.abs(d) < 0.25 ? '=' : (d > 0 ? '+' : '') + f1(d, 2)}</td></tr>`; }).join('');
    const kv = (l, v) => `<div class="kv"><span>${l}</span><b>${v}</b></div>`;
    const nome = esc((CURATH && CURATH.nome) || '');
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Avaliação ${nome} ${fmtD(a.data)}</title><style>
      @page{size:A4;margin:12mm}*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:0;font-size:12px}
      header{display:flex;align-items:center;gap:14px;border-bottom:4px solid;border-image:linear-gradient(90deg,#ee2b2b 33%,#3fd93a 33% 66%,#a95ee8 66%) 1;padding-bottom:10px;margin-bottom:12px}
      header img{width:56px;height:56px}header h1{margin:0;font-size:20px;font-style:italic}header p{margin:2px 0 0;color:#555}
      .grid{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-bottom:12px}.kv{border:1px solid #ddd;border-radius:6px;padding:6px 8px}.kv span{display:block;font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#666}.kv b{font-size:15px}
      .two{display:grid;grid-template-columns:230px 1fr;gap:14px;align-items:start}.body{background:#111;border-radius:8px;text-align:center}.body img{width:100%}
      table{width:100%;border-collapse:collapse}th,td{border-bottom:1px solid #e3e3e3;padding:4px 6px;text-align:left}th{background:#111;color:#fff;font-size:10px;text-transform:uppercase}
      .cnt{display:flex;gap:16px;font-weight:700;margin:8px 0}.g{color:#1f9d1a}.r{color:#d81e1e}h2{font-size:12px;text-transform:uppercase;letter-spacing:1.5px;margin:14px 0 6px}
      .obs{white-space:pre-line;color:#333;line-height:1.45}footer{margin-top:16px;color:#888;font-size:10px}</style></head><body>
      <header><img src="${location.origin}/img/icon-192.png" alt=""><div><h1>ATP — AVALIAÇÃO FÍSICA</h1><p>${nome} · ${fmtD(a.data)} · ${esc(a.tipo || '')} · Avaliador: ${esc(a.avaliador || '')}</p></div></header>
      <div class="grid">${kv('Peso', f1(num(a.peso)) + ' kg')}${kv('Altura', f1(num(a.altura), 3) + ' m')}${kv('Idade', a.idade ?? '–')}${kv('IMC', f1(I, 2) + ' · ' + clsImc(I))}${kv('Novo índice', f1(novoIdx(a), 2))}
        ${kv('% Gordura', a.gordura != null ? f1(num(a.gordura)) + '%' : '–')}${kv('VO₂ máx', a.vo2 != null ? f1(num(a.vo2), 2) : '–')}${kv('Água/dia', a.agua != null ? f1(num(a.agua), 0) + ' ml' : '–')}${kv('Metab. basal', a.tmb != null ? f1(num(a.tmb), 0) : '–')}${kv('Cooper', a.cooper != null ? f1(num(a.cooper), 0) + ' m' : '–')}</div>
      <div class="two"><div class="body">${img ? `<img src="${img}" alt="Corpo 3D">` : ''}</div><div>
        ${D ? `<div class="cnt"><span class="g">${D.dim} diminuições</span><span>${D.seg} seguiram</span><span class="r">${D.aum} aumentos</span></div>` : '<div class="cnt">Avaliação base</div>'}
        <table><thead><tr><th>Perimetria (cm)</th><th>${prev ? fmtD(prev.data) : 'Anterior'}</th><th>${fmtD(a.data)}</th><th>Δ</th></tr></thead><tbody>${rows}</tbody></table></div></div>
      <h2>Testes</h2><div class="grid">${kv('Cooper (12 min)', a.cooper != null ? f1(num(a.cooper), 0) + ' m' : '–')}${kv('Shuttle Run', a.shuttle != null ? f1(num(a.shuttle), 2) + ' s' : '–')}${kv('Flexão', (a.flexao ?? '–') + (a.flexaoCl ? ' · ' + esc(a.flexaoCl) : ''))}${kv('Abd. remador', (a.abdRem ?? '–') + (a.abdRemCl ? ' · ' + esc(a.abdRemCl) : ''))}${kv('Outro', esc(a.extra || '–'))}</div>
      ${a.obs || a.cooperObs || a.shuttleObs ? `<h2>Observações</h2><div class="obs">${esc([a.obs, a.cooperObs && 'Cooper: ' + a.cooperObs, a.shuttleObs && 'Shuttle: ' + a.shuttleObs].filter(Boolean).join('\n'))}</div>` : ''}
      <footer>Amaral Training Performance · gerado em ${new Date().toLocaleDateString('pt-BR')}</footer>
      <script>window.onload=()=>setTimeout(()=>window.print(),300)<\/script></body></html>`;
    const w = window.open('', '_blank'); if (!w) { setSync('Libere pop-ups para gerar a ficha.', 1); return; }
    w.document.open(); w.document.write(html); w.document.close();
  }

  // ---------- importar PDF da ficha de coleta ----------
  function loadPdfJs() {
    return window.pdfjsLib ? Promise.resolve() : new Promise((ok, err) => {
      const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'; ok(); }; s.onerror = err; document.head.appendChild(s);
    });
  }
  // agrupa os pedaços de texto em linhas; colunas separadas por " | "
  function linesOf(tc) {
    const it = tc.items.filter(i => i.str.trim()).map(i => ({ s: i.str, x: i.transform[4], y: i.transform[5], w: i.width }));
    it.sort((a, b) => b.y - a.y || a.x - b.x);
    const rows = [];
    for (const i of it) { const r = rows.find(r => Math.abs(r.y - i.y) < 3); if (r) r.it.push(i); else rows.push({ y: i.y, it: [i] }); }
    return rows.sort((a, b) => b.y - a.y).map(r => { r.it.sort((a, b) => a.x - b.x); let out = '', end = null; for (const i of r.it) { out += end == null ? i.s : (i.x - end > 14 ? ' | ' : (i.x - end > 1 ? ' ' : '')) + i.s; end = i.x + i.w; } return out.replace(/\s+/g, ' ').trim(); });
  }
  const nb = s => s == null ? null : num(String(s).replace(/\.(?=\d{3}\b)/, '').replace(',', '.'));
  function parsePage(L) {
    const T = L.join('\n'), a = { per: {} };
    const dm = T.match(/(\d{2})\/(\d{2})\/(\d{4})/); if (!dm) return null; a.data = `${dm[3]}-${dm[2]}-${dm[1]}`;
    const hdr = L.find(l => l.includes(dm[0]));
    if (hdr) { const c = hdr.split(' | '); if (c.length >= 4) { a.avaliador = c[0]; a.tipo = c[2]; } }
    const body = L.find(l => /^\d{2,3}[,.]\d\s*\|\s*(1[,.]\d{1,3}|1\d{2})\s*\|\s*\d{2}\b/.test(l));
    if (body) { const c = body.split(' | '); a.peso = nb(c[0]); let h = nb(c[1]); if (h > 3) h = h / 100; a.altura = h; a.idade = nb(c[2]); }
    const g = T.match(/(?:Sobrepeso|Normal|Eutr[oó]fic\w*|Obesidade[^|\n]*|Abaixo[^|\n]*)\s*(?:\|\s*)?%?\s*(\d{1,2}(?:[,.]\d+)?)\s*%?\s*(?:\n|\|)/i); if (g) a.gordura = nb(g[1]);
    const v = T.match(/(\d{1,2}[,.]\d+)\s*ml\/kg/i); if (v) a.vo2 = nb(v[1]);
    const at = L.find(l => /(^|\| )\d{4}(?:[,.]\d+)?\s*\|\s*\d{3,4}(?:[,.]\d+)?(\s|$|\|)/.test(l) && !/\d{2}\/\d{2}/.test(l));
    if (at) { const m = at.match(/(\d{4}(?:[,.]\d+)?)\s*\|\s*(\d{3,4}(?:[,.]\d+)?)/); a.agua = nb(m[1]); a.tmb = Math.round(nb(m[2]) * 100) / 100; }
    const co = T.match(/(\d[.,]\d{1,3})\s*(KM|metros)/i); if (co) { const x = nb(co[1].replace('.', ',')); a.cooper = Math.round(x < 10 ? x * 1000 : x); }
    let sh = T.match(/(\d{1,2}[.,]\d{1,2})\s*(?:segundos|seg)/i);
    if (!sh) { const i = L.findIndex(l => /KM.*12\s*min/i.test(l)); if (i >= 0) sh = (L[i] + ' ' + (L[i + 1] || '')).match(/\|\s*(\d{1,2}[.,]\d{1,2})\b/); }
    if (sh) a.shuttle = nb(sh[1]);
    const fx = L.find(l => /^\d{1,3}\s*\|\s*[A-Za-zÀ-ú][A-Za-zÀ-ú ]*\|\s*\d{1,3}\s*\|\s*[A-Za-zÀ-ú]/.test(l));
    if (fx) { const c = fx.split(' | '); a.flexao = nb(c[0]); a.flexaoCl = c[1]; a.abdRem = nb(c[2]); a.abdRemCl = c[3]; }
    else { const ci = L.findLastIndex(l => /CLASSIFICA/i.test(l)); if (ci >= 0) { const n = (L[ci + 1] || '').match(/^(\d{1,3})\s*\|\s*(\d{1,3})$/), cl = (L[ci + 2] || '').split(' | ');
      if (n) { a.flexao = nb(n[1]); a.abdRem = nb(n[2]); if (cl.length >= 2 && !/\d/.test(cl.join(''))) { a.flexaoCl = cl[0]; a.abdRemCl = cl[1]; } } } }
    const obs = []; let on = false;
    for (const l of L) { if (/^(OBJETIVO|OBSERVAÇÃO|META)\b/i.test(l)) on = true; else if (/^(TESTE|RESULTADO|FLEX|ABD)/i.test(l)) on = false; if (on) obs.push(l.replace(/\s*\|\s*/g, ' ')); }
    if (obs.length) a.obs = obs.join('\n');
    const oc = L.filter(l => /^OBS:/i.test(l)); if (oc.length) a.cooperObs = oc.join(' ').replace(/\s*\|\s*/g, ' / ');
    const tp = T.match(/TEMPO:\s*([\d:]+)/i), rt = T.match(/RITMO:\s*([\d:]+)/i); if (tp) a.extra = 'TESTE 5 km: tempo ' + tp[1] + (rt ? ' · ritmo ' + rt[1] + '/km' : '');
    for (const k in a) if (a[k] == null) delete a[k];
    return a;
  }
  async function importPDF(file) {
    modal.innerHTML = '<div class="mbox"><div class="eyebrow">Importar avaliações</div><p>Lendo ' + esc(file.name) + '…</p></div>'; modal.hidden = false;
    try {
      await loadPdfJs();
      const doc = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise, found = [];
      for (let p = 1; p <= doc.numPages; p++) {
        const pg = await doc.getPage(p), a = parsePage(linesOf(await pg.getTextContent())); if (!a) continue;
        // imagem do corpo (perimetria) desta página, para conferir e digitar as medidas
        const vp = pg.getViewport({ scale: 2 }), cv = document.createElement('canvas'); cv.width = vp.width; cv.height = vp.height;
        await pg.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
        const W = vp.width, H = vp.height, cx = W * 0.083, cy = H * 0.318, cw = W * 0.47, ch = H * 0.23, c2 = document.createElement('canvas'); c2.width = cw; c2.height = ch;
        c2.getContext('2d').drawImage(cv, cx, cy, cw, ch, 0, 0, cw, ch); a._img = c2.toDataURL('image/jpeg', 0.85); found.push(a);
      }
      if (!found.length) { modal.innerHTML = '<div class="mbox"><button class="x" aria-label="Fechar">×</button><p class="amsg err">Não encontrei avaliações neste PDF. Ele precisa ser a ficha de coleta exportada com texto (não uma foto escaneada).</p></div>'; return; }
      review(found);
    } catch (e) { modal.innerHTML = '<div class="mbox"><button class="x" aria-label="Fechar">×</button><p class="amsg err">Não consegui ler o PDF (' + esc(e.message || e) + ').</p></div>'; }
  }
  function review(found) {
    const ex = new Set(avals().map(x => x.data)), F = [['peso', 'Peso'], ['altura', 'Altura (m)'], ['idade', 'Idade'], ['gordura', '% Gord.'], ['vo2', 'VO₂'], ['agua', 'Água'], ['tmb', 'TMB'], ['cooper', 'Cooper (m)'], ['shuttle', 'Shuttle (s)'], ['flexao', 'Flexão'], ['abdRem', 'Abd. rem.']];
    modal.innerHTML = `<div class="mbox avform" style="width:min(1000px,100%)"><button class="x" aria-label="Fechar">×</button><div class="eyebrow">Importar avaliações · revisão</div>
      <p style="color:var(--mute);font-size:13px;margin:6px 0 12px">Encontrei <b>${found.length} avaliações</b>. Os dados do texto já vieram preenchidos. As medidas do corpo estão em imagem no PDF: confira a imagem e digite ao lado (pode deixar em branco e completar depois em Editar). Avaliações com data que já existe ficam desmarcadas.</p>
      ${found.map((a, i) => `<div class="rcard imp" data-i="${i}"><div class="rhead"><label style="display:flex;gap:8px;align-items:center"><input type="checkbox" class="imp-ok" ${ex.has(a.data) ? '' : 'checked'}><b>${fmtD(a.data)}</b></label><small>${esc(a.tipo || '')}${ex.has(a.data) ? ' · já existe no app' : ''}</small></div>
        <div class="fgrid">${F.map(([k, l]) => `<label class="fl"><span>${l}</span><input data-k="${k}" value="${a[k] ?? ''}" inputmode="decimal"></label>`).join('')}</div>
        <div class="impper"><img src="${a._img}" alt="Perimetria da avaliação de ${fmtD(a.data)}" loading="lazy"><div class="fgrid per">${PER.map(([k, l]) => `<label class="fl"><span>${l}</span><input data-p="${k}" inputmode="decimal"></label>`).join('')}</div></div></div>`).join('')}
      <div class="amsg" id="imp-msg"></div><div style="display:flex;justify-content:flex-end;margin-top:10px"><button class="big" id="imp-save" style="padding:12px 22px">Salvar avaliações marcadas</button></div></div>`;
    modal.querySelector('#imp-save').onclick = async () => {
      const add = [];
      modal.querySelectorAll('.imp').forEach(c => {
        if (!c.querySelector('.imp-ok').checked) return;
        const a = { ...found[+c.dataset.i], per: {} }; delete a._img;
        c.querySelectorAll('[data-k]').forEach(i => { const v = num(i.value); if (v == null) delete a[i.dataset.k]; else a[i.dataset.k] = v; });
        c.querySelectorAll('[data-p]').forEach(i => { const v = num(i.value); if (v != null) a.per[i.dataset.p] = v; });
        if (a.altura > 3) a.altura /= 100; a.id = rid(); add.push(a);
      });
      if (!add.length) { modal.querySelector('#imp-msg').className = 'amsg err'; modal.querySelector('#imp-msg').textContent = 'Nenhuma avaliação marcada.'; return; }
      sel = -1; await saveList(avals().filter(x => !add.some(y => y.data === x.data)).concat(add)); close(); renderAvals('av-root'); setSync(add.length + ' avaliações importadas ✓');
    };
  }

  // ---------- eventos ----------
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-av],[data-sel]'); if (!b || !b.closest('#av-root,#a-av-root')) return;
    if (b.dataset.sel != null) { sel = +b.dataset.sel; return renderAvals(b.closest('#a-av-root') ? 'a-av-root' : 'av-root'); }
    const a = b.dataset.av;
    if (a === 'new') return form(null);
    if (a === 'edit') { fixSel(); return avals()[sel] && form(JSON.parse(JSON.stringify(avals()[sel]))); }
    if (a === 'pdf') return ficha();
    if (a === 'sexo') { const s = (CURATH.sexo || 'F') === 'F' ? 'M' : 'F'; CURATH.sexo = s; FS.collection('athletes').doc(AID).update({ sexo: s }).catch(() => {}); if (three) three.spec = null; renderAvals('av-root'); }
  });
  document.addEventListener('input', e => {
    const t = e.target, rt = t.closest && t.closest('#av-root,#a-av-root'); if (!rt) return;
    if (t.id === 'av-slide') { sel = +t.value; renderAvals(rt.id); const s = rt.querySelector('#av-slide'); s && s.focus(); }
  });
  document.addEventListener('change', e => {
    const t = e.target, rt = t.closest && t.closest('#av-root,#a-av-root'); if (!rt) return;
    if (t.classList.contains('pin')) { fixSel(); const L = avals(), a = L[sel]; if (!a) return; a.per = a.per || {}; const v = num(t.value);
      if (t.value.trim() === '') delete a.per[t.dataset.pk]; else if (v == null || v <= 0 || v > 250) { setSync('Valor inválido para ' + PERL[t.dataset.pk] + '.', 1); t.value = a.per[t.dataset.pk] ?? ''; return; } else a.per[t.dataset.pk] = v;
      const id = a.id; saveList(L).then(() => { sel = avals().findIndex(x => x.id === id); const n = rt.querySelector(`[data-pk="${t.dataset.pk}"]`); }); return; }
    if (t.matches && t.matches('[data-avimp]') && t.files[0] && /\.pdf$/i.test(t.files[0].name)) { importPDF(t.files[0]); t.value = ''; return; }
    if (t.matches && t.matches('[data-avimp]') && t.files[0]) {
      t.files[0].text().then(txt => {
        let L; try { L = JSON.parse(txt); } catch (e) { return setSync('Arquivo inválido: não é um .json de avaliações.', 1); }
        if (!Array.isArray(L) || !L.every(x => x && x.data)) return setSync('Arquivo inválido: cada avaliação precisa ter data.', 1);
        const cur = avals(), seen = new Set(cur.map(x => x.data));
        const novas = L.filter(x => !seen.has(x.data)).map(x => ({ ...x, id: x.id || rid() }));
        sel = -1; saveList(cur.concat(novas)).then(() => { renderAvals('av-root'); setSync(novas.length + ' avaliações importadas ✓'); });
      });
      return;
    }
    if (t.id === 'av-cmp') { cmpPrev = t.checked; renderAvals(rt.id); }
    if (t.id === 'av-metric') { metric = t.value; const L = avals(); rt.querySelector('#av-evo').innerHTML = evoChart(L, metric, (METRICS.find(m => m[0] === metric) || [, ''])[1]); }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.classList && e.target.classList.contains('pin')) { e.preventDefault(); const all = [...document.querySelectorAll('#av-root .pin')], i = all.indexOf(e.target); e.target.blur(); setTimeout(() => { const n = document.querySelectorAll('#av-root .pin')[i + 1]; n && n.focus(); n && n.select(); }, 60); } });
  // redesenha quando os dados mudam ou quando a aba abre
  const _ra = window.renderAll;
  window.renderAll = function () { _ra.apply(this, arguments); const c = document.getElementById('av'), s = document.getElementById('a-av'); if (c && !c.hidden) renderAvals('av-root'); if (s && !s.hidden) renderAvals('a-av-root'); };
  document.addEventListener('click', e => {
    const t = e.target.closest('.tabs [data-t]'); if (!t) return;
    if (t.dataset.t === 'av') { three = null; setTimeout(() => renderAvals('av-root'), 0); }
    if (t.dataset.t === 'a-av') { three = null; setTimeout(() => renderAvals('a-av-root'), 0); }
  });
})();
