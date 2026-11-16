import test from 'node:test';
import assert from 'node:assert/strict';
import { coachLobbyRejection } from '../server/coachLobby.js';
import { scanCoachLobbies } from '../server/coachLobbyScan.js';

test('a denied lobby leaves match evidence untouched and persists the upstream pause across restarts', async () => {
  const start = Date.parse('2026-11-16T18:00:00Z');
  const retryAt = start + 7200000;
  const denial = coachLobbyRejection(new Response('', {
    status: 403, headers: { 'Retry-After': '7200', 'Content-Type': 'text/html',
      'CF-Mitigated': 'challenge', Server: 'cloudflare', 'Set-Cookie': 'not logged' },
  }), start);
  const requests = [], deferred = [], saved = [];
  let stored;
  let now = start;
  const options = {
    due: async () => [{ id: 'first' }, { id: 'second' }],
    fetchRoom: async row => {
      requests.push(row.id);
      if (now === start) throw denial;
      return { match_id: row.id, coach_ids: ['coach'] };
    },
    saveRoom: async row => saved.push(row.match_id),
    deferRoom: async id => deferred.push(id),
    saveState: async (state, status) => { stored = { ...state, status }; },
    wait: async () => {},
    validId: () => true,
    onError: () => {},
    now: () => now,
  };
  assert.deepEqual(denial.diagnostics, { status: 403, server: 'cloudflare', format: 'html', challenge: true, retryAfter: true });
  assert.equal((await scanCoachLobbies({ ...options, state: {} })).denied, true);
  assert.deepEqual(requests, ['first']);
  assert.deepEqual(stored, { retryAt, httpStatus: 403, status: 'backoff' });
  assert.deepEqual(deferred, []);
  assert.deepEqual(saved, []);
  now = retryAt - 1;
  assert.equal((await scanCoachLobbies({ ...options, state: stored })).deferred, true);
  assert.deepEqual(requests, ['first']);
  now = retryAt;
  assert.equal((await scanCoachLobbies({ ...options, state: stored })).withCoaches, 2);
  assert.deepEqual(saved, ['first', 'second']);
  assert.equal(stored.status, 'online');
});

test('an unavailable individual room does not pause the whole source', async () => {
  const deferred = [];
  const totals = await scanCoachLobbies({
    state: {},
    due: async () => [{ id: 'gone' }, { id: 'available' }],
    fetchRoom: async row => {
      if (row.id === 'gone') throw { status: 404 };
      return { coach_ids: [] };
    },
    saveRoom: async () => {},
    deferRoom: async id => deferred.push(id),
    saveState: async () => {},
    wait: async () => {},
    validId: () => true,
    onError: () => {},
  });
  assert.deepEqual(totals, { checked: 1, withCoaches: 0, failed: 1 });
  assert.deepEqual(deferred, ['gone']);
});
