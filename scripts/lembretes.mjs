// Lembretes de treino: roda de hora em hora no GitHub Actions (segredo FIREBASE_SA).
// Para cada aluno com lembretes ativos e com a hora atual (Brasília) escolhida,
// envia o treino do dia se ainda não foi marcado como feito/não feito.
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
const sa = JSON.parse(process.env.FIREBASE_SA || '{}');
if (!sa.project_id) { console.error('Segredo FIREBASE_SA ausente.'); process.exit(1); }
initializeApp({ credential: cert(sa) });
const db = getFirestore(), msg = getMessaging();
const agora = new Date(Date.now() - 3 * 3600e3); // horário de Brasília
const H = process.env.HORA ? Number(process.env.HORA) : agora.getUTCHours(), D = agora.getUTCDate(), M = agora.getUTCMonth() + 1;
const pad = n => String(n).padStart(2, '0');
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
let env = 0;
const hojeK = agora.toISOString().slice(0, 10);
for (const d of (await db.collection('athletes').get()).docs) {
  const a = d.data(), p0 = (a.fb && a.fb._push) || a.push; console.log('aluno', String(a.nome || '').split(' ')[0], 'aparelhos:', (p0 && p0.tokens || []).length, 'horas:', p0 && p0.horas); if (!p0 || !p0.tokens || !p0.tokens.length) continue;
  const p = { ...p0, enviados: (a.push && a.push.enviados) || {} };
  const enviados = (p.enviados && p.enviados[hojeK]) || [];
  // o GitHub às vezes atrasa a execução: envia a hora escolhida mais recente que já passou (até 2h) e ainda não foi enviada hoje
  const horas = [...new Set((p.horas || [12, 18, 22]).filter(h => h !== 7).map(h => h === 21 ? 22 : h))]; // horários atuais: 12h, 18h e 22h
  const hora = horas.filter(h => h <= H && H - h <= 2 && !enviados.includes(h)).sort((x, y) => y - x)[0];
  if (hora == null) continue;
  const fb = a.fb || {}, rows = [];
  for (const m of a.months || []) { let last = null; for (const r of m.rows || []) { if (r.w != null || r.sum != null) { last = null; continue }
    const x = r.dt ? String(r.dt).match(/^(\d{1,2})\/(\d{1,2})/) : null; if (x) last = [+x[1], +x[2]]; else if (String(r.dt || '').trim() || !(r.t || r.c)) continue; // linha sem data = 2º treino do mesmo dia
    if (last && last[0] === D && last[1] === M) rows.push({ ...r, ...(fb[r.id] || {}) }); } }
  const pend = rows.filter(r => r.t && !/descanso|off/.test(norm(r.t)) && !r.s);
  await d.ref.update({ ['push.enviados']: { [hojeK]: [...enviados, hora] } });
  if (!pend.length) continue;
  const nome = String(a.nome || '').split(' ')[0], lista = pend.map(r => r.t + (String(r.c || '').split('\n')[0] ? ' (' + String(r.c).split('\n')[0] + ')' : '')).join(' + ');
  const n = hora < 12 ? { title: `Bom dia, ${nome}! Treino de hoje: ${pend.map(r => r.t).join(' + ')}`, body: lista }
    : hora < 20 ? { title: `${nome}, seu treino de hoje te espera`, body: lista }
    : { title: 'Já treinou hoje?', body: `Marque ${pend.map(r => r.t).join(' + ')} como feito e envie seu feedback ao treinador.` };
  const r = await msg.sendEachForMulticast({ tokens: p.tokens, notification: n, webpush: { fcmOptions: { link: 'https://atp-app-two.vercel.app/' }, notification: { icon: '/img/icon-192.png' } } });
  r.responses.forEach((x, i) => { if (!x.success) console.log('falha token', i, x.error && x.error.code) });
  const ruins = p.tokens.filter((t, i) => !r.responses[i].success && /not-registered|invalid-registration|invalid-argument/.test(r.responses[i].error?.code || ''));
  if (ruins.length) await d.ref.update({ 'fb._push.tokens': FieldValue.arrayRemove(...ruins) });
  env += r.successCount;
}

// ---------- treinador ----------
const mc = await db.collection('meta').doc('coach').get();
const cu = mc.exists && mc.data().uid ? await db.collection('users').doc(mc.data().uid).get() : null;
const cp = cu && cu.exists && cu.data().push;
console.log('treinador aparelhos:', (cp && cp.tokens || []).length, 'horas:', cp && cp.horas, 'feedback:', cp && cp.feedback);
if (cp && cp.tokens && cp.tokens.length) {
  const ATH = (await db.collection('athletes').get()).docs.map(d => ({ id: d.id, ...d.data() }));
  const enviar = async n => { const r = await msg.sendEachForMulticast({ tokens: cp.tokens, notification: n, webpush: { fcmOptions: { link: 'https://atp-app-two.vercel.app/' }, notification: { icon: '/img/icon-192.png' } } });
    const ruins = cp.tokens.filter((t, i) => !r.responses[i].success && /not-registered|invalid-registration|invalid-argument/.test(r.responses[i].error?.code || ''));
    if (ruins.length) await cu.ref.update({ 'push.tokens': FieldValue.arrayRemove(...ruins) }); env += r.successCount };
  const linhas = a => { const L = []; for (const m of a.months || []) { let last = null; for (const r of m.rows || []) { if (r.w != null || r.sum != null) { last = null; continue }
    const x = r.dt ? String(r.dt).match(/^(\d{1,2})\/(\d{1,2})/) : null; if (x) last = [+x[1], +x[2]]; else if (String(r.dt || '').trim() || !(r.t || r.c)) continue;
    if (last) L.push({ ...r, ...((a.fb || {})[r.id] || {}), dia: last }) } } return L };
  // 1) feedbacks novos desde a última verificação
  const stRef = db.collection('meta').doc('notif'), st = (await stRef.get()).data() || {}, vistos = st.vistos || {}, novoV = {};
  for (const a of ATH) { const fb = a.fb || {}, mapa = Object.fromEntries(linhas(a).map(r => [r.id, r])); novoV[a.id] = {}; const novos = [];
    for (const [id, f] of Object.entries(fb)) { if (id.startsWith('_') || !f || !f.s) continue; const k = f.s + '|' + (f.r || '') + '|' + (f.kmd || ''); novoV[a.id][id] = k;
      if (st.vistos && (vistos[a.id] || {})[id] !== k && mapa[id]) novos.push({ ...mapa[id], ...f }) }
    if (cp.feedback !== false && novos.length) { const nome = String(a.nome || 'Aluno').split(' ')[0];
      const body = novos.slice(0, 4).map(r => `${r.s === '✓' ? '✓' : '✗'} ${pad(r.dia[0])}/${pad(r.dia[1])} ${r.t || 'Treino'}${r.s === '✓' && r.r ? ' · esforço ' + r.r : ''}${r.s === '✓' && r.kmd ? ' · ' + String(r.kmd).replace('.', ',') + ' km' : ''}${r.o ? ' · "' + String(r.o).slice(0, 60) + '"' : ''}`).join('\n');
      await enviar({ title: `${nome} ${novos.some(r => r.s === '✓') ? 'registrou o treino' : 'marcou treino não feito'}`, body }) } }
  await stRef.set({ vistos: novoV, em: new Date().toISOString() });
  // 2) resumos (12h e 22h)
  const env0 = (cp.enviados && cp.enviados[hojeK]) || [];
  const hora = [...new Set(cp.horas || [12])].filter(h => h <= H && H - h <= 2 && !env0.includes(h)).sort((x, y) => y - x)[0];
  if (hora != null) { await cu.ref.update({ 'push.enviados': { [hojeK]: [...env0, hora] } });
    const lin = ATH.map(a => { const hoje = linhas(a).filter(r => r.dia[0] === D && r.dia[1] === M && r.t && !/descanso|off/.test(norm(r.t))); if (!hoje.length) return null;
      const nome = String(a.nome || 'Aluno').split(' ')[0]; return hora < 20 ? `${nome}: ${hoje.map(r => r.t).join(' + ')}` : `${nome}: ${hoje.map(r => (r.s === '✓' ? '✓ ' : r.s === '✗' ? '✗ ' : '⏳ ') + r.t).join(' + ')}` }).filter(Boolean);
    if (lin.length) await enviar({ title: hora < 20 ? 'Treinos de hoje dos alunos' : 'Fechamento do dia', body: lin.join('\n') }) }
}
console.log('Hora', H, '· notificações enviadas:', env);
