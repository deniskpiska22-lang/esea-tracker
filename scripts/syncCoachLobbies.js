import process from 'node:process';
import { setTimeout as pause } from 'node:timers/promises';
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { fetchCoachLobby, matchId } from '../server/coachLobby.js';
import { scanCoachLobbies } from '../server/coachLobbyScan.js';

async function result(query) {
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } });
const workerName = 'coach-lobbies';
const saved = await result(db.from('worker_status').select('detail').eq('worker_name', workerName).maybeSingle());
let state = {};
try { state = JSON.parse(saved?.detail || '{}') || {}; } catch { /* Old or missing checkpoint. */ }
if (state.paused) {
  console.log('[coach-lobbies] full sweep paused; using season-boundary discovery');
  process.exit(0);
}

const totals = await scanCoachLobbies({
  state,
  due: () => result(db.rpc('esea_coach_lobbies_due')),
  fetchRoom: fetchCoachLobby,
  saveRoom: snapshot => result(db.from('esea_coach_lobbies').upsert(snapshot)),
  deferRoom: (id, retryAt) => result(db.from('esea_coach_lobbies').upsert({ match_id: id,
    retry_at: new Date(retryAt).toISOString() })),
  saveState: async (detail, status) => {
    const at = new Date().toISOString();
    await result(db.from('worker_status').upsert({
      worker_name: workerName, detail: JSON.stringify(detail), status, last_ping: at, updated_at: at,
    }, { onConflict: 'worker_name' }));
  },
  wait: () => pause(1000),
  validId: matchId,
  onError: (row, error) => console.warn(`[coach-lobbies] ${row.id}: ${error.message}`, error.diagnostics || ''),
});
console.log('[coach-lobbies]', totals);
if (totals.denied) process.exitCode = 77;
else if (totals.failed && !totals.checked) process.exitCode = 1;
