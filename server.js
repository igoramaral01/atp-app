// Servidor do app ATP: entrega as páginas e faz a ponte com o ExerciseDB
// (a chave fica só aqui no servidor, o aluno nunca vê).
const http = require('http');
const fs = require('fs');
const path = require('path');

for (const l of fs.existsSync('.env') ? fs.readFileSync('.env', 'utf8').split('\n') : []) {
  const m = l.match(/^(\w+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
const KEY = process.env.EXERCISEDB_KEY;
const HOST = 'exercisedb.p.rapidapi.com';
const PORT = process.env.PORT || 3000;

// Português -> inglês (termos mais usados na academia)
const PT = {
  agachamento: 'squat', supino: 'bench press', remada: 'row', puxada: 'pulldown', 'barra fixa': 'pull-up',
  stiff: 'stiff leg deadlift', 'levantamento terra': 'deadlift', terra: 'deadlift', 'leg press': 'leg press',
  panturrilha: 'calf raise', avanço: 'lunge', afundo: 'lunge', passada: 'walking lunge', 'elevação pélvica': 'hip thrust',
  ponte: 'glute bridge', prancha: 'plank', abdominal: 'crunch', rosca: 'curl', tríceps: 'triceps', triceps: 'triceps',
  desenvolvimento: 'shoulder press', 'elevação lateral': 'lateral raise', crucifixo: 'fly', flexão: 'push-up',
  'cadeira extensora': 'leg extension', extensora: 'leg extension', 'mesa flexora': 'leg curl', flexora: 'leg curl',
  abdução: 'abduction', adução: 'adduction', mergulho: 'dips', paralelas: 'dips', encolhimento: 'shrug', burpee: 'burpee',
  'bird dog': 'bird dog', hiperextensão: 'hyperextension', 'face pull': 'face pull', polia: 'cable', halter: 'dumbbell',
  barra: 'barbell', elástico: 'band', kettlebell: 'kettlebell', búlgaro: 'bulgarian split squat',
};
function toEn(q) {
  let s = q.toLowerCase().trim();
  if (PT[s]) return PT[s];
  for (const k of Object.keys(PT).sort((a, b) => b.length - a.length)) s = s.replace(k, PT[k]);
  return s;
}

async function edb(p) {
  const r = await fetch('https://' + HOST + p, { headers: { 'x-rapidapi-key': KEY, 'x-rapidapi-host': HOST } });
  return r;
}

const gifCache = new Map();
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  try {
    if (u.pathname === '/api/search') {
      const q = u.searchParams.get('q') || '';
      const en = toEn(q);
      const r = await edb('/exercises/name/' + encodeURIComponent(en) + '?limit=20');
      const data = r.ok ? await r.json() : [];
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ q, en, items: Array.isArray(data) ? data : [] }));
    }
    const g = u.pathname.match(/^\/api\/gif\/(\w+)$/);
    if (g) {
      let buf = gifCache.get(g[1]);
      if (!buf) {
        const r = await edb('/image?exerciseId=' + g[1] + '&resolution=180');
        if (!r.ok) { res.writeHead(404); return res.end(); }
        buf = Buffer.from(await r.arrayBuffer()); gifCache.set(g[1], buf);
      }
      res.writeHead(200, { 'content-type': 'image/gif', 'cache-control': 'private, max-age=86400' });
      return res.end(buf);
    }
    const TYPES = { '.html': 'text/html; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.js': 'text/javascript', '.css': 'text/css' };
    const rel = u.pathname === '/' ? 'index.html' : decodeURIComponent(u.pathname).replace(/^\/+/, '');
    const file = path.join(__dirname, 'public', path.normalize(rel));
    if (file.startsWith(path.join(__dirname, 'public')) && fs.existsSync(file) && fs.statSync(file).isFile()) {
      res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
      return res.end(fs.readFileSync(file));
    }
    res.writeHead(404); res.end('Não encontrado');
  } catch (e) {
    res.writeHead(500); res.end('Erro: ' + e.message);
  }
});
server.listen(PORT, () => console.log('ATP rodando em http://localhost:' + PORT));
