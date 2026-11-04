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
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
let env = 0;
for (const d of (await db.collection('athletes').get()).docs) {
  const a = d.data(), p = a.push; if (!p || !p.tokens || !p.tokens.length || !(p.horas || []).includes(H)) continue;
  const fb = a.fb || {}; let row = null;
  for (const m of a.months || []) for (const r of m.rows || []) { if (r.w != null || r.sum != null || !r.dt) continue;
    const x = String(r.dt).match(/^(\d{1,2})\/(\d{1,2})/); if (x && +x[1] === D && +x[2] === M) row = { ...r, ...(fb[r.id] || {}) }; }
  if (!row || !row.t || /descanso|off/.test(norm(row.t)) || row.s) continue;
  const nome = String(a.nome || '').split(' ')[0], desc = String(row.c || '').split('\n')[0];
  const n = H < 12 ? { title: `Bom dia, ${nome}! Treino de hoje: ${row.t}`, body: desc || 'Abra o ATP para ver os detalhes.' }
    : H < 20 ? { title: `${nome}, seu treino de hoje te espera`, body: `${row.t}${desc ? ' · ' + desc : ''}` }
    : { title: 'Já treinou hoje?', body: `Marque o ${row.t} como feito e envie seu feedback ao treinador.` };
  const r = await msg.sendEachForMulticast({ tokens: p.tokens, notification: n, webpush: { fcmOptions: { link: 'https://atp-app-two.vercel.app/' }, notification: { icon: '/img/icon-192.png' } } });
  const ruins = p.tokens.filter((t, i) => !r.responses[i].success && /not-registered|invalid-registration|invalid-argument/.test(r.responses[i].error?.code || ''));
  if (ruins.length) await d.ref.update({ 'push.tokens': FieldValue.arrayRemove(...ruins) });
  env += r.successCount;
}
console.log('Hora', H, '· notificações enviadas:', env);
