import assert from 'node:assert/strict';
import { test } from 'node:test';
import handler, { getAdPolicy } from '../api/ad-policy.js';

test('Russian IP country blocks ads regardless of casing', () => {
  for (const country of ['RU', 'ru', ' RU ']) assert.equal(getAdPolicy(country).adsEnabled, false);
});

test('missing or invalid geolocation fails closed', () => {
  for (const country of [undefined, null, '', 'XX', 'ZZ', 'T1', 'Russia', ['DE'], 'RU,DE']) {
    assert.equal(getAdPolicy(country).adsEnabled, false);
  }
});

test('known non-Russian IP countries retain banners', () => {
  for (const country of ['DE', 'US', 'PL', 'NL', 'GB']) assert.equal(getAdPolicy(country).adsEnabled, true);
});

test('country decisions are not cached or shared between visitors', () => {
  for (const country of ['DE', 'RU', undefined]) {
    const headers = {};
    let policy;
    handler({headers: {'x-vercel-ip-country': country}}, {
      setHeader(key, value) { headers[key] = value; },
      status(code) { assert.equal(code, 200); return this; },
      json(value) { policy = value; },
    });
    assert.equal(policy.adsEnabled, country === 'DE');
    for (const key of ['Cache-Control', 'CDN-Cache-Control', 'Vercel-CDN-Cache-Control']) {
      assert.match(headers[key], /no-store/);
    }
  }
});
