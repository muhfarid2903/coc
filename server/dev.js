#!/usr/bin/env node
/* Server pengembangan lokal.

   Di produksi, Traefik yang menyatukan situs statis dan API pada satu
   origin. Di laptop tidak ada Traefik, sedangkan seluruh fitur kelas
   bergantung pada keduanya satu origin (cookie SameSite, tanpa CORS).
   Berkas ini menirukan susunan itu: berkas statis dari akar repo, dan
   /api diteruskan ke server.js yang jalan di dalam proses yang sama.

     node server/dev.js            lalu buka http://localhost:8080

   Basis data uji ditulis ke server/dev-data/coc.db supaya tidak pernah
   bercampur dengan data sungguhan di server.
*/
'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const AKAR = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT) || 8080;
const PORT_API = 8099;

const dataDir = path.join(__dirname, 'dev-data');
fs.mkdirSync(dataDir, { recursive: true });

process.env.PORT = String(PORT_API);
process.env.DB_PATH = process.env.DB_PATH || path.join(dataDir, 'coc.db');
if (!process.env.SANDI_GURU_SCRYPT) {
  const crypto = require('node:crypto');
  const salt = crypto.randomBytes(16);
  process.env.SANDI_GURU_SCRYPT = salt.toString('hex') + ':' +
    crypto.scryptSync('guru-lokal', salt, 32).toString('hex');
  console.log('[dev] frasa sandi guru untuk sesi ini: guru-lokal');
}
require('./server.js');

const TIPE = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');

  if (url.pathname.startsWith('/api')) {
    const proxy = http.request({
      host: '127.0.0.1', port: PORT_API, path: req.url, method: req.method, headers: req.headers
    }, (r) => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
    proxy.on('error', () => { res.writeHead(502).end('api mati'); });
    req.pipe(proxy);
    return;
  }

  let rel = decodeURIComponent(url.pathname);
  if (rel.endsWith('/')) rel += 'index.html';

  // Jangan biarkan ../ keluar dari akar repo.
  const berkas = path.join(AKAR, path.normalize(rel).replace(/^(\.\.[/\\])+/, ''));
  if (!berkas.startsWith(AKAR)) { res.writeHead(403).end('terlarang'); return; }

  fs.readFile(berkas, (err, buf) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }).end('404'); return; }
    res.writeHead(200, {
      'Content-Type': TIPE[path.extname(berkas)] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    res.end(buf);
  });
}).listen(PORT, () => {
  console.log(`[dev] situs   http://localhost:${PORT}/`);
  console.log(`[dev] dasbor  http://localhost:${PORT}/guru/`);
});
