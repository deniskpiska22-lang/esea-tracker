import test from 'node:test';
import assert from 'node:assert/strict';

test('bootstrap and Home share one feed request, cache successes, and retry failures', async t => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  let calls = 0;
  let release;
  globalThis.fetch = () => { calls++; return new Promise(resolve => { release = resolve; }); };
  const { requestHomeFeed } = await import('../src/lib/homeFeedRequest.js?test=success');
  const first = requestHomeFeed();
  const second = requestHomeFeed();
  assert.equal(first, second);
  release({ ok: true, json: async () => ({ ok: true, rows: [{ id: 'match' }] }) });
  assert.deepEqual(await first, [{ id: 'match' }]);
  assert.deepEqual(await requestHomeFeed(), [{ id: 'match' }]);
  assert.equal(calls, 1);

  globalThis.fetch = async () => ({ ok: false });
  const retry = await import('../src/lib/homeFeedRequest.js?test=retry');
  await assert.rejects(retry.requestHomeFeed(), /unavailable/);
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ ok: true, rows: [] }) });
  assert.deepEqual(await retry.requestHomeFeed(), []);
});
