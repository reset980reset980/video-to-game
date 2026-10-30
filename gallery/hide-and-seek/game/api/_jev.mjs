// Shared Jev relay used by the Vercel function (api/jev.mjs) and the local server (server.mjs).
// The browser never sees JEV_API_KEY: it sends a team's state and questions, this relay checks their shape,
// forwards them to TypeSafe's System One endpoint and returns only the answers.
//
// Environment:
//   JEV_API_KEY       TypeSafe key. Without it the game runs on its local brain.
//   JEV_ACCESS_CODE   optional; when set, players must type this code on the title screen to use Jev.
//   JEV_UPSTREAM      optional override of the endpoint (default https://api.typesafe.ai/v1/systemone).
import { timingSafeEqual } from 'node:crypto';

const UPSTREAM = () => process.env.JEV_UPSTREAM || 'https://api.typesafe.ai/v1/systemone';
const key = () => (process.env.JEV_API_KEY || '').trim();
const code = () => (process.env.JEV_ACCESS_CODE || '').trim();
const MAX_BODY = 48 * 1024;
const QKEY = /^[a-z][A-Za-z0-9_]{0,40}$/;

// per-instance limit: enough for two teams deciding every ~1.5 s, not enough to drain the key
const hits = new Map();
function allowed(ip, now = Date.now()) {
  for (const [k, v] of hits) if (v.until <= now) hits.delete(k);
  let h = hits.get(ip);
  if (!h) { if (hits.size > 2000) return false; h = { n: 0, until: now + 60_000 }; hits.set(ip, h); }
  return ++h.n <= 150;
}

function codeOk(given) {
  const want = code();
  if (!want) return true;
  const a = Buffer.from(String(given || '')), b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}

function checkQuestions(qs) {
  const names = Object.keys(qs || {});
  if (names.length < 1 || names.length > 16) return 'questions: 1 to 16';
  for (const n of names) {
    const q = qs[n];
    if (!QKEY.test(n) || !q || typeof q !== 'object') return 'question name';
    if (typeof q.instructions !== 'string' || q.instructions.length > 800) return 'instructions';
    if (q.type === 'choice') {
      const c = q.criteria;
      if (!c || Array.isArray(c) || typeof c !== 'object') return 'choice criteria';
      const ks = Object.keys(c);
      if (ks.length < 1 || ks.length > 40 || ks.some(k => !QKEY.test(k) || typeof c[k] !== 'string' || c[k].length > 300)) return 'choice criteria';
    } else if (q.type === 'score') {
      if (!Array.isArray(q.criteria) || q.criteria.length < 2 || q.criteria.length > 10 || q.criteria.some(s => typeof s !== 'string')) return 'score criteria';
    } else if (q.type === 'noul') {
      const c = q.criteria;
      if (!c || typeof c.true !== 'string' || typeof c.false !== 'string') return 'noul criteria';
    } else return 'question type';
  }
  return '';
}

// One request in, one { status, body } out; no framework types so both hosts can use it.
export async function handleJev({ method, headers, bodyText, ip }) {
  const h = name => headers[name] ?? headers[name.toLowerCase()] ?? '';
  if (method === 'GET') {
    return { status: 200, body: { service: 'hide-and-seek-jev', configured: !!key(), codeRequired: !!code() } };
  }
  if (method !== 'POST') return { status: 405, body: { error: 'method' } };
  if (!key()) return { status: 503, body: { error: 'JEV_API_KEY is not set', code: 'JEV_NOT_CONFIGURED' } };
  if (!codeOk(h('x-access-code'))) return { status: 401, body: { error: 'access code', code: 'ACCESS_CODE' } };
  if (!allowed(ip || 'unknown')) return { status: 429, body: { error: 'too many requests' } };
  if (!String(h('content-type')).startsWith('application/json')) return { status: 415, body: { error: 'json only' } };
  if (!bodyText || bodyText.length > MAX_BODY) return { status: 413, body: { error: 'body size' } };

  let req;
  try { req = JSON.parse(bodyText); } catch { return { status: 400, body: { error: 'json' } }; }
  if (!req || typeof req.state !== 'object' || Array.isArray(req.state)) return { status: 400, body: { error: 'state' } };
  const bad = checkQuestions(req.questions);
  if (bad) return { status: 400, body: { error: bad } };

  try {
    const r = await fetch(UPSTREAM(), {
      method: 'POST',
      headers: { authorization: 'Bearer ' + key(), 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'jev-latest', state: req.state, questions: req.questions }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok) return { status: [400, 401, 403, 422, 429].includes(r.status) ? r.status : 502, body: { error: 'upstream', upstreamStatus: r.status } };
    const out = await r.json();
    if (!out || !out.answers) return { status: 502, body: { error: 'no answers' } };
    return { status: 200, body: { answers: out.answers, usage: out.usage ?? null } };
  } catch {
    return { status: 504, body: { error: 'timeout' } };
  }
}
