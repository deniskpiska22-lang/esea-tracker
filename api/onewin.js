import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { getAdPolicy } from './ad-policy.js';
import { AD_LANGUAGES } from '../src/lib/adLanguage.js';

const OFFER_URL = 'https://1win.com/?open=register&p=g39d';
export default async function handler(req, res) {
  for (const name of ['Cache-Control', 'CDN-Cache-Control', 'Vercel-CDN-Cache-Control']) {
    res.setHeader(name, 'private, no-store, max-age=0');
  }
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (!['GET', 'HEAD'].includes(req.method)) return res.status(405).end('Method not allowed');
  if (!getAdPolicy(req.headers['x-vercel-ip-country']).adsEnabled) return res.status(403).end('Unavailable');
  if (req.query.kind === 'click') return res.redirect(302, OFFER_URL);
  if (req.query.kind !== 'image' || !AD_LANGUAGES.includes(req.query.lang)) return res.status(404).end('Not found');
  try {
    const image = await readFile(path.join(process.cwd(), 'server/ad-creatives', req.query.lang + '.jpeg'));
    res.setHeader('Content-Type', 'image/jpeg');
    return res.status(200).send(req.method === 'HEAD' ? '' : image);
  } catch {
    return res.status(503).end('Temporarily unavailable');
  }
}
