// Publica firestore.rules no projeto (usa a conta de serviço do segredo FIREBASE_SA).
import { initializeApp, cert } from 'firebase-admin/app';
import { getSecurityRules } from 'firebase-admin/security-rules';
import { readFileSync } from 'node:fs';
const sa = JSON.parse(process.env.FIREBASE_SA || '{}');
if (!sa.project_id) { console.error('Segredo FIREBASE_SA ausente.'); process.exit(1); }
initializeApp({ credential: cert(sa) });
const r = await getSecurityRules().releaseFirestoreRulesetFromSource(readFileSync('firestore.rules', 'utf8'));
console.log('Regras publicadas:', r.name, r.createTime);
