import process from 'node:process';
import { setTimeout as pause } from 'node:timers/promises';
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { fetchCoachLobby, matchId } from '../server/coachLobby.js';

async function result(query) {
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } });
const due = await result(db.rpc('esea_coach_lobbies_due'));
const totals = { checked: 0, withCoaches: 0, failed: 0 };
let cursor = 0;
let rateLimited = false;
await Promise.all(Array.from({ length: Math.min(4, due.length) }, async () => {
  while (!rateLimited && cursor < due.length) {
    const row = due[cursor++];
    if (!matchId(row.id)) continue;
    try {
      const snapshot = await fetchCoachLobby(row);
      await result(db.from('esea_coach_lobbies').upsert(snapshot));
      totals.checked++;
      if (snapshot.coach_ids.length) totals.withCoaches++;
    } catch (error) {
      totals.failed++;
      if (error.status === 429) rateLimited = true;
      console.warn(`[coach-lobbies] ${row.id}: ${error.message}`);
      await result(db.from('esea_coach_lobbies').upsert({ match_id: row.id,
        retry_at: new Date(Date.now() + (error.status === 429 ? 10 * 60000 : 12 * 3600000)).toISOString() }));
    }
    if (!rateLimited && cursor < due.length) await pause(350);
  }
}));
console.log('[coach-lobbies]', totals);
if (due.length && !totals.checked && totals.failed) process.exitCode = 1;
