import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { reconstructRounds, sideForRoster } from '../workers/demo-stats/rounds.js';
import { buildDemoContext, demoUrl, downloadDemo, resolveDemoUrls, resolveDownloadUrl } from '../workers/demo-stats/source.js';
import { verifiedTeamRounds } from '../src/utils/demoRoundStats.js';
import { normalizeTeamMapHistory, buildTeamMapStats } from '../src/utils/teamMapStats.js';
import catalog from '../src/i18n/mapStatsCatalog.json' with { type: 'json' };

const own = '11111111-1111-4111-8111-111111111111', other = '22222222-2222-4222-8222-222222222222';
const id = '1-01234567-89ab-cdef-0123-456789abcdef';
function timeline(winners, half = 12) {
  let a = 0, b = 0;
  return winners.map((won, round) => {
    const side1 = round < half ? 3 : round < half * 2 ? 2 : (Math.floor((round - half * 2) / 3) % 2 ? 3 : 2);
    if (won) a++; else b++;
    return { tick: 100 + round * 100, round, score1: a, score2: b, side1, side2: 5 - side1, winner: won ? side1 : 5 - side1, reason: 9, warmup: false };
  });
}
const regulation = [...Array(7).fill(true), ...Array(6).fill(false), ...Array(6).fill(true), ...Array(4).fill(false)];
function record(winners = regulation, half = 12) {
  const snapshots = timeline(winners, half), final = snapshots.at(-1);
  return reconstructRounds(snapshots, { team1: { id: own, score: final.score1 }, team2: { id: other, score: final.score2 } });
}

test('MR12 reconstructs exact side wins, both pistols and shortened regulation halves', () => {
  const result = record(), team = result.teams[0];
  assert.equal(result.halfLength, 12);
  assert.deepEqual(team.ct, { won: 7, total: 12 });
  assert.deepEqual(team.t, { won: 6, total: 11 });
  assert.deepEqual(team.pistol, { won: 1, total: 2, ct: { won: 1, total: 1 }, t: { won: 0, total: 1 } });
  assert.deepEqual(team.halves, { won: 2, draws: 0, total: 2 });
  assert.equal(verifiedTeamRounds(result, own, 13, 10), team);
  assert.equal(verifiedTeamRounds(result, other, 10, 13).ct.won, 5);
});

test('overtime uses actual sides and never adds a third pistol or regulation half', () => {
  const winners = [...Array(7).fill(true), ...Array(5).fill(false), ...Array(5).fill(true), ...Array(7).fill(false), true, true, false, true, true, false];
  const result = record(winners), team = result.teams[0];
  assert.equal(team.score, 16);
  assert.deepEqual(team.overtime, { won: 4, total: 6 });
  assert.deepEqual(team.ct, { won: 9, total: 15 });
  assert.deepEqual(team.t, { won: 7, total: 15 });
  assert.equal(team.pistol.total, 2);
  assert.equal(team.halves.total, 2);
  assert.equal(verifiedTeamRounds(result, own, 16, 14), team);
});

test('MR15 detects the actual halftime rather than treating round 13 as a pistol', () => {
  const result = record([...Array(8).fill(true), ...Array(7).fill(false), ...Array(8).fill(true)], 15);
  assert.equal(result.halfLength, 15);
  assert.equal(result.teams[0].pistol.won, 2);
  assert.equal(result.teams[0].ct.total, 15);
  assert.equal(result.teams[0].t.total, 8);
});

test('restarts and duplicate round events cannot inflate the final score-verified timeline', () => {
  const snapshots = timeline(regulation);
  snapshots.push({ ...snapshots[0], tick: 10, warmup: true });
  snapshots.push({ ...snapshots[0], tick: 20 }); // earlier knife/restart
  snapshots.push({ ...snapshots[2], tick: 350 }); // restored duplicate, same scoreboard
  const result = reconstructRounds(snapshots, { team1: { id: own, score: 13 }, team2: { id: other, score: 10 } });
  assert.equal(result.teams[0].ct.total + result.teams[0].t.total, 23);
  assert.equal(result.teams[0].pistol.total, 2);
});

test('truncated, surrendered, misidentified and mismatched demos fail closed', () => {
  const expected = { team1: { id: own, score: 13 }, team2: { id: other, score: 10 } };
  for (const change of [
    rows => rows.slice(1), rows => rows.slice(0, -1),
    rows => rows.map((r, i) => i === 5 ? { ...r, reason: 18 } : r),
    rows => rows.map((r, i) => i === 5 ? { ...r, side1: null } : r),
    rows => rows.map((r, i) => i === 5 ? { ...r, score1: 100 } : r),
  ]) assert.throws(() => reconstructRounds(change(timeline(regulation)), expected));
  assert.throws(() => reconstructRounds(timeline(regulation), { ...expected, team1: { id: own, score: 14 } }));
  assert.throws(() => reconstructRounds([], { team1: { id: own, score: 1 }, team2: { id: other, score: 0 } }));
});

test('roster identification requires an unambiguous Steam ID majority on opposite sides', () => {
  const ids = ['76561198000000001','76561198000000002','76561198000000003','76561198000000004'];
  const players = ids.map(steamid => ({ steamid, team_num: 3, name: 'same nickname' }));
  assert.equal(sideForRoster(players, ids), 3);
  assert.equal(sideForRoster(players.slice(0, 2), ids), null);
  assert.equal(sideForRoster([...players.slice(0,3), { ...players[3], team_num: 2 }], ids), null);
  assert.equal(sideForRoster([...players.slice(0,2), players[0]], ids), null);
});

function match(change = {}) { return { id, status: 'FINISHED', finished_at: '2026-10-22T12:00:00Z', team1_id: own, team2_id: other, team1_name: 'One', team2_name: 'Two',
  best_of: 1, map_scores: [{ map: 'Nuke', team1_id: own, team2_id: other, team1_score: 13, team2_score: 10 }],
  raw_data: { teams: { faction1: { faction_id: own, roster: [1,2,3].map(n => ({ game_player_id: `7656119800000000${n}` })) }, faction2: { faction_id: other, roster: [4,5,6].map(n => ({ game_player_id: `7656119800000000${n}` })) } } },
  demo_round_stats: [{ ...record(), map: 'nuke' }], ...change }; }

test('map filters, exact team orientation and demo coverage share the same selected sample', () => {
  const history = normalizeTeamMapHistory([match(), match({ id: `${id}-second`, demo_round_stats: [] })], own);
  const stats = buildTeamMapStats(history, 'nuke', { now: Date.parse('2026-10-23T12:00:00Z') });
  assert.equal(stats.demoRounds.covered, 1); assert.equal(stats.demoRounds.eligible, 2);
  assert.deepEqual(stats.demoRounds.ct, { won: 7, total: 12, rate: 58.3 });
  assert.equal(stats.demoRounds.pistol.rate, 50);
  assert.equal(buildTeamMapStats(history, 'mirage').demoRounds.pistol.rate, null);
  assert.equal(buildTeamMapStats(history, 'nuke', { opponent: 'different' }).demoRounds.ct.rate, null);
  const reversed = buildTeamMapStats(normalizeTeamMapHistory([match()], other), 'nuke', { now: Date.parse('2026-10-23') });
  assert.equal(reversed.demoRounds.ct.won, 5);
  for (const mutate of [r => {r.teams[0].score=14;},r => {r.teams[0].pistol.total=3;},r => {r.teams[1].t.won=12;},r => {r.version=2;}]) {
    const bad = record(); mutate(bad); assert.equal(verifiedTeamRounds(bad, own, 13, 10), null);
  }
});

test('historical context uses immutable faction and Steam identities and exact map orientation', () => {
  assert.equal(buildDemoContext(match()).team1.steamIds.length, 3);
  const changed = match(); changed.map_scores[0] = { map: 'Nuke', team1_id: other, team2_id: own, team1_score: 10, team2_score: 13 };
  assert.deepEqual(buildDemoContext(changed).maps[0], { key: 'nuke', score1: 13, score2: 10 });
  changed.map_scores[0].team2_id = 'unknown'; assert.throws(() => buildDemoContext(changed));
});

test('download accepts only the exact match on trusted HTTPS demo hosts', async () => {
  const url = `https://demos-us-east.backblaze.faceit-cdn.net/cs2/${id}-1-1.dem.gz`;
  assert.ok(demoUrl(url, id));
  for (const value of [url.replace('https:', 'http:'),url.replace('faceit-cdn.net','faceit-cdn.net.evil.example'),url.replace(id,'other-match'),url.replace('/cs2/','@evil.example/cs2/'),'http://127.0.0.1/demo.dem']) assert.equal(demoUrl(value,id),null);
  const folder = await mkdtemp(join(tmpdir(), 'demo-download-test-'));
  try {
    const output = join(folder, 'test.dem');
    await downloadDemo(url,id,output,async()=>new Response(gzipSync('PBDEMS2\0demo bytes')));
    assert.equal(await readFile(output,'utf8'),'PBDEMS2\0demo bytes');
    await assert.rejects(downloadDemo(url,id,output,async()=>new Response(null,{status:302,headers:{location:'http://127.0.0.1/demo.dem'}})),/Untrusted/);
    await assert.rejects(downloadDemo(url,id,output,async()=>new Response(null,{status:403})),error=>error.accessRequired===true);
  } finally { await rm(folder,{recursive:true,force:true}); }
});

test('demo discovery takes only the requested room and does not use another team match', async () => {
  const url = `https://demos-us-east.backblaze.faceit-cdn.net/cs2/${id}-1-1.dem.zst`;
  const item=match();item.raw_data.competition_id='event';
  const urls=await resolveDemoUrls(item,null,async()=>new Response(JSON.stringify({payload:[{id:'other',demo_urls:[url.replace(id,'other')]},{id,demo_urls:[url]}]})));
  assert.deepEqual(urls,[url]);
});

test('logical FACEIT resources are signed before download and signatures stay on trusted storage', async () => {
  const resource = `https://demos-us-east.backblaze.faceit-cdn.net/cs2/${id}-1-1.dem.zst`;
  const signed = `https://demos-us-east-faceit-cdn.s3.us-east-005.backblazeb2.com/cs2/${id}-1-1.dem.zst?X-Amz-Signature=test`;
  const output = await resolveDownloadUrl(resource, id, 'test-token', async (url, options) => {
    assert.equal(url, 'https://api.faceit.com/download/v2/demos/download');
    assert.equal(options.headers.Authorization, 'Bearer test-token');
    assert.equal(JSON.parse(options.body).resource_url, resource);
    return new Response(JSON.stringify({payload:{download_url:signed}}));
  });
  assert.equal(output, signed);
  await assert.rejects(resolveDownloadUrl(resource,id,null), error=>error.accessRequired);
  await assert.rejects(resolveDownloadUrl(resource,id,'test',async()=>new Response(null,{status:403})), error=>error.accessRequired);
  for (const target of ['https://evil.example/demo.dem',signed.replace(id,'another-match'),signed.replace('backblazeb2.com','backblazeb2.com.evil.example')]) {
    await assert.rejects(resolveDownloadUrl(resource,id,'test',async()=>new Response(JSON.stringify({payload:{download_url:target}}))),/Untrusted/);
  }
});

test('all demo-statistics labels are translated in every site language', () => {
  for (const label of ['Verified demo statistics','CT rounds','T rounds','Pistol rounds','CT pistols','T pistols','Overtime rounds','Processed demos: {0} of {1} played maps.','No verified demo statistics yet.','Won: {0} / {1}','CT/T rates include overtime. Pistols are the opening rounds of the two regulation halves.','Regulation halves won','{0} wins, {1} draws in {2} halves','Halves are compared by rounds won; the final half can be shortened. Overtime is excluded.']) {
    for(const language of ['ru','de','pt','es','fr','it']) assert.ok(catalog[label]?.[language],`${label}: ${language}`);
  }
});
