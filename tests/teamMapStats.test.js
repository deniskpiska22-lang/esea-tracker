import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeTeamMapHistory, loadTeamMapHistory, buildTeamMapStats, teamMapPath, MAP_NAMES } from '../src/utils/teamMapStats.js';
import { getTeamMapSeo } from '../src/utils/teamMapSeo.js';
import { teamMapMetadata } from '../server/teamMapSeo.js';
import { renderProfile } from '../server/profileSeo.js';
import { createTeamMapHandler } from '../server/teamMapHandler.js';
import teamStatsHandler from '../api/team-stats.js';
import { translateText } from '../src/i18n/translate.js';
import { LANGUAGE_CODES } from '../src/i18n/languages.js';

const own = '5ab6e36a-2edf-4ff3-bd06-f4712c07a0b0', other = '11111111-1111-4111-8111-111111111111';
const team = { name: 'Nemesis Academy', faceitTeamId: own, profileSlug: 'nemesis-academy' };
const now = Date.parse('2026-10-23T12:00:00Z');
const row = (id, change = {}) => ({ id, status: 'FINISHED', best_of: 3, finished_at: '2026-10-22T20:30:00Z', competition_id: 'event-1', competition_name: 'Qualifier 1',
  team1_id: own, team2_id: other, team1_name: team.name, team2_name: 'Opponent', team1_score: 2, team2_score: 1,
  map_scores: [{ map: 'de_nuke', team1_score: 13, team2_score: 8 }, { map: 'Mirage', team1_score: 5, team2_score: 13 }],
  veto_steps: [{ map: 'Nuke', action: 'Picked', selectedBy: 'faction1' }, { map: 'Inferno', action: 'Banned', selectedBy: 'faction1' }], ...change });

test('map history uses per-map rounds, handles reversed sides and keeps roster identity', () => {
  const reverse = row('reverse', { team1_id: other, team2_id: own, team1_name: 'Opponent', team2_name: team.name,
    map_scores: [{ map: 'Nuke', team1_id: own, team2_id: other, team1_score: 16, team2_score: 14 }] });
  const rows = normalizeTeamMapHistory([row('one'), reverse, row('wrong-team', { team1_id: 'main-roster', team1_name: team.name })], own);
  assert.equal(rows.length, 2);
  assert.equal(rows[1].opponent.id, other);
  const stats = buildTeamMapStats(rows, 'nuke', { now });
  assert.equal(stats.played, 2);
  assert.equal(stats.wins, 2);
  assert.equal(stats.roundsWon, 29);
  assert.equal(stats.totalRounds, 51);
  assert.equal(stats.matches[0].teamScore, 13);
  assert.equal(buildTeamMapStats(rows, 'mirage', { now }).losses, 1);
});

test('walkovers, placeholders, missing scores, pending maps and duplicate maps are not played', () => {
  const examples = [
    row('technical', { map_scores: [{ map: 'Nuke', team1_score: 1, team2_score: 0 }], team1_score: 1, team2_score: 0 }),
    row('missing', { map_scores: [{ map: 'Nuke', team1_score: null, team2_score: 13 }] }),
    row('pending', { map_scores: [{ map: 'Nuke', team1_score: 13, team2_score: 3, pending: true }] }),
    row('other-map-team', { map_scores: [{ map: 'Nuke', team1_id: 'wrong', team2_id: other, team1_score: 13, team2_score: 7 }] }),
    row('unfinished', { status: 'ONGOING' }),
  ];
  assert.equal(buildTeamMapStats(normalizeTeamMapHistory(examples, own), 'Nuke', { now }).played, 0);
  const game = row('real-13-0', { map_scores: [{ map: 'Nuke', team1_score: 13, team2_score: 0 }, { map: 'de_nuke', team1_score: 13, team2_score: 0 }] });
  const history = normalizeTeamMapHistory([game, game], own);
  assert.equal(buildTeamMapStats(history, 'Nuke', { now }).played, 1);
});

test('BO1 fallback requires actual round scores and never copies a BO3 series score', () => {
  const base = row('fallback', { best_of: 1, maps: ['Nuke'], map_scores: [], team1_score: 13, team2_score: 9 });
  assert.equal(normalizeTeamMapHistory([base], own)[0].mapScores[0].teamScore, 13);
  assert.equal(normalizeTeamMapHistory([{ ...base, best_of: 3 }], own)[0].mapScores.length, 0);
  assert.equal(normalizeTeamMapHistory([{ ...base, team1_score: 1, team2_score: 0 }], own).length, 0);
});

test('filters apply to metrics and rows together and respect exact date boundaries', () => {
  const cutoff = new Date(now - 90 * 86400000).toISOString();
  const history = normalizeTeamMapHistory([row('recent'), row('boundary', { finished_at: cutoff }),
    row('old', { finished_at: new Date(Date.parse(cutoff) - 1).toISOString() }), row('future', { finished_at: new Date(now + 1).toISOString() }),
    row('another-event', { competition_id: 'event-2' })], own);
  assert.equal(buildTeamMapStats(history, 'Nuke', { now }).played, 3);
  assert.equal(buildTeamMapStats(history, 'Nuke', { now, days: 'all' }).played, 4);
  const filtered = buildTeamMapStats(history, 'Nuke', { now, event: 'event-2', opponent: other });
  assert.equal(filtered.played, 1);
  assert.equal(filtered.matches[0].id, 'another-event');
  assert.equal(buildTeamMapStats(history, 'Nuke', { now, opponent: 'wrong' }).played, 0);
});

test('missing data stays unavailable and pick/ban denominators use only known team vetoes', () => {
  const a = row('a'), b = row('b', { veto_steps: [{ map: 'Nuke', action: 'Banned', selectedBy: 'faction1' }] });
  const c = row('c', { veto_steps: [{ map: 'Nuke', action: 'Picked', selectedBy: 'faction2' }, { map: 'Nuke', action: 'Decider', selectedBy: null }] });
  const stats = buildTeamMapStats(normalizeTeamMapHistory([a, b, c], own), 'Nuke', { now });
  assert.equal(stats.vetoMatches, 2);
  assert.equal(stats.pickRate, 50);
  assert.equal(stats.banRate, 50);
  const empty = buildTeamMapStats([], 'Nuke', { now });
  assert.equal(empty.winRate, null);
  assert.equal(empty.roundWinRate, null);
  assert.equal(empty.banRate, null);
});

function paginatedClient(pages) {
  const ranges = [];
  return { ranges, from(table) {
    assert.equal(table, 'matches');
    const query = { select() { return this; }, in() { return this; }, or(value) { assert.match(value, new RegExp(own)); return this; }, order() { return this; },
      range(start, end) { ranges.push([start, end]); return Promise.resolve(pages[ranges.length - 1]); } };
    return query;
  } };
}
test('long histories paginate beyond the database cap and later errors cannot claim complete data', async () => {
  const client = paginatedClient([{ data: Array.from({ length: 500 }, (_, i) => row(`game-${i}`)), error: null }, { data: [row('last')], error: null }]);
  assert.equal((await loadTeamMapHistory(client, own)).length, 501);
  assert.deepEqual(client.ranges, [[0, 499], [500, 999]]);
  const failed = paginatedClient([{ data: Array.from({ length: 500 }, (_, i) => row(`game-${i}`)), error: null }, { data: null, error: new Error('page failed') }]);
  await assert.rejects(loadTeamMapHistory(failed, own), /page failed/);
});

test('every team/map pair has its own readable URL and localized metadata', () => {
  for (const language of LANGUAGE_CODES) for (const map of MAP_NAMES) {
    const metadata = getTeamMapSeo(team, map, language);
    assert.ok(metadata.title.includes(team.name) && metadata.title.includes(map));
    assert.equal(metadata.canonicalPath, `${language === 'ru' ? '' : `/${language}`}/teams/nemesis-academy/stats/${map.toLowerCase()}`);
    assert.equal(metadata.schema.about.identifier, own);
    assert.equal(metadata.alternates.length, 8);
  }
  assert.equal(teamMapPath({ faceitTeamId: own }, 'de_nuke'), `/teams/${own}/stats/nuke`);
  assert.equal(teamMapPath(team, 'unknown'), null);
});

test('crawlable page contains actual map results, unique canonical and safely escaped names', () => {
  const data = { team: { ...team, name: '<img onerror="bad">' }, matches: normalizeTeamMapHistory([row('result')], own) };
  // Use current dates: SEO's default sample is the latest 90 days.
  data.matches[0].date = new Date().toISOString();
  const metadata = teamMapMetadata(data, 'Nuke', 'en');
  const html = renderProfile('<html><head><title>Old</title></head><body><div id="root"></div></body></html>', metadata);
  assert.match(html, /stats\/nuke/);
  assert.match(html, /13–8/);
  assert.match(html, /match\/result/);
  assert.match(html, /&lt;img/);
  assert.doesNotMatch(html, /<img onerror/);
  assert.equal(JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]).about.identifier, own);
});

test('new map labels have complete translations on all seven site languages', () => {
  const catalog = JSON.parse(readFileSync(new URL('../src/i18n/mapStatsCatalog.json', import.meta.url), 'utf8'));
  for (const [key, values] of Object.entries(catalog)) for (const lang of LANGUAGE_CODES.filter(value => value !== 'en')) {
    assert.ok(values[lang], `${key}: ${lang}`);
    assert.equal(translateText(key, lang), values[lang]);
  }
});

test('direct localized map routes reach server SEO before the SPA fallback', () => {
  const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  for (const source of ['/teams/:key/stats/:map', '/:lang(en|de|pt|es|fr|it)/teams/:key/stats/:map']) {
    const index = config.rewrites.findIndex(rule => rule.source === source);
    assert.ok(index >= 0 && index < config.rewrites.findIndex(rule => rule.source === '/(.*)'));
    assert.match(config.rewrites[index].destination, /kind=team-map/);
  }
});

async function apiRequest(query, load = async () => ({ team, matches: [] }), method = 'GET') {
  const res = { code: 200, headers: {}, setHeader(name, value) { this.headers[name] = value; }, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; }, end() {} };
  await createTeamMapHandler(load)({ method, query }, res);
  return res;
}
test('public endpoint rejects bad inputs, keeps failures uncached and never leaks database errors', async () => {
  assert.equal((await apiRequest({ team: [] })).code, 400);
  assert.equal((await apiRequest({ team: own }, undefined, 'POST')).code, 405);
  const missing = await apiRequest({ team: own }, async () => null);
  assert.equal(missing.code, 404);
  assert.equal(missing.headers['Cache-Control'], 'no-store');
  const failed = await apiRequest({ team: own }, async () => { throw new Error('private database detail'); });
  assert.equal(failed.code, 503);
  assert.deepEqual(failed.body, { ok: false });
  assert.equal((await apiRequest({ team: own })).body.ok, true);
});

test('map history shares the existing team statistics function', async () => {
  const res = { code: 200, setHeader() {}, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  await teamStatsHandler({ method: 'GET', query: { action: 'map-history', team: [] } }, res);
  assert.equal(res.code, 400);
  assert.deepEqual(res.body, { ok: false });
});
