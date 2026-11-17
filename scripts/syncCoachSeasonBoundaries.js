import process from 'node:process';
import { setTimeout as pause } from 'node:timers/promises';
import 'dotenv/config';
import { coachClient } from '../server/coachData.js';
import { fetchCoachLobby } from '../server/coachLobby.js';
import { coachBoundaryPlan, coachSeasonBounds } from '../server/coachSeasonBoundaries.js';

const db = coachClient();
const workerName = 'coach-season-boundaries';
const result = async query => {
  const { data, error } = await query;
  if (error) throw error;
  return data;
};
const saved = await result(db.from('worker_status').select('detail').eq('worker_name', workerName).maybeSingle());
let state = {};
try { state = JSON.parse(saved?.detail || '{}') || {}; } catch { /* Fresh checkpoint. */ }
if (state.paused || state.retryAt > Date.now()) {
  console.log('[coach-boundaries] paused', state.httpStatus || '', state.retryAt || '');
  process.exit(0);
}
const saveState = async status => {
  const at = new Date().toISOString();
  await result(db.from('worker_status').upsert({ worker_name: workerName, status,
    detail: JSON.stringify(state), last_ping: at, updated_at: at }, { onConflict: 'worker_name' }));
};
const limit = Math.max(1, Math.min(40, Number(process.env.COACH_BOUNDARY_BATCH_SIZE) || 20));
const phase = state.phase || 'endpoints';
let checked = 0, groupsChecked = 0;
let cursor = state.cursor || '';
let denied = false;
outer: while (groupsChecked < 100) {
  const groups = await result(db.rpc('esea_coach_boundary_groups', { p_after: cursor, p_limit: 10 }));
  if (!groups.length) {
    cursor = '';
    state.phase = phase === 'endpoints' ? 'boundaries' : 'endpoints';
    break;
  }
  for (const group of groups) {
    let plan;
    while ((plan = coachBoundaryPlan(group.matches, phase))) {
      if (checked >= limit) break outer;
      if (checked) await pause(2000);
      const match = group.matches[plan.index];
      let snapshot;
      try { snapshot = await fetchCoachLobby(match); }
      catch (error) {
        console.warn('[coach-boundaries]', match.id, error.message);
        if ([403, 429].includes(error.status)) {
          state.httpStatus = error.status;
          state.retryAt = error.retryAt;
          // A new query strategy does not grant access: 403 requires source repair.
          state.paused = error.status === 403;
          denied = true;
          break outer;
        }
        match.retry_at = new Date(Date.now() + 12 * 3600000).toISOString();
        await result(db.from('esea_coach_lobbies').upsert({ match_id: match.id, retry_at: match.retry_at }));
        checked++;
        continue;
      }
      await result(db.from('esea_coach_lobbies').upsert(snapshot));
      // A room supplies both teams, so cache it locally for all groups in this page.
      for (const other of groups) for (const row of other.matches.filter(row => row.id === match.id)) {
        row.known = snapshot.team_ids.includes(other.team_id);
        row.coaches = snapshot.teams.find(side => side.id === other.team_id)?.coaches.map(coach => coach.id) || [];
      }
      if (!match.known) {
        match.retry_at = new Date(Date.now() + 12 * 3600000).toISOString();
        await result(db.from('esea_coach_lobbies').update({ retry_at: match.retry_at }).eq('match_id', match.id));
      }
      checked++;
      const bounds = coachSeasonBounds(group);
      if (bounds.length) await result(db.from('esea_coach_season_bounds').upsert(bounds));
    }
    const bounds = coachSeasonBounds(group);
    if (bounds.length) await result(db.from('esea_coach_season_bounds').upsert(bounds));
    cursor = group.key;
    state.cursor = cursor;
    groupsChecked++;
    // Persist progress before processing the next team.
    await saveState('online');
  }
}
state = { ...state, cursor, phase: state.phase || phase, checked, groupsChecked,
  ...(denied ? {} : { retryAt: 0 }) };
await saveState(state.paused ? 'paused' : denied ? 'backoff' : 'online');
console.log('[coach-boundaries]', { checked, groupsChecked, phase, cursor, paused: state.paused || false });
if (denied) process.exitCode = 77;
