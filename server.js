require('dotenv').config();
const express = require('express'), { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const app = express();
app.use(express.json({ limit: '25mb' }));
app.use(express.static(require('path').join(__dirname, 'public')));
const q = (s, p) => pool.query(s, p).then(r => r.rows);
const wrap = fn => (req, res) => fn(req, res).catch(e => { console.error(e); res.status(500).json({ error: e.message }); });

app.get('/api/laporan', wrap(async (_, res) =>
  res.json(await q(`select id, data->>'tanggal' tanggal, data->>'tempat' tempat,
    data->'jenis' jenis, data->'sasaran' sasaran, data->'teknik' teknik,
    data->>'penandatangan' penandatangan,
    case when jsonb_typeof(data->'foto')='array' then jsonb_array_length(data->'foto') else 0 end foto,
    updated_at
    from laporan order by data->>'tanggal' desc nulls last, id desc`))));
// Tanda tangan pengawas terakhir, dipakai ulang untuk laporan baru
app.get('/api/ttd-pengawas', wrap(async (_, res) => {
  const [r] = await q(`select data->>'ttdPengawas' ttd from laporan
    where coalesce(data->>'ttdPengawas','') <> '' order by updated_at desc limit 1`);
  res.json({ ttd: r ? r.ttd : '' });
}));
app.get('/api/laporan/:id', wrap(async (req, res) => {
  const [r] = await q('select id, data from laporan where id=$1', [req.params.id]);
  r ? res.json({ ...r.data, id: r.id }) : res.sendStatus(404);
}));
app.post('/api/laporan', wrap(async (req, res) => {
  const [r] = await q('insert into laporan(data) values($1) returning id', [req.body]);
  res.json({ id: r.id });
}));
app.put('/api/laporan/:id', wrap(async (req, res) => {
  await q('update laporan set data=$1, updated_at=now() where id=$2', [req.body, req.params.id]);
  res.json({ ok: true });
}));
app.delete('/api/laporan/:id', wrap(async (req, res) => {
  await q('delete from laporan where id=$1', [req.params.id]);
  res.json({ ok: true });
}));
// Lokal: node server.js. Di Vercel: app diekspor sebagai serverless function.
if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log('Jalan di http://localhost:' + port));
}
module.exports = app;
