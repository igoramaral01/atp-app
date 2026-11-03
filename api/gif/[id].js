const { edb } = require('../_edb');
module.exports = async (req, res) => {
  const id = String(req.query.id || '').replace(/\W/g, '');
  const r = await edb('/image?exerciseId=' + id + '&resolution=180');
  if (!r.ok) return res.status(404).end();
  res.setHeader('content-type', 'image/gif');
  res.setHeader('cache-control', 'public, s-maxage=2592000, max-age=86400');
  res.end(Buffer.from(await r.arrayBuffer()));
};
