import process from 'node:process';
import { readFile, stat } from 'node:fs/promises';
import 'dotenv/config';
import { coachClient } from '../server/coachData.js';
import { matchId, parseCoachLobby, finished } from '../server/coachLobby.js';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const paths = args.filter(arg => arg !== '--apply');
if (!paths.length || paths.some(path => path.startsWith('-'))) {
  throw new Error('Usage: node scripts/importCoachLobbies.js [--apply] match-room.json [...]');
}

const db = coachClient();
const seen = new Set();
const totals = { ready: 0, saved: 0, existing: 0, rejected: 0 };
function dataOrThrow({ data, error }) {
  if (error) throw error;
  return data;
}
for (const path of paths) {
  const info = await stat(path);
  if (!info.isFile() || info.size > 2_000_000) throw new Error('Expected a local JSON file up to 2 MB');
  const source = JSON.parse(await readFile(path, 'utf8'));
  const room = source?.payload || source;
  if (!matchId(room?.id) || !finished(room.status)) {
    totals.rejected++;
    continue;
  }
  if (seen.has(room.id)) continue;
  seen.add(room.id);
  const match = dataOrThrow(await db.from('matches').select('id,status,team1_id,team2_id').eq('id', room.id).maybeSingle());
  const snapshot = match && finished(match.status) && parseCoachLobby(room, match);
  if (!snapshot?.terminal || !snapshot.coach_ids.length) {
    totals.rejected++;
    console.warn('[coach-import] Missing matching ESEA result or explicit coach role:', room.id);
    continue;
  }
  const existing = dataOrThrow(await db.from('esea_coach_lobbies').select('terminal').eq('match_id', room.id).maybeSingle());
  if (existing?.terminal) {
    totals.existing++;
    continue;
  }
  totals.ready++;
  if (apply) {
    let result = await db.from('esea_coach_lobbies').update(snapshot).eq('match_id', room.id).eq('terminal', false).select('match_id');
    if (!dataOrThrow(result).length) {
      result = await db.from('esea_coach_lobbies').upsert(snapshot, { onConflict: 'match_id', ignoreDuplicates: true }).select('match_id');
    }
    totals.saved += dataOrThrow(result).length;
  }
}
console.log('[coach-import]', apply ? 'applied' : 'dry run', totals);
if (totals.rejected) process.exitCode = 1;
