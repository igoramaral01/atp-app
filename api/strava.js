// Integração com o Strava (OAuth). Variáveis na Vercel: STRAVA_CLIENT_ID e STRAVA_CLIENT_SECRET.
// a=start  -> manda o aluno para a tela de autorização do Strava
// a=cb     -> Strava devolve o código; trocamos por tokens e voltamos ao app (#strava=...)
// a=acts   -> POST {rt, after}: renova o token e devolve as atividades depois de "after" (segundos)
const ID = process.env.STRAVA_CLIENT_ID, SECRET = process.env.STRAVA_CLIENT_SECRET;
const base = req => 'https://' + (req.headers['x-forwarded-host'] || req.headers.host);
async function token(body) {
  const r = await fetch('https://www.strava.com/oauth/token', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ client_id: ID, client_secret: SECRET, ...body }) });
  const j = await r.json(); if (!r.ok) throw new Error(j.message || 'Falha no Strava'); return j;
}
module.exports = async (req, res) => {
  res.setHeader('cache-control', 'no-store');
  if (!ID || !SECRET) return res.status(503).json({ erro: 'Strava ainda não configurado no servidor.' });
  const a = req.query.a;
  try {
    if (a === 'start') {
      const u = new URL('https://www.strava.com/oauth/mobile/authorize');
      u.search = new URLSearchParams({ client_id: ID, response_type: 'code', redirect_uri: base(req) + '/api/strava?a=cb',
        approval_prompt: 'auto', scope: 'read,activity:read_all' }).toString();
      res.statusCode = 302; res.setHeader('location', u.toString()); return res.end();
    }
    if (a === 'cb') {
      if (req.query.error || !req.query.code) { res.statusCode = 302; res.setHeader('location', '/#strava=erro'); return res.end(); }
      const t = await token({ code: req.query.code, grant_type: 'authorization_code' });
      const info = { rt: t.refresh_token, nome: [t.athlete && t.athlete.firstname, t.athlete && t.athlete.lastname].filter(Boolean).join(' '), id: t.athlete && t.athlete.id };
      res.statusCode = 302; res.setHeader('location', '/#strava=' + encodeURIComponent(Buffer.from(JSON.stringify(info)).toString('base64'))); return res.end();
    }
    if (a === 'acts' && req.method === 'POST') {
      const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      if (!b.rt) return res.status(400).json({ erro: 'Sem conexão com o Strava.' });
      const t = await token({ refresh_token: b.rt, grant_type: 'refresh_token' });
      const after = Math.max(0, parseInt(b.after) || 0);
      const r = await fetch('https://www.strava.com/api/v3/athlete/activities?per_page=100&after=' + after, { headers: { authorization: 'Bearer ' + t.access_token } });
      const L = await r.json(); if (!r.ok) return res.status(r.status).json({ erro: L.message || 'Falha ao ler atividades' });
      const acts = L.map(x => ({ id: x.id, nome: x.name, tipo: x.sport_type || x.type, data: x.start_date_local,
        km: Math.round((x.distance || 0) / 10) / 100, min: Math.round((x.moving_time || 0) / 6) / 10,
        fc: x.average_heartrate || null, alt: x.total_elevation_gain || 0 }));
      return res.json({ rt: t.refresh_token, acts });
    }
    res.status(400).json({ erro: 'Ação inválida' });
  } catch (e) { res.status(500).json({ erro: String(e.message || e) }); }
};
