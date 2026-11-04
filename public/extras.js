// ATP · funções extras do aluno: Relatório semanal (+PDF), Strava / arquivo GPX-TCX e lembretes (push).
// Usa as variáveis globais do app (months, datedRows, CURATH, AID, ROLE, FS, FV...).
(function () {
  // Chave pública "Web Push" do Firebase (Configurações do projeto → Cloud Messaging → Certificados push da Web).
  const VAPID = 'BCeYsMH_cxAgAA69tTJqRs1Y1gskp2QypbyINtdDWar1j4E247Cb7D4v7_3kO_UHh2nFqzDuvog5OVDE9tZl39U';
  const RUN = /run|walk|hike|corrida|caminhada/i;
  const SRC = s => s === 'strava' ? 'Strava' : s === 'print' ? 'Print' : 'Arquivo';
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
      const ex = (r.ext || []).map(x => `<div class="ob">⌚ ${esc(SRC(x.src))}: ${f1(x.km)} km · ${Math.round(x.min)} min${pace(x.km, x.min) ? ' · ' + pace(x.km, x.min) : ''}${x.fc ? ' · FC ' + Math.round(x.fc) : ''}${x.kcal ? ' · ' + Math.round(x.kcal) + ' kcal' : ''}${x.alt ? ' · ↑' + Math.round(x.alt) + ' m' : ''}${x.tiros ? ' · tiros ' + x.tiros.n + '×' + f1(x.tiros.km) + ' km' + (x.tiros.media ? ' a ' + fmtT(x.tiros.media) + '/km' : '') : ''}</div>`).join('');
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
      const extra = []; (r.ext || []).forEach(x => extra.push((SRC(x.src) + ': ') + f1(x.km) + ' km · ' + Math.round(x.min) + ' min' + (pace(x.km, x.min) ? ' · ' + pace(x.km, x.min) : '') + (x.fc ? ' · FC ' + Math.round(x.fc) : '')));
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
      L.push({ id: a.id, src: a.src, tipo: a.tipo || '', nome: String(a.nome || '').slice(0, 60), km: a.km, min: a.min, fc: a.fc || null, kcal: a.kcal || null, alt: a.alt || null, tiros: a.tiros || null });
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

  const MSG={};
  // ---------------- LEITURA DE PRINTS (OCR no próprio celular) ----------------
  const tsec = t => { const p = String(t).split(':').map(Number); if (p.some(isNaN)) return null; return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p.length === 2 ? p[0] * 60 + p[1] : null };
  const fmtT = s => { if (s == null) return ''; s = Math.round(s); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return (h ? h + ':' + pad(m) : m) + ':' + pad(x) };
  function lerGenerico(txt) {
    const t = String(txt).replace(/[|]/g, ' ').replace(/(\d)\s*[,.]\s*(\d)/g, '$1,$2'), low = t.toLowerCase(), o = {};
    // ritmo: tempo seguido de /km
    const pc = [...low.matchAll(/(\d{1,2}:\d{2})\s*(?:min)?\s*\/\s*km/g)].map(m => tsec(m[1])).filter(v => v >= 150 && v <= 1200);
    if (pc.length) o.pace = pc[0];
    // distância
    let km = [...low.matchAll(/(\d{1,3}(?:,\d{1,2})?)\s*(km|mi)\b(?!\s*\/|\/)/g)].map(m => { const v = parseFloat(m[1].replace(',', '.')); return m[2] === 'mi' ? v * 1.609 : v }).filter(v => v > 0.2 && v < 300);
    if (!km.length) { const m = low.match(/dist[âa]ncia[^\d]{0,20}(\d{1,3},\d{1,2})/) || low.match(/(\d{1,3},\d{1,2})\s*(?:\n|\s)\s*(?:dist[âa]ncia|distance)/); if (m) km = [parseFloat(m[1].replace(',', '.'))] }
    if (!o.pace) { const m = low.match(/(\d{1,2}:\d{2})\s*(?:\n|\s)\s*(?:ritmo|pace)/) || low.match(/(?:ritmo|pace)[^\d\n]{0,25}\n?\s*(\d{1,2}:\d{2})(?!:)/); if (m && tsec(m[1]) >= 150 && tsec(m[1]) <= 1200) o.pace = tsec(m[1]) }
    if (km.length) o.km = Math.max(...km); // sempre a distância total (ignora parciais e tiros)
    // tempo: maior duração que não seja ritmo nem horário do relógio do celular
    const tm = [...low.matchAll(/(?<![\d:])(\d{1,2}:\d{2}(?::\d{2})?)(?![\d:])(?!\s*(?:min)?\s*\/\s*km)/g)].map(m => ({ s: tsec(m[1]), i: m.index }));
    const lab = low.search(/tempo|dura[çc][ãa]o|moving|elapsed|time/);
    let cand = tm.filter(x => x.s >= 120 && x.s <= 6 * 3600 && x.s !== o.pace);
    if (lab >= 0) { const near = cand.filter(x => Math.abs(x.i - lab) < 60); if (near.length) cand = near }
    if (cand.length) o.seg = Math.max(...cand.map(x => x.s));
    const fc = low.match(/(\d{2,3})\s*bpm/) || low.match(/(?:fc|frequ[êe]ncia card[íi]aca|heart rate)[^\d]{0,25}(\d{2,3})/); if (fc && +fc[1] >= 60 && +fc[1] <= 220) o.fc = +fc[1];
    const kc = low.match(/(\d[\d.]{1,5})\s*(?:kcal|cal\b|calorias)/) || low.match(/calorias[^\d]{0,20}(\d{2,4})/); if (kc) o.kcal = parseInt(kc[1].replace('.', ''));
    const el = low.match(/(?:eleva[çc][ãa]o|ganho|elev\.?)[^\d]{0,25}(\d{1,4})\s*m\b/) || low.match(/(\d{1,4})\s*m\b[^\n]{0,15}(?:eleva|ganho)/); if (el) o.alt = +el[1];
    if (o.km && o.seg) o.pace = o.seg / o.km; // ritmo médio do treino todo, não o do tiro
    if (!o.km && o.pace && o.seg) o.km = Math.round(o.seg / o.pace * 100) / 100;
    if (!o.seg && o.pace && o.km) o.seg = o.pace * o.km;
    if (!o.pace && o.km && o.seg) o.pace = o.seg / o.km;
    return o;
  }

  const MES = { jan: 1, fev: 2, feb: 2, mar: 3, abr: 4, apr: 4, mai: 5, may: 5, jun: 6, jul: 7, ago: 8, aug: 8, set: 9, sep: 9, out: 10, oct: 10, nov: 11, dez: 12, dec: 12 };
  function lerData(low) {
    let m = low.match(/\b(jan|fev|feb|mar|abr|apr|mai|may|jun|jul|ago|aug|set|sep|out|oct|nov|dez|dec)[a-zç]*\.?\s*(\d{1,2}),?\s*(20\d\d)/);
    if (m) return m[3] + '-' + pad(MES[m[1]]) + '-' + pad(m[2]);
    m = low.match(/(\d{1,2})\s*(?:de\s*)?(jan|fev|feb|mar|abr|apr|mai|may|jun|jul|ago|aug|set|sep|out|oct|nov|dez|dec)[a-zç]*\.?\s*(?:de\s*)?(20\d\d)/);
    if (m) return m[3] + '-' + pad(MES[m[2]]) + '-' + pad(m[1]);
    m = low.match(/\b(\d{1,2})\/(\d{1,2})\/(20\d\d)\b/); if (m) return m[3] + '-' + pad(m[2]) + '-' + pad(m[1]);
    return null;
  }
  // Resumo em linha (Runkeeper web/app e similares): uma linha com os rótulos e logo abaixo os valores na mesma ordem.
  function lerResumo(lines) {
    for (let i = 0; i < lines.length; i++) {
      const L = lines[i].toLowerCase();
      if (/intervals|interval|splits|parciais|kilometers\s*$/.test(L) && !/duration|dura[çc]/.test(L)) continue;
      const pos = { km: L.search(/\b(km|dist[âa]ncia|distance|mi)\b/), dur: L.search(/duration|dura[çc][ãa]o|tempo|\btime\b/), pace: L.search(/pace|ritmo/), cal: L.search(/calor/) };
      if (Object.values(pos).filter(v => v >= 0).length < 2) continue;
      for (let j = i + 1; j <= i + 3 && j < lines.length; j++) {
        const V = lines[j].replace(/\(\s*\d{1,2}\s*\)/g, ' ');
        const toks = [...V.matchAll(/\d{1,2}:\d{2}(?::\d{2})?|\d+[.,]\d+|\d+/g)].map(m => m[0]);
        const dec = toks.filter(t => /[.,]/.test(t)), times = toks.filter(t => t.includes(':'));
        if (!dec.length && !times.length) continue;
        const o = { resumo: true };
        if (pos.km >= 0 && dec.length) { const v = parseFloat(dec[0].replace(',', '.')); if (v > 0 && v < 400) o.km = /\bmi\b/.test(L) && !/\bkm\b/.test(L) ? v * 1.609 : v }
        const ord = ['dur', 'pace'].filter(k => pos[k] >= 0).sort((a, b) => pos[a] - pos[b]);
        ord.forEach((k, n) => { const t = times[n]; if (t) { if (k === 'dur') o.seg = tsec(t); else o.pace = tsec(t) } });
        if (pos.km >= 0 && !o.km) { const ints = toks.filter(t => /^\d{2,5}$/.test(t)); if (ints.length) o.kmBruto = +ints[0] } // ponto decimal perdido na leitura
        if (o.seg && o.pace) { const der = o.seg / o.pace, cs = [o.km, o.kmBruto, o.kmBruto / 10, o.kmBruto / 100, o.kmBruto / 1000].filter(v => v > 0);
          const best = cs.sort((a, b) => Math.abs(a - der) - Math.abs(b - der))[0]; o.km = best && Math.abs(best - der) / der < 0.06 ? best : Math.round(der * 100) / 100 }
        else if (!o.km && o.kmBruto) o.km = o.kmBruto >= 100 ? o.kmBruto / 100 : o.kmBruto;
        delete o.kmBruto;
        if (pos.cal >= 0) { const last = toks.filter(t => /^\d{2,4}$/.test(t)).pop(); if (last) o.kcal = +last }
        if (o.km || o.seg) return o;
      }
    }
    return null;
  }
  // Tabela de tiros (Intervals/Splits): várias linhas com a mesma distância curta.
  function lerTiros(txt, low) {
    if (!/interval|splits|parciais|tiros|voltas|laps/.test(low)) return null;
    const ds = [...low.matchAll(/(\d+[.,]\d+)\s*km\b(?!\s*\/)/g)].map(m => parseFloat(m[1].replace(',', '.')));
    if (ds.length < 3) return null;
    const cnt = {}; ds.forEach(v => cnt[v] = (cnt[v] || 0) + 1); const [dist, n] = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0];
    if (n < 3 || +dist > 2) return null;
    const ts = [...low.matchAll(/(?<![\d:])(\d{1,2}:\d{2})(?![\d:])/g)].map(m => tsec(m[1]));
    const tc = {}; ts.forEach(v => tc[v] = (tc[v] || 0) + 1);
    const rep = Object.keys(tc).filter(k => tc[k] >= 3).map(Number); // duração fixa da recuperação (ex.: 3:00)
    const cand = ts.filter(v => v >= 150 && v <= 720 && !rep.some(r => Math.abs(r - v) <= 2));
    const work = cand.slice().sort((a, b) => a - b).slice(0, +n); const set = work.slice();
    const paces = cand.filter(v => { const i = set.indexOf(v); if (i >= 0) { set.splice(i, 1); return true } return false });
    return { n: +n, km: +dist, paces, media: paces.length ? paces.reduce((a, b) => a + b, 0) / paces.length : null };
  }
  function lerTexto(txt) {
    const lines = String(txt).split('\n').map(l => l.trim()).filter(Boolean), low = String(txt).toLowerCase();
    const R = lerResumo(lines), T = lerTiros(txt, low), D = lerData(low);
    let o = R || {};
    if (!R) { // sem resumo em linha: leitura genérica, ignorando as distâncias dos tiros
      const g = lerGenerico(T ? txt.replace(/\d+[.,]\d+\s*km\b(?!\s*\/)/gi, ' ') : txt);
      o = T ? { fc: g.fc, kcal: g.kcal, alt: g.alt } : g;
    } else { const g = lerGenerico(txt); if (!o.fc) o.fc = g.fc; if (!o.alt) o.alt = g.alt; if (!o.kcal) o.kcal = g.kcal }
    if (o.km && o.seg && !o.pace) o.pace = o.seg / o.km;
    if (T) o.tiros = T; if (D) o.data = D;
    return o;
  }
  window.__lerTexto = lerTexto;
  let TESS = null;
  const loadTess = () => TESS || (TESS = new Promise((ok, no) => { if (window.Tesseract) return ok(window.Tesseract); const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js'; s.onload = () => ok(window.Tesseract); s.onerror = () => { TESS = null; no(new Error('sem internet para carregar o leitor')) }; document.head.appendChild(s) }));
  async function prepImg(file) { // aumenta contraste e tamanho para ler melhor (inclusive prints em modo escuro)
    const url = URL.createObjectURL(file), im = new Image(); await new Promise((ok, no) => { im.onload = ok; im.onerror = no; im.src = url });
    const sc = Math.min(2, 2000 / Math.max(im.width, im.height)) || 1, c = document.createElement('canvas'); c.width = im.width * sc; c.height = im.height * sc;
    const g = c.getContext('2d'); g.drawImage(im, 0, 0, c.width, c.height); const d = g.getImageData(0, 0, c.width, c.height), a = d.data; let sum = 0;
    for (let i = 0; i < a.length; i += 4) { const y = .3 * a[i] + .59 * a[i + 1] + .11 * a[i + 2]; a[i] = a[i + 1] = a[i + 2] = y; sum += y }
    if (sum / (a.length / 4) < 120) for (let i = 0; i < a.length; i += 4) a[i] = a[i + 1] = a[i + 2] = 255 - a[i]; // fundo escuro → inverte
    g.putImageData(d, 0, 0); return { c, thumb: url };
  }
  function diasRecentes() { const hoje = isoOf(new Date()), ini = isoOf(addD(new Date(), -21));
    return datedRows().filter(o => o.iso >= ini && o.iso <= hoje && o.r.t && typeKey(o.r.t) !== 'descanso').reverse() }
  let TIROS = null;
  function openPrint() {
    TIROS = null;
    const old = document.getElementById('pr-m'); if (old) old.remove();
    const ds = diasRecentes(), hoje = isoOf(new Date()), def = (ds.find(o => o.iso === hoje) || ds[0] || {}).iso;
    const m = document.createElement('div'); m.id = 'pr-m'; m.className = 'prm';
    m.innerHTML = `<div class="prb" role="dialog" aria-label="Enviar print do treino"><div class="eyebrow">Print do treino</div><h2 style="margin:4px 0 8px">Strava ou ASICS Runkeeper</h2>
      <p style="color:var(--mute);font-size:14px;margin:0 0 10px">Envie o print da tela de resumo da atividade (pode ser mais de um). Os números são lidos aqui no seu celular.</p>
      <label class="btn b-ok" style="display:inline-block;cursor:pointer">📷 Escolher print(s)<input type="file" id="pr-f" accept="image/*" multiple hidden></label>
      <div id="pr-th" class="prth"></div><div id="pr-tr" style="font-size:13px;margin-top:8px"></div><div id="pr-st" style="font-size:13px;color:var(--mute);margin:8px 0"></div>
      <div class="prg"><label>Dia do treino<select id="pr-d">${ds.map(o => `<option value="${o.iso}" ${o.iso === def ? 'selected' : ''}>${o.iso.slice(8)}/${o.iso.slice(5, 7)} · ${esc(o.r.t)}</option>`).join('') || '<option value="">Nenhum treino nos últimos dias</option>'}</select></label>
      <label>Distância (km)<input id="pr-km" inputmode="decimal" placeholder="Ex.: 5,02"></label>
      <label>Tempo (h:mm:ss)<input id="pr-t" inputmode="numeric" placeholder="Ex.: 27:36"></label>
      <label>Ritmo médio (/km)<input id="pr-p" placeholder="automático" readonly></label>
      <label>FC média (bpm)<input id="pr-fc" inputmode="numeric"></label>
      <label>Calorias<input id="pr-kc" inputmode="numeric"></label>
      <label>Elevação (m)<input id="pr-el" inputmode="numeric"></label></div>
      <p style="font-size:12px;color:var(--mute)">Confira os números antes de salvar e corrija se algum vier errado.</p>
      <div class="row" style="margin-top:8px"><button class="btn b-ok" id="pr-ok">Salvar no treino</button><button class="btn" id="pr-x">Cancelar</button></div></div>`;
    document.body.appendChild(m);
    const $ = id => document.getElementById(id), upP = () => { const k = num($('pr-km').value), s = tsec($('pr-t').value); $('pr-p').value = k && s ? fmtT(s / k) + '/km' : '' };
    $('pr-km').oninput = upP; $('pr-t').oninput = upP; $('pr-x').onclick = () => m.remove(); m.onclick = e => { if (e.target === m) m.remove() };
    $('pr-f').onchange = async e => {
      const fs = [...e.target.files]; if (!fs.length) return; $('pr-st').textContent = 'Carregando leitor…'; let txt = '';
      try { const T = await loadTess();
        for (let i = 0; i < fs.length; i++) { const { c, thumb } = await prepImg(fs[i]); $('pr-th').insertAdjacentHTML('beforeend', `<img src="${thumb}" alt="print ${i + 1}">`);
          const r = await T.recognize(c, 'por+eng', { logger: x => { if (x.status === 'recognizing text') $('pr-st').textContent = `Lendo print ${i + 1} de ${fs.length}… ${Math.round(x.progress * 100)}%` } });
          txt += '\n' + r.data.text }
        window.__ocrTxt = txt; const o = lerTexto(txt);
        if (o.km) $('pr-km').value = String(Math.round(o.km * 100) / 100).replace('.', ','); if (o.seg) $('pr-t').value = fmtT(o.seg);
        if (o.fc) $('pr-fc').value = o.fc; if (o.kcal) $('pr-kc').value = o.kcal; if (o.alt) $('pr-el').value = o.alt; upP();
        TIROS = o.tiros || null; if (o.data && [...$('pr-d').options].some(x => x.value === o.data)) $('pr-d').value = o.data;
        $('pr-tr').innerHTML = TIROS ? `<b>Tiros detectados:</b> ${TIROS.n} × ${String(TIROS.km).replace('.', ',')} km${TIROS.media ? ' · pace médio dos tiros ' + fmtT(TIROS.media) + '/km (' + TIROS.paces.map(fmtT).join(', ') + ')' : ''}` : '';
        $('pr-st').textContent = o.km || o.seg ? 'Pronto! Confira os números abaixo.' : TIROS ? 'Li os tiros, mas falta o resumo do treino. Envie também o print do topo (KM, DURATION, PACE) ou preencha à mão.' : 'Não consegui achar os números. Preencha à mão ou tente um print mais nítido da tela de resumo.';
      } catch (er) { $('pr-st').textContent = 'Não consegui ler: ' + er.message + '. Preencha os números à mão.' }
    };
    $('pr-ok').onclick = () => { const iso = $('pr-d').value, km = num($('pr-km').value), s = tsec($('pr-t').value);
      if (!iso) return $('pr-st').textContent = 'Escolha o dia do treino.'; if (!km && !s) return $('pr-st').textContent = 'Informe pelo menos a distância ou o tempo.';
      const r = aplicarAtividades([{ id: 'p' + Date.now(), src: 'print', tipo: 'Run', nome: 'Print', data: iso, km: km || 0, min: s ? Math.round(s / 6) / 10 : 0, fc: num($('pr-fc').value), kcal: num($('pr-kc').value), alt: num($('pr-el').value), tiros: TIROS }]);
      m.remove(); setMsg('fi-msg', ''); if (typeof flash === 'function') flash(r.n ? 'Treino lançado ✓ ' + (km ? String(km).replace('.', ',') + ' km' : '') : 'Não achei esse dia na planilha.') };
  }
  document.addEventListener('click', e => { if (e.target.closest('[data-print-open]')) openPrint() });
const setMsg=(id,t)=>{MSG[id]=t;const m=document.getElementById(id);if(m)m.textContent=t};
  // ---------------- TELA "CONEXÕES" ----------------
  function renderCfg() {
    const R = document.getElementById('cfg-root'); if (!R || !CURATH) return;
    const st = CURATH.strava, pu = CURATH.push, ath = isAth(), hs = (pu && pu.horas) || [7, 18];
    R.innerHTML = `<div class="card"><div class="eyebrow" style="color:#fc4c02">Print do Strava / ASICS Runkeeper</div>
      <p>Terminou o treino? Tire um print da tela de resumo da atividade e envie aqui. O app lê distância, tempo, ritmo, frequência cardíaca e calorias e lança no treino do dia.</p>
      ${ath ? '<button class="btn b-ok" data-print-open style="background:#fc4c02;border-color:#fc4c02">📷 Enviar print</button>' : '<p style="color:var(--mute)">O aluno envia pelo app dele.</p>'}</div>
      ${st && st.rt ? `<div class="card" style="margin-top:14px"><div class="eyebrow">Strava conectado</div><p>Conta ${esc(st.nome || '')}. Última sincronização: ${st.ult ? new Date(st.ult).toLocaleString('pt-BR') : 'ainda não'}</p>${ath ? '<div class="row"><button class="btn" id="st-sync">Sincronizar</button><button class="btn" id="st-off">Desconectar</button></div>' : ''}<div id="st-msg" style="font-size:13px;color:var(--mute);margin-top:8px">${esc(MSG['st-msg']||'')}</div></div>` : ''}
      <div class="card" style="margin-top:14px"><div class="eyebrow">Arquivo GPX / TCX (Garmin, Runkeeper e outros)</div>
      <p>Exporte a atividade em arquivo <b>GPX</b> ou <b>TCX</b> e envie aqui: o app lê distância, tempo e data e lança no treino do dia.</p>
      <p style="color:var(--mute);font-size:13px">Opcional: mais preciso que o print. No Runkeeper: site runkeeper.com → atividade → ⚙ → "Exportar GPX".</p>
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
  try { if (CURATH) window.renderExtras() } catch (e) { }
})();
