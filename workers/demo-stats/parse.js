import { readFile } from 'node:fs/promises';
import process from 'node:process';
import { createRequire } from 'node:module';
import { reconstructRounds, roundSnapshot } from './rounds.js';
const require = createRequire(import.meta.url);
const { parseHeader, parseEvents, parseTicks } = require('@laihoe/demoparser2');
const [path, contextFile] = process.argv.slice(2);
try {
  const context = JSON.parse(await readFile(contextFile, 'utf8'));
  const header = parseHeader(path);
  const map = context.maps.find(item => item.key === header.map_name.replace(/^de_/, '').toLowerCase());
  if (!map) throw new Error('Demo map does not match recorded map results');
  const events = parseEvents(path, ['round_end', 'round_start'], [], ['total_rounds_played', 'is_warmup_period']);
  const ends = events.filter(e => e.event_name === 'round_end' && !e.is_warmup_period);
  if (ends.length > 500) throw new Error('Too many round events');
  const ticks = parseTicks(path, ['team_num', 'team_rounds_total'], [...new Set(ends.map(e => e.tick))]);
  const byTick = new Map();
  for (const player of ticks) { if (!byTick.has(player.tick)) byTick.set(player.tick, []); byTick.get(player.tick).push(player); }
  const starts = events.filter(e => e.event_name === 'round_start' && !e.is_warmup_period && e.total_rounds_played === 0).sort((a,b) => a.tick-b.tick);
  const snapshots = ends.map(e => roundSnapshot(e, byTick.get(e.tick) || [], context,
    starts.filter(start => start.tick <= e.tick).at(-1)?.tick ?? 0));
  const result = reconstructRounds(snapshots, { team1: { id: context.team1.id, score: map.score1 }, team2: { id: context.team2.id, score: map.score2 } });
  console.log(JSON.stringify({ ...result, map: map.key, parser: 'demoparser2@0.42.0', parsedAt: new Date().toISOString() }));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
