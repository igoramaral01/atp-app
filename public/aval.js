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

  // ---------- corpo 3D (Three.js) ----------
  let three = null;
  function loadThree() {
    return window.THREE ? Promise.resolve() : new Promise((ok, err) => {
      const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
      s.onload = ok; s.onerror = err; document.head.appendChild(s);
    });
  }
  const ell = (C, k) => { const a = C / (Math.PI * (1 + k)) * 1.0; return [a / 100, a * k / 100]; }; // circunferência (cm) -> semieixos (m)

  // Monta a lista de "anéis" do corpo a partir das medidas.
  function bodySpec(a, sexo) {
    const m = k => num(a.per && a.per[k]);
    const F = sexo !== 'M';
    const H = num(a.altura) || 1.65;
    const avg = (x, y, def) => { const v = [m(x), m(y)].filter(v => v != null); return v.length ? v.reduce((s, z) => s + z, 0) / v.length : def; };
    const side = (k, def) => m(k) ?? def;
    const quad = m('quad') ?? (m('cint') && m('cint') > 95 ? m('cint') : (F ? 100 : 96));
    const cint = (m('cint') != null && m('cint') <= 95) ? m('cint') : (F ? 80 : 86);
    const abdo = m('abdo') ?? cint + 2;
    const tx = m('tx') ?? (F ? 94 : 100);
    const pe = m('pe') ?? (F ? 34 : 39);
    const y = f => f * H;
    // tronco: anéis de baixo para cima
    const T = [
      [0.455, quad * 0.42, 0.85, 0], [0.475, quad * 0.80, 0.80, 0], [0.50, quad * 0.97, 0.78, 0], [0.525, quad, 0.76, 0],
      [0.575, (quad + abdo) / 2, 0.74, 0.004], [0.605, abdo, 0.74, 0.008], [0.635, cint, 0.70, 0.004],
      [0.675, (cint + tx) / 2, 0.68, 0], [0.715, tx * (F ? 0.98 : 0.97), F ? 0.80 : 0.64, F ? 0.018 : 0], [0.745, tx, F ? 0.70 : 0.66, F ? 0.008 : 0],
      [0.785, tx * (F ? 1.02 : 1.10), 0.46, 0], [0.815, tx * (F ? 0.80 : 0.88), 0.42, 0], [0.835, pe * 1.25, 0.9, 0], [0.86, pe, 0.95, 0], [0.885, pe * 0.97, 0.95, 0.004], [0.905, pe * 0.9, 0.95, 0.008],
    ].map(([f, C, k, dz]) => { const [ax, bz] = ell(C, k); return { y: y(f), cx: 0, cz: dz * H / 1.65, a: ax, b: bz, key: null }; });
    const tag = { 3: 'quad', 4: 'abdo', 5: 'cint', 7: 'tx', 8: 'tx', 12: 'pe' };
    T[3].key = 'quad'; T[5].key = 'abdo'; T[6].key = 'cint'; T[9].key = 'tx'; T[13].key = 'pe';
    // pernas
    const legX = (F ? 0.088 : 0.092) * H / 1.65;
    const leg = s => {
      const cs = side('cs' + s, F ? 60 : 56), cm = side('cm' + s, cs * 0.88), ci = side('ci' + s, cs * 0.72), su = side('su' + s, F ? 36 : 38), to = side('to' + s, 22);
      const R = [[0.035, to * 1.05, 1.1], [0.06, to, 0.95], [0.12, su * 0.72, 0.9], [0.2, su, 0.92], [0.255, su * 0.86, 0.9], [0.29, ci * 0.78, 0.92],
        [0.33, ci, 0.92], [0.39, cm, 0.93], [0.445, cs, 0.92], [0.49, cs * 1.03, 0.9], [0.515, cs * 0.95, 0.88]];
      const keys = { 1: 'to' + s, 3: 'su' + s, 6: 'ci' + s, 7: 'cm' + s, 8: 'cs' + s };
      return R.map(([f, C, k], i) => { const [ax, bz] = ell(C, k); const sx = (s === 'D' ? -1 : 1); return { y: y(f), cx: sx * (legX + (f - 0.45) * -0.02), cz: 0, a: ax, b: bz, key: keys[i] || null }; });
    };
    // braços (pendurados, levemente abertos)
    const shoulderA = ell(tx * (F ? 1.02 : 1.10), 0.46)[0];
    const arm = s => {
      const br = side('br' + s, F ? 27 : 30), ab = side('ab' + s, br * 0.86), pu = side('pu' + s, F ? 15.5 : 17);
      const sx = s === 'D' ? -1 : 1, top = 0.785, len = 0.435;
      const R = [[0, br * 1.12, 0.95], [0.1, br * 1.04, 0.95], [0.25, br, 0.95], [0.42, ab * 0.82, 0.9], [0.55, ab, 0.85], [0.78, pu * 1.12, 0.75], [0.86, pu, 0.7], [0.93, pu * 1.25, 0.45], [1, pu * 0.95, 0.4]];
      const keys = { 2: 'br' + s, 4: 'ab' + s, 6: 'pu' + s };
      return R.map(([t, C, k], i) => { const [ax, bz] = ell(C, k); return { y: y(top - t * len), cx: sx * (shoulderA * 0.92 + t * 0.055 * H / 1.65), cz: 0, a: ax, b: bz, key: keys[i] || null }; });
    };
    const A1 = arm('D'), A2 = arm('E'), L1 = leg('D'), L2 = leg('E');
    // juntas arredondadas: ombros (deltoide) e pés
    const joints = [A1, A2].map(a => ({ x: a[0].cx * 0.97, y: a[0].y + 0.004 * H, z: 0, sx: a[0].a * 1.08, sy: a[0].a * 1.15, sz: a[0].b * 1.08 }))
      .concat([L1, L2].map(l => ({ x: l[0].cx, y: 0.022 * H, z: 0.045 * H / 1.65, sx: l[0].a * 0.95, sy: 0.022 * H, sz: 0.11 * H / 1.65 })));
    return { H, parts: [T, L1, L2, A1, A2], joints, headR: (F ? 0.064 : 0.068) * H / 1.65, headY: y(0.94) };
  }

  const SEG = 28, SUB = 4;
  function loftGeom(rings) {
    // interpola anéis (Catmull-Rom simples) para suavizar
    const R = [];
    const lerp = (p0, p1, p2, p3, t) => 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
    for (let i = 0; i < rings.length - 1; i++) {
      const r0 = rings[Math.max(0, i - 1)], r1 = rings[i], r2 = rings[i + 1], r3 = rings[Math.min(rings.length - 1, i + 2)];
      for (let s = 0; s < SUB; s++) {
        const t = s / SUB, o = {};
        for (const k of ['y', 'cx', 'cz', 'a', 'b']) o[k] = lerp(r0[k], r1[k], r2[k], r3[k], t);
        o.src = [i, t]; R.push(o);
      }
    }
    R.push({ ...rings[rings.length - 1], src: [rings.length - 1, 0] });
    return R;
  }
  function buildMesh(rings, colorOf) {
    const R = loftGeom(rings), n = R.length;
    const pos = new Float32Array((n * (SEG + 1) + 2) * 3), col = new Float32Array((n * (SEG + 1) + 2) * 3), idx = [];
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    for (let i = 0; i < n - 1; i++) for (let j = 0; j < SEG; j++) {
      const a = i * (SEG + 1) + j, b = a + SEG + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    const c0 = n * (SEG + 1), c1 = c0 + 1;
    for (let j = 0; j < SEG; j++) { idx.push(c0, j + 1, j); const t = (n - 1) * (SEG + 1); idx.push(c1, t + j, t + j + 1); }
    g.setIndex(idx);
    const mesh = new THREE.Mesh(g, three.mat); mesh.userData = { n };
    updateMesh(mesh, rings, colorOf);
    return mesh;
  }
  function updateMesh(mesh, rings, colorOf) {
    const R = loftGeom(rings), n = R.length, g = mesh.geometry, pos = g.attributes.position.array, col = g.attributes.color.array;
    for (let i = 0; i < n; i++) {
      const r = R[i], [ri, t] = r.src;
      const ca = colorOf(rings[ri]), cb = colorOf(rings[Math.min(rings.length - 1, ri + 1)]);
      const c = [ca[0] + (cb[0] - ca[0]) * t, ca[1] + (cb[1] - ca[1]) * t, ca[2] + (cb[2] - ca[2]) * t];
      for (let j = 0; j <= SEG; j++) {
        const th = j / SEG * Math.PI * 2, k = (i * (SEG + 1) + j) * 3;
        pos[k] = r.cx + Math.cos(th) * r.a; pos[k + 1] = r.y; pos[k + 2] = r.cz + Math.sin(th) * r.b;
        col[k] = c[0]; col[k + 1] = c[1]; col[k + 2] = c[2];
      }
    }
    const c0 = n * (SEG + 1) * 3;
    pos[c0] = R[0].cx; pos[c0 + 1] = R[0].y; pos[c0 + 2] = R[0].cz; pos[c0 + 3] = R[n - 1].cx; pos[c0 + 4] = R[n - 1].y; pos[c0 + 5] = R[n - 1].cz;
    for (let q = 0; q < 6; q++) col[c0 + q] = col[q % 3];
    g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true; g.computeVertexNormals(); g.computeBoundingSphere();
  }

  const BASE = [0.86, 0.86, 0.9], GREEN = [0.25, 0.85, 0.23], RED = [0.93, 0.17, 0.17];
  function colorFn(dmap) {
    return ring => {
      if (!cmpPrev || !ring.key || dmap[ring.key] == null) return BASE;
      const d = dmap[ring.key]; if (Math.abs(d) < 0.25) return BASE;
      const t = Math.min(1, Math.abs(d) / 3), C = d < 0 ? GREEN : RED;
      return [BASE[0] + (C[0] - BASE[0]) * (0.45 + 0.55 * t), BASE[1] + (C[1] - BASE[1]) * (0.45 + 0.55 * t), BASE[2] + (C[2] - BASE[2]) * (0.45 + 0.55 * t)];
    };
  }

  function initThree(el) {
    const W = el.clientWidth || 320, Hh = el.clientHeight || 460;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); renderer.setSize(W, Hh);
    el.innerHTML = ''; el.appendChild(renderer.domElement);
    const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, W / Hh, 0.1, 20);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x303038, 0.85));
    const d1 = new THREE.DirectionalLight(0xffffff, 0.75); d1.position.set(1.5, 2.5, 2.5); scene.add(d1);
    const d2 = new THREE.DirectionalLight(0xa95ee8, 0.35); d2.position.set(-2, 1, -1.5); scene.add(d2);
    const grp = new THREE.Group(); scene.add(grp);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(0.55, 48), new THREE.MeshBasicMaterial({ color: 0x1d1d21 })); floor.rotation.x = -Math.PI / 2; scene.add(floor);
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.05 });
    three = { renderer, scene, cam, grp, mat, el, meshes: [], head: null, rotY: 0.35, auto: true, cur: null, target: null, anim: 0 };
    // arrastar para girar
    let drag = null;
    const cv = renderer.domElement; cv.style.touchAction = 'pan-y'; cv.style.cursor = 'grab';
    cv.addEventListener('pointerdown', e => { drag = { x: e.clientX, r: three.rotY }; three.auto = false; cv.setPointerCapture(e.pointerId); cv.style.cursor = 'grabbing'; });
    cv.addEventListener('pointermove', e => { if (drag) three.rotY = drag.r + (e.clientX - drag.x) * 0.012; });
    cv.addEventListener('pointerup', () => { drag = null; cv.style.cursor = 'grab'; });
    new ResizeObserver(() => { const w = el.clientWidth, h = el.clientHeight; if (!w || !h) return; renderer.setSize(w, h); cam.aspect = w / h; cam.updateProjectionMatrix(); }).observe(el);
    const loop = () => {
      requestAnimationFrame(loop);
      if (!el.isConnected || el.offsetParent === null) return;
      if (three.auto) three.rotY += 0.004;
      grp.rotation.y = three.rotY;
      if (three.anim < 1 && three.from && three.target) { three.anim = Math.min(1, three.anim + 0.05); applySpec(mix(three.from, three.target, ease(three.anim))); }
      renderer.render(scene, cam);
    };
    loop();
  }
  const ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  function mix(A, B, t) {
    return { H: A.H + (B.H - A.H) * t, headR: A.headR + (B.headR - A.headR) * t, headY: A.headY + (B.headY - A.headY) * t, col: B.col,
      joints: A.joints.map((j, i) => { const q = B.joints[i], o = {}; for (const k in j) o[k] = j[k] + (q[k] - j[k]) * t; return o; }),
      parts: A.parts.map((p, i) => p.map((r, j) => { const q = B.parts[i][j], o = { key: r.key }; for (const k of ['y', 'cx', 'cz', 'a', 'b']) o[k] = r[k] + (q[k] - r[k]) * t; return o; })) };
  }
  function applySpec(S) {
    const col = colorFn(S.col || {});
    if (!three.meshes.length) {
      S.parts.forEach(p => { const m = buildMesh(p, col); three.grp.add(m); three.meshes.push(m); });
      three.head = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), new THREE.MeshStandardMaterial({ color: 0xdcdce6, roughness: 0.55 }));
      three.grp.add(three.head);
      three.jm = S.joints.map(() => { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), three.head.material); three.grp.add(m); return m; });
    } else S.parts.forEach((p, i) => updateMesh(three.meshes[i], p, col));
    S.joints.forEach((j, i) => { three.jm[i].position.set(j.x, j.y, j.z); three.jm[i].scale.set(j.sx, j.sy, j.sz); });
    three.head.position.set(0, S.headY, 0.004); three.head.scale.set(S.headR * 0.86, S.headR * 1.08, S.headR * 0.98);
    three.cam.position.set(0, S.H * 0.52, S.H * 2.15); three.cam.lookAt(0, S.H * 0.49, 0);
    three.cur = S;
  }
  async function show3D(a, prev, sexo, rootEl) {
    const el = rootEl.querySelector('.av3d'); if (!el) return;
    try { await loadThree(); } catch (e) { el.innerHTML = '<div class="empty">Não consegui carregar o 3D. Verifique a internet.</div>'; return; }
    if (!three || three.el !== el) { three = null; initThree(el); }
    const S = bodySpec(a, sexo); S.col = prev ? deltas(a, prev).d : {};
    if (!three.cur || three.sexo !== sexo) { three.meshes.forEach(m => three.grp.remove(m)); three.meshes = []; if (three.head) three.grp.remove(three.head); (three.jm || []).forEach(m => three.grp.remove(m)); three.jm = []; three.cur = null; three.sexo = sexo; applySpec(S); three.target = S; three.anim = 1; return; }
    three.from = three.cur; three.target = S; three.anim = 0;
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
       ${coach ? `<div class="avact"><button class="mini ghost" data-av="sexo">Modelo: ${sexo === 'M' ? 'Masculino' : 'Feminino'}</button><label class="mini ghost" style="cursor:pointer">Importar PDF<input type="file" accept=".pdf,application/pdf,.json,application/json" data-avimp hidden></label><button class="mini ghost" data-av="edit">Editar</button><button class="mini" data-av="new">+ Nova avaliação</button></div>` : ''}
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
     <div class="card" style="margin-top:16px"><h3 class="avh3">Perimetria corporal (cm)</h3><div class="pertab">${PER.map(([k, l]) => { const v = num(a.per && a.per[k]); const d = D && D.d[k]; const cls = d == null ? '' : Math.abs(d) < 0.25 ? 'z' : d < 0 ? 'g' : 'r'; return `<div class="pr"><span>${l}</span><b class="${cls}">${v == null ? '–' : f1(v, 2)}</b><i class="${cls}">${d == null || Math.abs(d) < 0.25 ? (d == null ? '' : '=') : (d > 0 ? '+' : '') + f1(d, 2)}</i></div>`; }).join('')}</div></div>
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
    g('fa-del') && (g('fa-del').onclick = e => { const b = e.target; if (!b.dataset.arm) { b.dataset.arm = 1; b.textContent = 'Toque de novo para excluir'; return; } saveList(avals().filter(x => x.id !== a.id)).then(() => { sel = -1; close(); }); });
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
      await saveList(L); sel = avals().findIndex(x => x.id === o.id); close();
    };
  }
  async function saveList(L) {
    const clean = JSON.parse(JSON.stringify(L.sort((a, b) => String(a.data).localeCompare(String(b.data)))));
    CURATH.avals = clean; renderAvals('av-root');
    setSync('Salvando…');
    try { await FS.collection('athletes').doc(AID).update({ avals: clean }); setSync('Salvo ✓'); } catch (e) { setSync('Não consegui salvar a avaliação.', 1); }
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
      await saveList(avals().filter(x => !add.some(y => y.data === x.data)).concat(add)); sel = -1; close(); setSync(add.length + ' avaliações importadas ✓');
    };
  }

  // ---------- eventos ----------
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-av],[data-sel]'); if (!b || !b.closest('#av-root,#a-av-root')) return;
    if (b.dataset.sel != null) { sel = +b.dataset.sel; return renderAvals(b.closest('#a-av-root') ? 'a-av-root' : 'av-root'); }
    const a = b.dataset.av;
    if (a === 'new') return form(null);
    if (a === 'edit') return form(JSON.parse(JSON.stringify(avals()[sel])));
    if (a === 'sexo') { const s = (CURATH.sexo || 'F') === 'F' ? 'M' : 'F'; CURATH.sexo = s; FS.collection('athletes').doc(AID).update({ sexo: s }).catch(() => {}); three = null; renderAvals('av-root'); }
  });
  document.addEventListener('input', e => {
    const t = e.target, rt = t.closest && t.closest('#av-root,#a-av-root'); if (!rt) return;
    if (t.id === 'av-slide') { sel = +t.value; renderAvals(rt.id); const s = rt.querySelector('#av-slide'); s && s.focus(); }
  });
  document.addEventListener('change', e => {
    const t = e.target, rt = t.closest && t.closest('#av-root,#a-av-root'); if (!rt) return;
    if (t.matches && t.matches('[data-avimp]') && t.files[0] && /\.pdf$/i.test(t.files[0].name)) { importPDF(t.files[0]); t.value = ''; return; }
    if (t.matches && t.matches('[data-avimp]') && t.files[0]) {
      t.files[0].text().then(txt => {
        let L; try { L = JSON.parse(txt); } catch (e) { return setSync('Arquivo inválido: não é um .json de avaliações.', 1); }
        if (!Array.isArray(L) || !L.every(x => x && x.data)) return setSync('Arquivo inválido: cada avaliação precisa ter data.', 1);
        const cur = avals(), seen = new Set(cur.map(x => x.data));
        const novas = L.filter(x => !seen.has(x.data)).map(x => ({ ...x, id: x.id || rid() }));
        saveList(cur.concat(novas)).then(() => { sel = -1; renderAvals('av-root'); setSync(novas.length + ' avaliações importadas ✓'); });
      });
      return;
    }
    if (t.id === 'av-cmp') { cmpPrev = t.checked; renderAvals(rt.id); }
    if (t.id === 'av-metric') { metric = t.value; const L = avals(); rt.querySelector('#av-evo').innerHTML = evoChart(L, metric, (METRICS.find(m => m[0] === metric) || [, ''])[1]); }
  });
  // redesenha quando os dados mudam ou quando a aba abre
  const _ra = window.renderAll;
  window.renderAll = function () { _ra.apply(this, arguments); const c = document.getElementById('av'), s = document.getElementById('a-av'); if (c && !c.hidden) renderAvals('av-root'); if (s && !s.hidden) renderAvals('a-av-root'); };
  document.addEventListener('click', e => {
    const t = e.target.closest('.tabs [data-t]'); if (!t) return;
    if (t.dataset.t === 'av') { three = null; setTimeout(() => renderAvals('av-root'), 0); }
    if (t.dataset.t === 'a-av') { three = null; setTimeout(() => renderAvals('a-av-root'), 0); }
  });
})();
