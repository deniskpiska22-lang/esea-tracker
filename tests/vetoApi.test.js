import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/veto.js';

async function runCase({ row, upstreamStatus = 200, tickets = [] }) {
  const savedFetch = globalThis.fetch;
  const keys = ['VITE_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
  const env = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  process.env.VITE_SUPABASE_URL = 'https://veto-test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
  const writes = [];
  let upstreamCalls = 0;
  const response = { headers: {}, setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } };
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    if (url.startsWith('https://veto-test.supabase.co/')) {
      if (init.method === 'PATCH') {
        writes.push(JSON.parse(init.body));
        return new Response(null, { status: 204 });
      }
      return Response.json([row]);
    }
    assert.ok(url.startsWith('https://www.faceit.com/api/democracy/'));
    upstreamCalls += 1;
    return Response.json({ payload: { tickets } }, { status: upstreamStatus });
  };
  try {
    await handler({ query: { matchId: '1-test-match' } }, response);
    return { response, writes, upstreamCalls };
  } finally {
    globalThis.fetch = savedFetch;
    for (const key of keys) {
      if (env[key] === undefined) delete process.env[key];
      else process.env[key] = env[key];
    }
  }
}
const missingRow = { status: 'FINISHED', veto_steps: [], veto_unavailable: false };

test('viewing an unfinished veto cache saves exact bans and neutral decider', async () => {
  const result = await runCase({ row: missingRow, tickets: [{ entity_type: 'map', entities: [
    { guid: 'de_mirage', round: 1, status: 'drop', selected_by: 'faction1' },
    { guid: 'de_nuke', round: 2, status: 'pick', selected_by: 'faction2' },
  ] }] });
  assert.equal(result.response.code, 200);
  assert.equal(result.writes[0].veto_synced, true);
  assert.equal(result.writes[0].veto_unavailable, false);
  assert.equal(result.writes[0].veto_steps[0].selectedBy, 'faction1');
  assert.equal(result.writes[0].veto_steps[1].action, 'Decider');
});
test('finished cached veto never calls FACEIT again', async () => {
  const result = await runCase({ row: { ...missingRow, veto_steps: [{ map: 'de_nuke', round: 1, action: 'Decider', selectedBy: null }] } });
  assert.equal(result.upstreamCalls, 0);
  assert.equal(result.response.code, 200);
});
test('provider confirms unavailable veto once; cached absence avoids repeat requests', async () => {
  for (const upstreamStatus of [200, 404]) {
    const result = await runCase({ row: missingRow, upstreamStatus });
    assert.equal(result.writes[0].veto_unavailable, true);
  }
  const cached = await runCase({ row: { ...missingRow, veto_unavailable: true } });
  assert.equal(cached.upstreamCalls, 0);
  assert.equal(cached.response.data.unavailable, true);
});
test('throttling and provider outages never become permanent missing veto', async () => {
  for (const upstreamStatus of [429, 503]) {
    const result = await runCase({ row: missingRow, upstreamStatus });
    assert.equal(result.writes.length, 0);
    assert.equal(result.response.code, upstreamStatus);
  }
});
test('empty live veto is not marked permanently unavailable', async () => {
  const result = await runCase({ row: { ...missingRow, status: 'ONGOING' } });
  assert.equal(result.writes.length, 0);
});
