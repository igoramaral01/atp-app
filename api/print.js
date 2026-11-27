// Leitura de prints de corrida (Strava, ASICS Runkeeper, Garmin, Nike...) com o Claude.
// Variável na Vercel: ANTHROPIC_API_KEY. Sem ela, responde 503 e o app usa o leitor do próprio celular.
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

module.exports = async (req, res) => {
  res.setHeader('cache-control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Use POST' });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ erro: 'Leitura com IA não configurada.' });
  const host = req.headers['x-forwarded-host'] || req.headers.host, orig = req.headers.origin || '';
  if (orig && !orig.endsWith('//' + host)) return res.status(403).json({ erro: 'Origem não permitida' });
  try {
    const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const imgs = (Array.isArray(b.imgs) ? b.imgs : []).filter(s => typeof s === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(s)).slice(0, 6);
    if (!imgs.length) return res.status(400).json({ erro: 'Nenhuma imagem recebida' });
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
