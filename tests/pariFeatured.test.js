import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePariLine, selectPariFeatured } from '../server/pariSource.js';
import { createMatchOddsHandler } from '../api/match-odds.js';

const now = Date.parse('2026-11-14T17:00:00Z');
const sport = (id, name) => ({ id, parentId: 29086, sportCategoryId: 20, name: 'Counter-Strike. ' + name });
const event = (id, sportId, team1, team2, fields = {}) => ({
  id, sportId, team1, team2, place: 'line', level: 1, kind: 1,
  startTime: now / 1000 + 3600, ...fields,
});
const market = e => ({ e, factors: [{ f: 921, v: 1.67 }, { f: 923, v: 2.2 }] });

test('PARI selects only fresh CS2 main-match prices; prioritizes majors and excludes the current room pair', () => {
  const events = [
    event(1, 1, 'A', 'B'), event(2, 2, 'Spirit', 'FURIA'),
    event(3, 2, 'Map A', 'Map B', { parentId: 2, level: 2 }),
    event(4, 2, 'Blocked', 'Event'), event(5, 3, 'Player', 'Another'),
    event(6, 2, 'Started', 'Match', { startTime: now / 1000 - 1 }),
    event(7, 2, 'One', 'Two'), event(8, 4, 'Dota', 'Team'),
    event(9, 2, 'Draw', 'Market'),
  ];
  const data = {
    sports: [sport(1, 'ESEA. Advanced Division'), sport(2, 'BLAST Rivals'),
      sport(3, 'BLAST Rivals. Сравнение по киллам'), { ...sport(4, 'Dota'), sportCategoryId: 21 }],
    events, customFactors: events.map(row => market(row.id)),
    eventBlocks: [{ eventId: 4, state: 'blocked' }],
  };
  data.customFactors[6].factors.pop();
  data.customFactors[8].factors.push({ f: 922, v: 4 });
  const rows = parsePariLine(data, now);
  assert.deepEqual(rows.map(row => row.eventId), [2, 1]);
  assert.equal(rows[0].team2.price, 2.2);
  const line = { fetchedAt: now - 5000, rows };
  const picks = selectPariFeatured(line, { team1_name: 'FURIA', team2_name: 'Spirit' }, now);
  assert.deepEqual(picks.map(row => row.eventId), [1]);
  assert.equal(picks[0].validForMs, 55_000);
  assert.deepEqual(selectPariFeatured(line, {}, now + 60_000), []);
});

test('PARI line is fetched only for the Russian placement and only for an existing match', async () => {
  let calls = 0;
  const handler = createMatchOddsHandler({
    loadMatch: async () => ({}), loadPari: async () => { calls++; throw new Error('offline'); }, now: () => now,
  });
  for (const [country, count] of [['US', 0], ['RU', 1]]) {
    const response = { setHeader() {}, status() { return this; }, json(body) { this.body = body; } };
    await handler({ method: 'GET', headers: { 'x-vercel-ip-country': country },
      query: { action: 'pari-featured', matchId: '1-01234567-89ab-cdef-0123-456789abcdef' } }, response);
    assert.deepEqual(response.body, { featured: [] });
    assert.equal(calls, count);
  }
});
