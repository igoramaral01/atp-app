// ATP · funções extras do aluno: Relatório semanal (+PDF), Strava / arquivo GPX-TCX e lembretes (push).
// Usa as variáveis globais do app (months, datedRows, CURATH, AID, ROLE, FS, FV...).
(function () {
  // Chave pública "Web Push" do Firebase (Configurações do projeto → Cloud Messaging → Certificados push da Web).
  const VAPID = 'BCeYsMH_cxAgAA69tTJqRs1Y1gskp2QypbyINtdDWar1j4E247Cb7D4v7_3kO_UHh2nFqzDuvog5OVDE9tZl39U';
  const RUN = /run|walk|hike|corrida|caminhada/i;
  const pad = n => String(n).padStart(2, '0');
  const isoOf = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const monday = d => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x };
  const addD = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x };
  const dm = d => pad(d.getDate()) + '/' + pad(d.getMonth() + 1);
  const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  const num = v => { const n = parseFloat(String(v ?? '').replace(',', '.')); return isFinite(n) ? n : null };
  const avg = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : null;
  const f1 = v => v == null ? '–' : (Math.round(v * 10) / 10).toLocaleString('pt-BR');
  const isAth = () => typeof ROLE !== 'undefined' && ROLE === 'athlete';
  const doc = () => FS.collection('athletes').doc(AID);
  const pace = (km, min) => { if (!km || !min) return null; const p = min / km, m = Math.floor(p), s = Math.round((p - m) * 60); return m + ':' + pad(s === 60 ? 59 : s) + '/km' };

  // ---------------- RELATÓRIO SEMANAL ----------------
  let WK = null; // segunda-feira da semana escolhida
  function relData(mon) {
    const ini = isoOf(mon), fim = isoOf(addD(mon, 6));
    const all = datedRows(), dias = all.filter(o => o.iso >= ini && o.iso <= fim);
    const treinos = dias.filter(o => o.r.t && typeKey(o.r.t) !== 'descanso');
    const feitos = treinos.filter(o => o.r.s === '✓'), nao = treinos.filter(o => o.r.s === '✗');
    let kmD = 0, kmAny = false; dias.forEach(o => { const k = kmN(o.r.kmd); if (k != null && o.r.kmd !== '') { kmD += k; kmAny = true } });
    // km planejado: soma das linhas de resumo das semanas da planilha que têm dias nesta semana
    let kmP = null; const set = new Set(dias.map(o => o.r));
    for (const m of months) { let h = -1; const hs = new Set(); m.rows.forEach((r, i) => { if (r.w != null) h = i; else if (set.has(r) && h >= 0) hs.add(h) });
      hs.forEach(h => { const st = weekStats(m.rows, h); if (st.kmPlan != null) kmP = (kmP || 0) + st.kmPlan }) }
    const pPlan = avg(treinos.map(o => mid(o.r.p)).filter(Boolean)), pReal = avg(feitos.map(o => num(o.r.r)).filter(v => v != null));
    const ss = (typeof sessoes === 'function' ? sessoes() : []).filter(s => s.iso >= ini && s.iso <= fim);
    const vol = ss.reduce((t, s) => t + s.ex.reduce((u, e) => u + e.sets.reduce((w, x) => w + (num(x.b) || 0) * (num(x.a) || 0), 0), 0), 0);
    const porDia = DIAS.map((n, i) => { const iso = isoOf(addD(mon, i)); const ds = dias.filter(o => o.iso === iso); return { n, iso, rows: ds, km: ds.reduce((t, o) => t + (kmN(o.r.kmd) || 0), 0) } });
    const ext = dias.flatMap(o => (o.r.ext || []).map(x => ({ ...x, iso: o.iso })));
    const longo = ext.filter(x => RUN.test(x.tipo || 'run')).sort((a, b) => b.km - a.km)[0] || null;
    const tipos = {}; treinos.forEach(o => { const k = canonType(o.r.t); tipos[k] = tipos[k] || { n: 0, f: 0, c: typeColor(o.r.t) }; tipos[k].n++; if (o.r.s === '✓') tipos[k].f++ });
    return { ini, fim, dias, treinos, feitos, nao, kmD: kmAny ? kmD : null, kmP, pPlan, pReal, ss, vol, porDia, ext, longo, tipos,
      ader: treinos.length ? Math.round(feitos.length / treinos.length * 100) : null, temDados: dias.length > 0 || ss.length > 0 };
  }
  function ring(p, c) { const r = 34, L = 2 * Math.PI * r, v = p == null ? 0 : p / 100;
    return `<svg viewBox="0 0 84 84" width="84" height="84" aria-hidden="true"><circle cx="42" cy="42" r="${r}" fill="none" stroke="#2a2a30" stroke-width="9"/><circle cx="42" cy="42" r="${r}" fill="none" stroke="${c}" stroke-width="9" stroke-linecap="round" stroke-dasharray="${L * v} ${L}" transform="rotate(-90 42 42)"/><text x="42" y="48" text-anchor="middle" fill="#f2f2f2" font-size="18" font-weight="800" font-family="Archivo">${p == null ? '–' : p + '%'}</text></svg>` }
  function frase(D) {
    if (!D.treinos.length) return 'Semana sem treinos planejados.';
    const a = D.ader; let t = a >= 90 ? 'Semana excelente! Você cumpriu praticamente tudo o que foi planejado.' : a >= 70 ? 'Boa semana! A maior parte do plano foi cumprida.' : a >= 40 ? 'Semana parcial. Vamos buscar mais regularidade na próxima.' : 'Semana com poucos treinos feitos. Converse com seu treinador se algo atrapalhou.';
    if (D.kmP && D.kmD != null) { const r = D.kmD / D.kmP; t += r >= .95 ? ' Volume de corrida dentro da meta.' : r > 1.15 ? ' Você correu acima do planejado: atenção à recuperação.' : ' Volume de corrida abaixo da meta.' }
    if (D.pPlan && D.pReal) { const d = D.pReal - D.pPlan; if (Math.abs(d) >= 1.5) t += d > 0 ? ' O esforço sentido ficou acima do previsto.' : ' O esforço sentido ficou abaixo do previsto.' }
    return t }
  function renderRel() {
    const R = document.getElementById('rel-root'); if (!R || typeof datedRows !== 'function') return;
    if (!WK) { WK = monday(new Date()); if (!relData(WK).temDados) WK = addD(WK, -7) }
    const D = relData(WK), nome = (CURATH && CURATH.nome) || 'Aluno', mx = Math.max(1, ...D.porDia.map(d => d.km));
    const bars = D.porDia.map(d => { const h = Math.round(d.km / mx * 90); const st = d.rows.find(o => o.r.t && typeKey(o.r.t) !== 'descanso'); const c = !st ? '#2a2a30' : st.r.s === '✓' ? '#3fd93a' : st.r.s === '✗' ? '#ee2b2b' : '#9a9aa3';
      return `<div class="rb"><span class="rv">${d.km ? f1(d.km) : ''}</span><i style="height:${Math.max(h, 3)}px;background:${c}"></i><b>${d.n}</b><small>${d.iso.slice(8)}</small></div>` }).join('');
    const linhas = D.porDia.map(d => d.rows.map(o => { const r = o.r, ds = typeKey(r.t) === 'descanso';
      const pill = ds ? '<span class="pill" style="background:#2a2a30">DESCANSO</span>' : r.s === '✓' ? '<span class="pill p-ok">FEITO</span>' : r.s === '✗' ? '<span class="pill p-no">NÃO FEZ</span>' : '<span class="pill" style="background:#2a2a30;color:#9a9aa3">PENDENTE</span>';
      const ex = (r.ext || []).map(x => `<div class="ob">⌚ ${esc(x.src === 'strava' ? 'Strava' : 'Arquivo')}: ${f1(x.km)} km · ${Math.round(x.min)} min${pace(x.km, x.min) ? ' · ' + pace(x.km, x.min) : ''}${x.fc ? ' · FC ' + Math.round(x.fc) : ''}</div>`).join('');
      return `<div class="rrow"><div class="dt">${d.iso.slice(8)}/${d.iso.slice(5, 7)}<small>${d.n}</small></div><div style="min-width:0"><b>${esc(r.t || '—')}</b><div class="ct">${esc(String(r.c || '').split('\n')[0])}</div>${kmN(r.kmd) ? `<div class="ob">📏 ${f1(kmN(r.kmd))} km${r.r ? ' · esforço ' + esc(r.r) : ''}</div>` : r.r ? `<div class="ob">Esforço ${esc(r.r)}</div>` : ''}${ex}${r.o ? `<div class="ob">💬 ${esc(r.o)}</div>` : ''}</div>${pill}</div>` }).join('')).join('');
    const tp = Object.entries(D.tipos).map(([k, v]) => `<span class="tchip"><i style="background:${v.c}"></i>${esc(k)} ${v.f}/${v.n}</span>`).join('');
    R.innerHTML = `<div class="relnav"><button class="btn" data-rw="-1" aria-label="Semana anterior">‹</button><div><div class="eyebrow">Relatório semanal</div><b>${dm(WK)} a ${dm(addD(WK, 6))}</b></div><button class="btn" data-rw="1" aria-label="Próxima semana">›</button></div>
      <div class="relhero"><div>${ring(D.ader, '#3fd93a')}</div><div><h2 style="margin:0">${esc(nome.split(' ')[0])}, ${D.feitos.length} de ${D.treinos.length} treinos</h2><p style="color:var(--mute);margin:6px 0 0">${esc(frase(D))}</p></div></div>
      <div class="relk"><div><small>KM PERCORRIDO</small><b>${f1(D.kmD)}</b><span>${D.kmP ? 'meta ' + f1(D.kmP) + ' km' : 'sem meta'}</span></div>
        <div><small>ESFORÇO MÉDIO</small><b>${f1(D.pReal)}</b><span>${D.pPlan ? 'previsto ' + f1(D.pPlan) : '—'}</span></div>
        <div><small>ACADEMIA</small><b>${D.ss.length}</b><span>${D.ss.length ? Math.round(D.ss.reduce((t, s) => t + (s.min || 0), 0)) + ' min · ' + Math.round(D.vol).toLocaleString('pt-BR') + ' kg' : 'sessões'}</span></div>
        <div><small>MAIS LONGO</small><b>${D.longo ? f1(D.longo.km) : (Math.max(0, ...D.porDia.map(d => d.km)) ? f1(Math.max(...D.porDia.map(d => d.km))) : '–')}</b><span>${D.longo && pace(D.longo.km, D.longo.min) ? pace(D.longo.km, D.longo.min) : 'km'}</span></div></div>
      ${D.kmP ? `<div class="relbar"><i style="width:${Math.min(100, Math.round((D.kmD || 0) / D.kmP * 100))}%"></i></div>` : ''}
      <div class="card" style="margin-top:14px"><div class="eyebrow">KM por dia</div><div class="rbars">${bars}</div>${tp ? `<div style="margin-top:10px;display:flex;flex-wrap:wrap;gap:6px">${tp}</div>` : ''}</div>
      <div class="rcard" style="margin-top:14px">${linhas || '<div class="empty">Sem dias desta semana na planilha.</div>'}</div>
      <button class="big" id="rel-pdf" style="display:block;margin:16px 0">Baixar relatório em PDF</button>`;
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-rw]'); if (b && WK) { WK = addD(WK, 7 * +b.dataset.rw); renderRel(); return }
    if (e.target.closest('#rel-pdf')) pdfRel();
  });

  async function imgData(src) { try { const r = await fetch(src); const b = await r.blob(); return await new Promise(ok => { const f = new FileReader(); f.onload = () => ok(f.result); f.readAsDataURL(b) }) } catch (e) { return null } }
  async function pdfRel() {
    if (!window.jspdf) return alert('Não consegui carregar o gerador de PDF. Verifique a internet e tente de novo.');
    const D = relData(WK), nome = (CURATH && CURATH.nome) || 'Aluno';
    const { jsPDF } = window.jspdf, P = new jsPDF({ unit: 'mm', format: 'a4' }), W = 210;
    const BG = [11, 11, 13], RED = [238, 43, 43], GRN = [63, 217, 58], MUT = [120, 120, 130], LINE = [225, 225, 230];
    // cabeçalho
    P.setFillColor(...BG); P.rect(0, 0, W, 46, 'F'); P.setFillColor(...RED); P.rect(0, 46, W, 1.6, 'F');
    const logo = await imgData('/img/icon-192.png'); if (logo) P.addImage(logo, 'PNG', 14, 10, 24, 24);
    P.setTextColor(255, 255, 255); P.setFont('helvetica', 'bold'); P.setFontSize(9); P.text('ATP · AMARAL TRAINING PERFORMANCE', 44, 15);
    P.setFontSize(20); P.text('Relatório semanal', 44, 25);
    P.setFont('helvetica', 'normal'); P.setFontSize(11); P.text(nome + '  ·  ' + dm(WK) + ' a ' + dm(addD(WK, 6)) + '/' + addD(WK, 6).getFullYear(), 44, 33);
    P.setFontSize(8); P.setTextColor(170, 170, 178); P.text('Gerado em ' + new Date().toLocaleDateString('pt-BR'), 44, 39);
    // resumo
    let y = 58; P.setTextColor(20, 20, 24); P.setFont('helvetica', 'bold'); P.setFontSize(12); P.text('Resumo', 14, y);
    P.setFont('helvetica', 'normal'); P.setFontSize(10); P.setTextColor(60, 60, 68); const fr = P.splitTextToSize(frase(D), W - 28); P.text(fr, 14, y + 6); y += 8 + fr.length * 4.6;
    const K = [['TREINOS FEITOS', D.feitos.length + ' / ' + D.treinos.length, D.ader == null ? '' : D.ader + '% de aderência'],
      ['KM PERCORRIDO', f1(D.kmD), D.kmP ? 'meta ' + f1(D.kmP) + ' km' : 'sem meta definida'],
      ['ESFORÇO MÉDIO', f1(D.pReal), D.pPlan ? 'previsto ' + f1(D.pPlan) : ''],
      ['ACADEMIA', String(D.ss.length), D.ss.length ? Math.round(D.vol).toLocaleString('pt-BR') + ' kg de volume' : 'sessões']];
    const bw = (W - 28 - 9) / 4; K.forEach((k, i) => { const x = 14 + i * (bw + 3); P.setFillColor(245, 245, 247); P.roundedRect(x, y, bw, 26, 2, 2, 'F'); P.setFillColor(...(i === 0 ? GRN : RED)); P.rect(x, y, 1.4, 26, 'F');
      P.setFontSize(7); P.setTextColor(...MUT); P.setFont('helvetica', 'bold'); P.text(k[0], x + 4, y + 6); P.setFontSize(17); P.setTextColor(20, 20, 24); P.text(k[1], x + 4, y + 16);
      P.setFont('helvetica', 'normal'); P.setFontSize(7.5); P.setTextColor(...MUT); P.text(k[2], x + 4, y + 22) }); y += 32;
    if (D.kmP) { P.setFillColor(...LINE); P.roundedRect(14, y, W - 28, 3, 1.5, 1.5, 'F'); const r = Math.min(1, (D.kmD || 0) / D.kmP); if (r > 0) { P.setFillColor(...GRN); P.roundedRect(14, y, (W - 28) * r, 3, 1.5, 1.5, 'F') }
      P.setFontSize(8); P.setTextColor(...MUT); P.text(Math.round((D.kmD || 0) / D.kmP * 100) + '% da meta de km', W - 14, y + 7.5, { align: 'right' }); y += 13 }
    // gráfico km por dia
    P.setFont('helvetica', 'bold'); P.setFontSize(12); P.setTextColor(20, 20, 24); P.text('Quilômetros por dia', 14, y); y += 4;
    const cH = 38, mx = Math.max(1, ...D.porDia.map(d => d.km)), cw = (W - 28) / 7; P.setDrawColor(...LINE); P.line(14, y + cH, W - 14, y + cH);
    D.porDia.forEach((d, i) => { const st = d.rows.find(o => o.r.t && typeKey(o.r.t) !== 'descanso'); const c = !st ? [200, 200, 205] : st.r.s === '✓' ? GRN : st.r.s === '✗' ? RED : [160, 160, 168];
      const h = d.km / mx * (cH - 8), x = 14 + i * cw + cw * .25; P.setFillColor(...c); if (d.km) P.rect(x, y + cH - h, cw * .5, h, 'F'); else P.rect(x, y + cH - .8, cw * .5, .8, 'F');
      P.setFontSize(8); P.setTextColor(40, 40, 46); if (d.km) P.text(f1(d.km), x + cw * .25, y + cH - h - 1.5, { align: 'center' });
      P.setTextColor(...MUT); P.text(d.n + ' ' + d.iso.slice(8), x + cw * .25, y + cH + 5, { align: 'center' }) });
    y += cH + 12;
    // legenda
    [['Feito', GRN], ['Não fez', RED], ['Pendente', [160, 160, 168]]].forEach((l, i) => { P.setFillColor(...l[1]); P.rect(14 + i * 28, y - 3, 3, 3, 'F'); P.setFontSize(8); P.setTextColor(...MUT); P.text(l[0], 19 + i * 28, y - .4) }); y += 6;
    // tabela dos dias
    const head = () => { P.setFillColor(...BG); P.rect(14, y, W - 28, 7, 'F'); P.setTextColor(255, 255, 255); P.setFont('helvetica', 'bold'); P.setFontSize(8);
      [['DIA', 16], ['TREINO', 34], ['KM', 128], ['ESFORÇO', 142], ['STATUS', 162]].forEach(c => P.text(c[0], c[1], y + 4.8)); y += 7 };
    const novaPag = () => { P.addPage(); y = 16 };
    head();
    D.porDia.forEach(d => d.rows.forEach(o => { const r = o.r, ds = typeKey(r.t) === 'descanso';
      const desc = P.splitTextToSize((r.t ? r.t + ' — ' : '') + String(r.c || '').replace(/\n/g, ' · '), 90).slice(0, 3);
      const extra = []; (r.ext || []).forEach(x => extra.push((x.src === 'strava' ? 'Strava: ' : 'Arquivo: ') + f1(x.km) + ' km · ' + Math.round(x.min) + ' min' + (pace(x.km, x.min) ? ' · ' + pace(x.km, x.min) : '') + (x.fc ? ' · FC ' + Math.round(x.fc) : '')));
      if (r.o) extra.push('Comentário: ' + r.o); const ex = extra.flatMap(t => P.splitTextToSize(t, 90)).slice(0, 4);
      const h = Math.max(9, 4 + (desc.length + ex.length) * 4); if (y + h > 280) { novaPag(); head() }
      P.setDrawColor(...LINE); P.line(14, y + h, W - 14, y + h);
      P.setFont('helvetica', 'bold'); P.setFontSize(9); P.setTextColor(20, 20, 24); P.text(d.n + ' ' + d.iso.slice(8) + '/' + d.iso.slice(5, 7), 16, y + 5);
      P.setFont('helvetica', 'normal'); P.text(desc, 34, y + 5); if (ex.length) { P.setFontSize(7.5); P.setTextColor(...MUT); P.text(ex, 34, y + 5 + desc.length * 4) }
      P.setFontSize(9); P.setTextColor(20, 20, 24); P.text(kmN(r.kmd) ? f1(kmN(r.kmd)) : '–', 128, y + 5); P.text(r.r ? String(r.r) : (r.p ? 'prev. ' + r.p : '–'), 142, y + 5);
      const st = ds ? ['Descanso', MUT] : r.s === '✓' ? ['Feito', GRN] : r.s === '✗' ? ['Não fez', RED] : ['Pendente', MUT];
      P.setFillColor(...st[1]); P.roundedRect(162, y + 1.6, 30, 5, 1.2, 1.2, 'F'); P.setTextColor(255, 255, 255); P.setFont('helvetica', 'bold'); P.setFontSize(7.5); P.text(st[0].toUpperCase(), 177, y + 5.1, { align: 'center' });
      y += h }));
    // academia
    if (D.ss.length) { y += 8; if (y > 250) novaPag(); P.setFont('helvetica', 'bold'); P.setFontSize(12); P.setTextColor(20, 20, 24); P.text('Treinos de academia', 14, y); y += 6;
      D.ss.slice().reverse().forEach(s => { const lin = s.ex.filter(e => e.sets.length).map(e => { const mxk = Math.max(0, ...e.sets.map(x => num(x.b) || 0)); return e.n + ': ' + e.sets.length + ' séries' + (mxk ? ' · até ' + mxk + ' kg' : '') });
        const L = lin.flatMap(t => P.splitTextToSize(t, W - 34)); if (y + 8 + L.length * 4 > 282) novaPag();
        P.setFont('helvetica', 'bold'); P.setFontSize(9.5); P.setTextColor(20, 20, 24); P.text('Ficha ' + s.ficha + '  ·  ' + fmtBR(s.iso) + '  ·  ' + (s.min || 0) + ' min' + (s.rpe ? '  ·  esforço ' + s.rpe : ''), 14, y);
        P.setFont('helvetica', 'normal'); P.setFontSize(8.5); P.setTextColor(70, 70, 78); P.text(L, 18, y + 5); y += 8 + L.length * 4 }) }
    // rodapé
    const n = P.getNumberOfPages(); for (let i = 1; i <= n; i++) { P.setPage(i); P.setFontSize(7.5); P.setTextColor(...MUT); P.text('ATP · Amaral Training Performance — relatório gerado pelo app', 14, 290); P.text(i + '/' + n, W - 14, 290, { align: 'right' }) }
    P.save('Relatorio-ATP-' + nome.split(' ')[0] + '-' + D.ini + '.pdf');
  }

  // ---------------- IMPORTAÇÃO (Strava e arquivos) ----------------
  function aplicarAtividades(acts) {
    const rows = datedRows(); let n = 0, sem = 0; const mud = new Set();
    for (const a of acts) {
      const iso = String(a.data).slice(0, 10); const o = rows.find(o => o.iso === iso && o.r.t && typeKey(o.r.t) !== 'descanso') || rows.find(o => o.iso === iso);
      if (!o) { sem++; continue }
      const r = o.r, L = (r.ext || []).filter(x => String(x.id) !== String(a.id)); const novo = !(r.ext || []).some(x => String(x.id) === String(a.id));
      L.push({ id: a.id, src: a.src, tipo: a.tipo || '', nome: String(a.nome || '').slice(0, 60), km: a.km, min: a.min, fc: a.fc || null });
      r.ext = L; const km = L.filter(x => RUN.test(x.tipo || 'run')).reduce((t, x) => t + (x.km || 0), 0);
      if (km) r.kmd = String(Math.round(km * 100) / 100); if (!r.s) r.s = '✓'; if (novo) n++; mud.add(r) }
    mud.forEach(r => athFb(r)); if (mud.size) renderAll(); return { n, sem };
  }
  async function syncStrava(manual) {
    const st = CURATH && CURATH.strava; if (!isAth() || !st || !st.rt) return;
    if (!manual && st.ult && Date.now() - st.ult < 30 * 60e3) return; // no máximo a cada 30 min
    setMsg('st-msg','Sincronizando…');
    try {
      const after = Math.floor((Date.now() - 21 * 864e5) / 1000);
      const r = await fetch('/api/strava?a=acts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ rt: st.rt, after }) });
      const j = await r.json(); if (!r.ok) throw new Error(j.erro || 'erro');
      const res = aplicarAtividades(j.acts.map(a => ({ ...a, src: 'strava' })));
      const ns = { ...st, rt: j.rt, ult: Date.now() }; CURATH.strava = ns; await doc().update({ strava: ns });
      setMsg('st-msg', res.n ? res.n + ' atividade(s) nova(s) importada(s).' : 'Tudo em dia. Nenhuma atividade nova.');
    } catch (e) { setMsg('st-msg', 'Não consegui sincronizar: ' + e.message) }
    renderCfg();
  }
  function parseArquivo(txt, nome) {
    const x = new DOMParser().parseFromString(txt, 'application/xml'); const pts = [];
    x.querySelectorAll('trkpt').forEach(p => { const t = p.querySelector('time'); pts.push({ la: +p.getAttribute('lat'), lo: +p.getAttribute('lon'), t: t && new Date(t.textContent) }) });
    let dist = null; if (!pts.length) { x.querySelectorAll('Trackpoint').forEach(p => { const la = p.querySelector('LatitudeDegrees'), lo = p.querySelector('LongitudeDegrees'), t = p.querySelector('Time'), d = p.querySelector('DistanceMeters'); if (t) pts.push({ la: la ? +la.textContent : null, lo: lo ? +lo.textContent : null, t: new Date(t.textContent), d: d ? +d.textContent : null }) }) ;
      const ds = pts.map(p => p.d).filter(v => v != null); if (ds.length) dist = Math.max(...ds) }
    const tp = pts.filter(p => p.t && !isNaN(p.t)); if (tp.length < 2) throw new Error('arquivo sem pontos com horário');
    if (dist == null) { dist = 0; const R = 6371e3, rad = v => v * Math.PI / 180; for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i]; if (a.la == null || b.la == null) continue; const dl = rad(b.la - a.la), dn = rad(b.lo - a.lo); const h = Math.sin(dl / 2) ** 2 + Math.cos(rad(a.la)) * Math.cos(rad(b.la)) * Math.sin(dn / 2) ** 2; dist += 2 * R * Math.asin(Math.sqrt(h)) } }
    const t0 = tp[0].t, t1 = tp[tp.length - 1].t; const tipoTag = x.querySelector('type, Activity'); const tipo = tipoTag ? (tipoTag.getAttribute('Sport') || tipoTag.textContent || 'run') : 'run';
    return { id: 'f' + t0.getTime(), src: 'arquivo', tipo: /bik|cycl|ride/i.test(tipo) ? 'Ride' : 'Run', nome, data: isoOf(t0), km: Math.round(dist / 10) / 100, min: Math.round((t1 - t0) / 6000) / 10 };
  }

  // ---------------- LEMBRETES (push) ----------------
  const HORAS = [[7, 'Manhã (7h)'], [12, 'Meio-dia (12h)'], [18, 'Fim de tarde (18h)'], [21, 'Noite (21h) · lembrar do feedback']];
  async function ativarPush() {
    const say = t => setMsg('pu-msg', t);
    if (!VAPID) return say('Os lembretes ainda estão sendo configurados pelo treinador.');
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent), inst = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    if (ios && !inst) return say('No iPhone: toque em Compartilhar → "Adicionar à Tela de Início", abra o ATP pelo ícone e ative aqui.');
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !(await firebase.messaging.isSupported())) return say('Este navegador não aceita notificações. Use o Chrome (Android) ou o app na Tela de Início (iPhone).');
    if (await Notification.requestPermission() !== 'granted') return say('Permissão negada. Libere as notificações do ATP nas configurações do celular.');
    try {
      const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      const tk = await firebase.messaging().getToken({ vapidKey: VAPID, serviceWorkerRegistration: reg });
      const horas = [...document.querySelectorAll('[data-hora]:checked')].map(i => +i.dataset.hora);
      const p = (CURATH.push = { tokens: [...new Set([...((CURATH.push && CURATH.push.tokens) || []), tk])].slice(-5), horas: horas.length ? horas : [7, 18], tz: 'America/Sao_Paulo' });
      await doc().update({ push: p }); say('Lembretes ativados ✓'); renderCfg();
    } catch (e) { say('Não consegui ativar: ' + e.message) }
  }
  async function salvarHoras() { if (!CURATH.push) return; CURATH.push.horas = [...document.querySelectorAll('[data-hora]:checked')].map(i => +i.dataset.hora); await doc().update({ push: CURATH.push }); setMsg('pu-msg', 'Horários salvos ✓') }

  const MSG={};const setMsg=(id,t)=>{MSG[id]=t;const m=document.getElementById(id);if(m)m.textContent=t};
  // ---------------- TELA "CONEXÕES" ----------------
  function renderCfg() {
    const R = document.getElementById('cfg-root'); if (!R || !CURATH) return;
    const st = CURATH.strava, pu = CURATH.push, ath = isAth(), hs = (pu && pu.horas) || [7, 18];
    R.innerHTML = `<div class="card"><div class="eyebrow" style="color:#fc4c02">Strava</div>
      ${st && st.rt ? `<p>Conectado${st.nome ? ' como <b>' + esc(st.nome) + '</b>' : ''}. Suas corridas entram sozinhas no treino do dia (km, tempo, ritmo e frequência cardíaca).</p><p style="color:var(--mute);font-size:13px">Última sincronização: ${st.ult ? new Date(st.ult).toLocaleString('pt-BR') : 'ainda não'}</p>
        ${ath ? '<div class="row"><button class="btn b-ok" id="st-sync">Sincronizar agora</button><button class="btn" id="st-off">Desconectar</button></div>' : ''}`
      : `<p>Conecte sua conta para importar automaticamente as atividades feitas no relógio/celular para o treino do dia.</p>${ath ? '<button class="btn b-ok" id="st-on" style="background:#fc4c02;border-color:#fc4c02">Conectar com Strava</button>' : '<p style="color:var(--mute)">O aluno conecta pelo app dele.</p>'}`}
      <div id="st-msg" style="font-size:13px;color:var(--mute);margin-top:8px">${esc(MSG['st-msg']||'')}</div></div>
      <div class="card" style="margin-top:14px"><div class="eyebrow">ASICS Runkeeper, Garmin e outros</div>
      <p>Exporte a atividade em arquivo <b>GPX</b> ou <b>TCX</b> e envie aqui: o app lê distância, tempo e data e lança no treino do dia.</p>
      <p style="color:var(--mute);font-size:13px">Runkeeper: abra a atividade no site runkeeper.com → ⚙ → "Exportar GPX". Dica: se o Runkeeper estiver ligado ao Strava, basta conectar o Strava acima.</p>
      ${ath ? '<label class="btn" style="display:inline-block;cursor:pointer">Escolher arquivo(s)<input type="file" id="fi-gpx" accept=".gpx,.tcx,application/gpx+xml" multiple hidden></label>' : ''}
      <div id="fi-msg" style="font-size:13px;color:var(--mute);margin-top:8px">${esc(MSG['fi-msg']||'')}</div></div>
      <div class="card" style="margin-top:14px"><div class="eyebrow">Lembretes no celular</div>
      <p>${pu && pu.tokens && pu.tokens.length ? 'Lembretes <b>ativados</b>. Você recebe o treino do dia nos horários abaixo (só nos dias com treino e enquanto não marcar como feito).' : 'Receba no celular o treino do dia e um lembrete para enviar o feedback.'}</p>
      ${HORAS.map(([h, l]) => `<label style="display:block;margin:6px 0"><input type="checkbox" data-hora="${h}" ${hs.includes(h) ? 'checked' : ''} ${ath ? '' : 'disabled'}> ${l}</label>`).join('')}
      ${ath ? (pu && pu.tokens && pu.tokens.length ? '<button class="btn" id="pu-save">Salvar horários</button> <button class="btn" id="pu-on">Ativar neste aparelho</button>' : '<button class="btn b-ok" id="pu-on">Ativar lembretes</button>') : ''}
      <div id="pu-msg" style="font-size:13px;color:var(--mute);margin-top:8px">${esc(MSG['pu-msg']||'')}</div></div>`;
  }
  document.addEventListener('click', async e => {
    const id = e.target.id;
    if (id === 'st-on') location.href = '/api/strava?a=start';
    if (id === 'st-sync') syncStrava(true);
    if (id === 'st-off' && confirm('Desconectar o Strava? As atividades já importadas continuam no app.')) { CURATH.strava = null; await doc().update({ strava: FV.delete() }); renderCfg() }
    if (id === 'pu-on') ativarPush();
    if (id === 'pu-save') salvarHoras();
  });
  document.addEventListener('change', async e => {
    if (e.target.id !== 'fi-gpx') return; const acts = [], erros = [];
    for (const f of e.target.files) { try { acts.push(parseArquivo(await f.text(), f.name)) } catch (er) { erros.push(f.name + ' (' + er.message + ')') } }
    const r = aplicarAtividades(acts);
    setMsg('fi-msg', (r.n ? r.n + ' atividade(s) lançada(s) no treino do dia. ' : '') + (r.sem ? r.sem + ' sem dia correspondente na planilha. ' : '') + (erros.length ? 'Não li: ' + erros.join(', ') : '') || 'Nada novo para importar.');
    e.target.value = '';
  });

  // retorno do Strava (#strava=...)
  let PEND = null;
  if (location.hash.startsWith('#strava=')) { const v = decodeURIComponent(location.hash.slice(8)); history.replaceState(null, '', location.pathname + location.search);
    if (v === 'erro') PEND = 'erro'; else try { PEND = JSON.parse(atob(v)) } catch (e) { PEND = 'erro' } }
  let synced = false;
  window.renderExtras = function () {
    if (!CURATH) return;
    if (PEND && isAth() && AID) { const p = PEND; PEND = null;
      if (p === 'erro') alert('A conexão com o Strava foi cancelada ou falhou.');
      else { CURATH.strava = { rt: p.rt, nome: p.nome || '', id: p.id || null, ult: 0 }; doc().update({ strava: CURATH.strava }).then(() => { syncStrava(true) }) }
      setTimeout(() => { const b = document.querySelector('#aluno .tabs [data-t="a-cfg"]'); b && b.click() }, 300) }
    renderRel(); renderCfg();
    if (!synced && isAth()) { synced = true; setTimeout(() => syncStrava(false), 1500) }
  };
  if (typeof CURATH !== 'undefined' && CURATH) window.renderExtras();
})();
