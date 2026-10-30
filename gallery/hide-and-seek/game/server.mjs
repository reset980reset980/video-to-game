#!/usr/bin/env node
// Local server: serves the game and relays Jev calls, so the key stays on this machine.
//
// Usage:
//   node server.mjs                      # http://127.0.0.1:8000, local brain only
//   JEV_API_KEY=... node server.mjs      # with Jev
//   node server.mjs --port 8080
// A .env file next to this script (JEV_API_KEY=..., JEV_ACCESS_CODE=...) is read too; it is git-ignored.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const envFile = join(ROOT, '.env');
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
const { handleJev } = await import('./api/_jev.mjs');

const args = process.argv.slice(2);
const port = +(args[args.indexOf('--port') + 1] || 0) || 8000;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://local');
  if (url.pathname === '/api/jev') {
    let bodyText = '';
    for await (const chunk of req) { bodyText += chunk; if (bodyText.length > 64 * 1024) break; }
    const { status, body } = await handleJev({ method: req.method, headers: req.headers, bodyText, ip: req.socket.remoteAddress });
    res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    return res.end(JSON.stringify(body));
  }
  const path = normalize(join(ROOT, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname)));
  if (!path.startsWith(ROOT) || path.includes(`${ROOT}/api`) || path.endsWith('.env')) { res.writeHead(404); return res.end(); }
  try {
    const data = await readFile(path);
    res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'application/octet-stream' });
    res.end(data);
  } catch { res.writeHead(404); res.end(); }
}).listen(port, '127.0.0.1', () => {
  console.log(`http://127.0.0.1:${port}/  Jev: ${process.env.JEV_API_KEY ? 'key set' : 'no key (local brain)'}`);
});
