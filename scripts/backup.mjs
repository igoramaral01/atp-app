// Backup diário: copia todo o banco do Firestore para backups/AAAA-MM-DD.json
// Roda no GitHub Actions com a chave da conta de serviço no segredo FIREBASE_SA.
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { mkdirSync, writeFileSync } from 'node:fs';

const sa = JSON.parse(process.env.FIREBASE_SA || '{}');
if (!sa.project_id) { console.error('Segredo FIREBASE_SA ausente ou inválido.'); process.exit(1); }
initializeApp({ credential: cert(sa) });
const db = getFirestore();

async function dump(ref) {
  const out = {};
  for (const col of await ref.listCollections()) {
    out[col.id] = {};
    for (const doc of (await col.get()).docs) {
      out[col.id][doc.id] = { data: doc.data(), sub: await dump(doc.ref) };
    }
  }
  return out;
}
const data = await dump(db);
const day = new Date().toISOString().slice(0, 10);
mkdirSync('backups', { recursive: true });
writeFileSync(`backups/${day}.json`, JSON.stringify(data, null, 1));
writeFileSync('backups/ultimo.json', JSON.stringify(data, null, 1));
console.log('Backup salvo:', day, Object.keys(data));
