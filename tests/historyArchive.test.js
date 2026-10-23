import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import matches from '../src/data/matches.js';
import { buildHistoryArchive, playerHistoryKey } from '../scripts/lib/historyArchive.js';
import { historyBucket } from '../src/utils/historyBuckets.js';
import { createHistoryLoader } from '../src/utils/historyLoader.js';

const stats = JSON.parse(readFileSync(new URL('../src/data/matchStatsCompact.json', import.meta.url), 'utf8'));
const { groups, recent } = buildHistoryArchive(matches, stats);
const read = (kind, key) => groups[kind][historyBucket(key)]?.[key];

test('partitioned history retains every real team perspective and full match payload', () => {
  const byTeam = Map.groupBy(matches, match => match.teamSlug);
  const byMatch = Map.groupBy(matches, match => match.matchId || match.id);
  for (const [slug, rows] of byTeam) assert.deepEqual(read('teams', slug), rows);
  for (const [id, rows] of byMatch) assert.deepEqual(read('matches', id), rows);
  for (const [id, payload] of Object.entries(stats)) assert.deepEqual(read('stats', id), payload);
});

test('player partitions retain stats, exact team IDs, opponents, scores and dated match history', () => {
  for (const [id, payload] of Object.entries(stats)) {
    for (const team of payload.teams || []) for (const player of team.players || []) {
      const key = playerHistoryKey(player.nickname);
      const row = read('players', key).find(row => row.stats.matchId === payload.matchId);
      assert.ok(row);
      assert.equal(row.stats.map, payload.map);
      assert.deepEqual(row.matches, read('matches', id) || []);
      assert.deepEqual(row.stats.teams.map(t => [t.teamId, t.teamName, t.score]), payload.teams.map(t => [t.teamId, t.teamName, t.score]));
      assert.ok(row.stats.teams.find(t => t.teamId === team.teamId).players.some(p => p.playerId === player.playerId));
      assert.ok(row.stats.teams.every(t => t.players.every(p => playerHistoryKey(p.nickname) === key)));
    }
  }
});

test('home fallback contains twelve latest unique matches rather than the entire archive', () => {
  assert.equal(recent.length, 12);
  assert.equal(new Set(recent.map(m => m.matchId || m.id)).size, 12);
  assert.ok(recent.every((row, i) => i === 0 || new Date(recent[i - 1].date) >= new Date(row.date)));
});

test('concurrent archive readers share requests and absent new match IDs return null', async () => {
  let calls = 0;
  const key = '1-known-match';
  const loader = createHistoryLoader('/assets/test/', async url => {
    calls++;
    assert.equal(url, `/assets/test/matches/${historyBucket(key)}.json`);
    return { ok: true, json: async () => ({ [key]: [{ id: key }] }) };
  });
  const [a, b] = await Promise.all([loader.load('matches', key), loader.load('matches', key)]);
  assert.deepEqual(a, [{ id: key }]); assert.equal(a, b); assert.equal(calls, 1);
  assert.equal(await loader.load('matches', ''), null); assert.equal(calls, 1);
  const empty = createHistoryLoader('/', async () => ({ ok: true, json: async () => ({}) }));
  assert.equal(await empty.load('stats', 'new-faceit-match'), null);
  assert.equal(await empty.load('players', 'constructor'), null);
  assert.equal(await empty.load('players', '__proto__'), null);
});

test('valid nickname and slug keys cannot collide with object prototype properties', () => {
  const match = { matchId: 'test', teamSlug: 'constructor' };
  const stat = { matchId: 'test', teams: [{ teamId: 'a', players: [{ nickname: '__proto__', kills: 12 }] }] };
  const archive = buildHistoryArchive([match], { test: stat });
  assert.deepEqual(archive.groups.teams[historyBucket('constructor')].constructor, [match]);
  assert.equal(archive.groups.players[historyBucket('__proto__')].__proto__[0].stats.teams[0].players[0].kills, 12);
});

test('failed archive requests retry and the session cache is bounded', async () => {
  let calls = 0;
  const loader = createHistoryLoader('/', async () => {
    calls++;
    if (calls === 1) return { ok: false, status: 503 };
    return { ok: true, json: async () => ({}) };
  }, 1);
  await assert.rejects(loader.load('teams', 'a'), /503/);
  await loader.load('teams', 'a');
  await loader.load('teams', 'b');
  await loader.load('teams', 'a');
  assert.equal(calls, 4);
});
