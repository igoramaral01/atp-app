// Leitura de prints de corrida (Strava, ASICS Runkeeper, Garmin, Nike...) com o Claude.
// Variável na Vercel: GEMINI_API_KEY (Google AI Studio, tem cota gratuita) ou ANTHROPIC_API_KEY.
// Sem nenhuma, responde 503 e o app usa o leitor do próprio celular.
const Anthropic = require('@anthropic-ai/sdk');

const N = t => ({ type: [t, 'null'] });
const SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['e_atividade', 'app', 'km', 'tempo_seg', 'pace_seg_km', 'fc_media', 'kcal', 'elevacao_m', 'data', 'tiros'],
  properties: {
    e_atividade: { type: 'boolean' },
    app: { type: 'string' },
    km: N('number'), tempo_seg: N('integer'), pace_seg_km: N('integer'),
    fc_media: N('integer'), kcal: N('integer'), elevacao_m: N('integer'),
    data: N('string'),
    tiros: {
      anyOf: [{ type: 'null' }, {
        type: 'object', additionalProperties: false, required: ['n', 'km', 'paces_seg_km'],
        properties: { n: { type: 'integer' }, km: { type: 'number' }, paces_seg_km: { type: 'array', items: { type: 'integer' } } }
      }]
    }
  }
};
const PROMPT = `Estes são prints de UMA atividade de corrida/caminhada (apps como Strava, ASICS Runkeeper, Garmin, Nike Run Club, Apple Fitness), em português ou inglês.
Extraia os números do RESUMO DA ATIVIDADE INTEIRA, nunca de uma parcial, volta ou tiro:
- km: distância total em km (converta milhas: ×1.609). Use o número exatamente como aparece (ex.: 5,02 → 5.02).
- tempo_seg: tempo total em segundos (tempo em movimento se houver os dois; "Duration"/"Tempo"/"Moving time"). Ex.: 27:36 → 1656; 1:02:10 → 3730.
- pace_seg_km: ritmo médio em segundos por km (ex.: 5:30 /km → 330). Se o app mostrar /mi, converta para /km.
- fc_media: frequência cardíaca média (bpm), kcal: calorias, elevacao_m: ganho de elevação em metros.
- data: data da atividade no formato AAAA-MM-DD se aparecer (o ano atual é ${new Date().getFullYear()} se não estiver escrito).
- tiros: se houver uma tabela de intervalos/tiros/splits com várias repetições da mesma distância curta de trabalho (ex.: 7 × 0,30 km), informe n (quantidade), km (distância de cada tiro) e paces_seg_km (ritmo de cada tiro, em s/km, na ordem). Ignore os trechos de recuperação/descanso. Se não houver, null.
- app: nome do aplicativo, se der para reconhecer ("" se não).
- e_atividade: false se as imagens não forem de um resumo de atividade física.
Use null para qualquer valor que não esteja visível. Não invente nem calcule valores que não aparecem, exceto as conversões de unidade pedidas.`;

const JSON_HINT = `\nResponda SOMENTE com um JSON neste formato (sem texto antes ou depois):
{"e_atividade":true,"app":"","km":null,"tempo_seg":null,"pace_seg_km":null,"fc_media":null,"kcal":null,"elevacao_m":null,"data":null,"tiros":null}
onde tiros, quando existir, é {"n":7,"km":0.3,"paces_seg_km":[240,238]}.`;
async function viaGemini(imgs) {
  const key = process.env.GEMINI_API_KEY;
  const parts = imgs.map(u => { const m = u.match(/^data:(image\/\w+);base64,(.+)$/); return { inline_data: { mime_type: m[1], data: m[2] } } });
  parts.push({ text: PROMPT + JSON_HINT });
  const models = [process.env.GEMINI_MODEL, 'gemini-flash-latest', 'gemini-2.5-flash'].filter(Boolean);
  let last = null;
  for (const model of models) {
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent', {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig: { responseMimeType: 'application/json', temperature: 0 } })
    });
    const j = await r.json().catch(() => ({}));
    if (r.status === 404) { last = j; continue }            // modelo não existe mais: tenta o próximo
    if (r.status === 429) { const e = new Error('limite'); e.code = 429; throw e }
    if (!r.ok) { const e = new Error((j.error && j.error.message) || ('Gemini ' + r.status)); e.code = 502; throw e }
    const txt = ((j.candidates || [])[0]?.content?.parts || []).map(p => p.text || '').join('');
    const m = txt.match(/\{[\s\S]*\}/); if (!m) { const e = new Error('resposta sem JSON'); e.code = 422; throw e }
    return JSON.parse(m[0]);
  }
  const e = new Error('Nenhum modelo Gemini disponível' + (last && last.error ? ': ' + last.error.message : '')); e.code = 502; throw e;
}
module.exports = async (req, res) => {
  res.setHeader('cache-control', 'no-store');
  if (req.method === 'GET') { // diagnóstico: abra /api/print no navegador
    const out = { gemini_configurado: !!process.env.GEMINI_API_KEY, claude_configurado: !!process.env.ANTHROPIC_API_KEY };
    if (process.env.GEMINI_API_KEY) {
      for (const model of [process.env.GEMINI_MODEL, 'gemini-flash-latest', 'gemini-2.5-flash'].filter(Boolean)) {
        try { const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent', { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY }, body: JSON.stringify({ contents: [{ parts: [{ text: 'Responda só: ok' }] }] }) });
          const j = await r.json().catch(() => ({})); if (r.status === 404) continue;
          out.teste_gemini = r.ok ? 'OK, funcionando (modelo ' + model + ')' : 'ERRO ' + r.status + ': ' + ((j.error && j.error.message) || ''); break }
        catch (e) { out.teste_gemini = 'ERRO: ' + e.message; break } }
      if (!out.teste_gemini) out.teste_gemini = 'ERRO: nenhum modelo Gemini encontrado';
    } else out.teste_gemini = 'Chave GEMINI_API_KEY não encontrada. Confira o nome e faça Redeploy.';
    return res.json(out);
  }
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Use POST' });
  if (!process.env.ANTHROPIC_API_KEY && !process.env.GEMINI_API_KEY) return res.status(503).json({ erro: 'Leitura com IA não configurada.' });
  const host = req.headers['x-forwarded-host'] || req.headers.host, orig = req.headers.origin || '';
  if (orig && !orig.endsWith('//' + host)) return res.status(403).json({ erro: 'Origem não permitida' });
  try {
    const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const imgs = (Array.isArray(b.imgs) ? b.imgs : []).filter(s => typeof s === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(s)).slice(0, 6);
    if (!imgs.length) return res.status(400).json({ erro: 'Nenhuma imagem recebida' });
    if (process.env.GEMINI_API_KEY) {
      try { return res.json({ ok: true, dados: await viaGemini(imgs) }) }
      catch (e) { if (e.code === 429) return res.status(429).json({ erro: 'Muitas leituras agora. Tente em 1 minuto.' }); return res.status(e.code || 500).json({ erro: 'Não consegui ler: ' + e.message }) }
    }
    const client = new Anthropic();
    const content = imgs.map(u => { const m = u.match(/^data:(image\/\w+);base64,(.+)$/); return { type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } } });
    content.push({ type: 'text', text: PROMPT });
    const r = await client.beta.messages.create({
      model: 'claude-opus-5-5', max_tokens: 4000,
      betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
      output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
      messages: [{ role: 'user', content }]
    });
    if (r.stop_reason === 'refusal') return res.status(422).json({ erro: 'Não consegui ler este print.' });
    const txt = r.content.filter(c => c.type === 'text').map(c => c.text).join('');
    return res.json({ ok: true, dados: JSON.parse(txt) });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return res.status(429).json({ erro: 'Muitas leituras agora. Tente em 1 minuto.' });
    if (e instanceof Anthropic.APIError) return res.status(502).json({ erro: 'Serviço de leitura indisponível (' + (e.status || '') + ').' });
    return res.status(500).json({ erro: String(e.message || e) });
  }
};
