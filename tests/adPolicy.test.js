import assert from 'node:assert/strict';
import { test } from 'node:test';
import handler, { getAdPolicy } from '../api/ad-policy.js';
import { isAdProviderEnabled } from '../src/lib/adPolicy.js';

test('Russian IP country enables PARI and blocks 1win regardless of casing', () => {
  for (const country of ['RU', 'ru', ' RU ']) {
    const policy = getAdPolicy(country);
    assert.equal(isAdProviderEnabled(policy, 'pari'), true);
    assert.equal(isAdProviderEnabled(policy, 'onewin'), false);
    assert.equal(policy.adsEnabled, false);
  }
});

test('missing or invalid geolocation fails closed', () => {
  for (const country of [undefined, null, '', 'XX', 'ZZ', 'T1', 'Russia', ['DE'], 'RU,DE']) {
    const policy = getAdPolicy(country);
    assert.equal(isAdProviderEnabled(policy, 'onewin'), false);
    assert.equal(isAdProviderEnabled(policy, 'pari'), false);
  }
});

test('known non-Russian IP countries retain banners', () => {
  for (const country of ['DE', 'US', 'PL', 'NL', 'GB', 'AM']) {
    const policy = getAdPolicy(country);
    assert.equal(isAdProviderEnabled(policy, 'onewin'), true);
    assert.equal(isAdProviderEnabled(policy, 'pari'), false);
  }
});

test('loading, failed and unknown provider decisions never mount ads', () => {
  for (const policy of [null, undefined, {}, { adsEnabled: 'true', pariEnabled: 'true' }]) {
    assert.equal(isAdProviderEnabled(policy, 'onewin'), false);
    assert.equal(isAdProviderEnabled(policy, 'pari'), false);
  }
  assert.equal(isAdProviderEnabled(getAdPolicy('RU'), 'unknown'), false);
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
    assert.equal(policy.pariEnabled, country === 'RU');
    for (const key of ['Cache-Control', 'CDN-Cache-Control', 'Vercel-CDN-Cache-Control']) {
      assert.match(headers[key], /no-store/);
    }
  }
});
