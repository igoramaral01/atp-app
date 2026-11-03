const { edb, toEn } = require('./_edb');
const { nomePT, alvoPT } = require('./_pt');
module.exports = async (req, res) => {
  const q = String(req.query.q || ''); const en = toEn(q);
  const r = await edb('/exercises/name/' + encodeURIComponent(en) + '?limit=20');
  let items = r.ok ? await r.json() : [];
  if (!Array.isArray(items)) items = [];
  items = items.map(x => ({ ...x, nome: nomePT(x.name), alvoPT: alvoPT(x.target) }));
  res.setHeader('cache-control', 's-maxage=86400');
  res.json({ q, en, items: Array.isArray(items) ? items : [] });
};
