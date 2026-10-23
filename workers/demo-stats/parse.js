import { readFile } from 'node:fs/promises';
import process from 'node:process';
import { createRequire } from 'node:module';
import { reconstructRounds, sideForRoster } from './rounds.js';
const require = createRequire(import.meta.url);
const { parseHeader, parseEvents, parseTicks } = require('@laihoe/demoparser2');
const [path, contextFile] = process.argv.slice(2);
try {
  const context = JSON.parse(await readFile(contextFile, 'utf8'));
  const header = parseHeader(path);
  const map = context.maps.find(item => item.key === header.map_name.replace(/^de_/, '').toLowerCase());
  if (!map) throw new Error('Demo map does not match recorded map results');
  const events = parseEvents(path, ['round_end'], [], ['total_rounds_played', 'is_warmup_period']);
  const ends = events.filter(e => e.event_name === 'round_end' && !e.is_warmup_period);
  if (ends.length > 500) throw new Error('Too many round events');
  const ticks = parseTicks(path, ['team_num', 'team_rounds_total'], [...new Set(ends.map(e => e.tick))]);
  const byTick = new Map();
  for (const player of ticks) { if (!byTick.has(player.tick)) byTick.set(player.tick, []); byTick.get(player.tick).push(player); }
  const snapshots = ends.map(e => {
    const players = byTick.get(e.tick) || [];
    const side1 = sideForRoster(players, context.team1.steamIds), side2 = sideForRoster(players, context.team2.steamIds);
    const scores = side => [...new Set(players.filter(p => p.team_num === side).map(p => p.team_rounds_total))];
    const a = scores(side1), b = scores(side2);
    return { tick: e.tick, round: e.total_rounds_played, winner: e.winner, reason: e.reason, warmup: e.is_warmup_period,
      side1, side2, score1: a.length === 1 ? a[0] : null, score2: b.length === 1 ? b[0] : null };
  });
  const result = reconstructRounds(snapshots, { team1: { id: context.team1.id, score: map.score1 }, team2: { id: context.team2.id, score: map.score2 } });
  console.log(JSON.stringify({ ...result, map: map.key, parser: 'demoparser2@0.42.0', parsedAt: new Date().toISOString() }));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
