const { edb, toEn } = require('./_edb');
module.exports = async (req, res) => {
  const q = String(req.query.q || ''); const en = toEn(q);
  const r = await edb('/exercises/name/' + encodeURIComponent(en) + '?limit=20');
  const items = r.ok ? await r.json() : [];
  res.setHeader('cache-control', 's-maxage=86400');
  res.json({ q, en, items: Array.isArray(items) ? items : [] });
};
