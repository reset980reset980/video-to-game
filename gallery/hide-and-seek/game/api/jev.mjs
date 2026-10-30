// Vercel serverless function: GET /api/jev (status) and POST /api/jev (one team decision).
// Set JEV_API_KEY (and optionally JEV_ACCESS_CODE) in the Vercel project's environment variables.
import { handleJev } from './_jev.mjs';

export default async function handler(req, res) {
  let bodyText = '';
  if (req.method === 'POST') {
    bodyText = typeof req.body === 'string' ? req.body : req.body ? JSON.stringify(req.body) : '';
  }
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const { status, body } = await handleJev({ method: req.method, headers: req.headers, bodyText, ip });
  res.setHeader('cache-control', 'no-store');
  res.status(status).json(body);
}
