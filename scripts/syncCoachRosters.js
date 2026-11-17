import 'dotenv/config';
import process from 'node:process';
import { parseArgs } from 'node:util';
import { setTimeout as pause } from 'node:timers/promises';
import { coachClient } from '../server/coachData.js';
import { uuid } from '../server/coachLobby.js';
import { ESEA_LEAGUE_ID, parseLeagueCoachRoster } from './lib/coachLeagueRoster.js';
import { retryAfterMs } from './lib/discoveryScan.js';

const { values } = parseArgs({ options: {
  apply: { type: 'boolean' }, full: { type: 'boolean' }, team: { type: 'string' },
} });
if (values.team && !uuid(values.team)) throw new Error('Invalid team ID');
const db = coachClient();
async function result(query) {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}
const workerName = 'coach-rosters';
const { active_season: season } = await result(db.from('rating_season_settings').select('active_season').single());
const teams = [];
for (let offset = 0; ; offset += 1000) {
  let query = db.from('team_catalog').select('team_id,team').eq('team->>activeSeasonParticipant', 'true')
    .eq('team->>season', String(season)).order('team_id').range(offset, offset + 999);
  if (values.team) query = query.eq('team_id', values.team);
  const page = await result(query);
  teams.push(...page);
  if (page.length < 1000) break;
}
if (!teams.length) throw new Error('No active ESEA teams to scan');
let state = {};
if (values.apply && !values.team) {
  const saved = await result(db.from('worker_status').select('detail').eq('worker_name', workerName).maybeSingle());
  try { state = JSON.parse(saved?.detail || '{}'); } catch { /* Previous human-readable status. */ }
}
if (Number(state.retryAt || 0) > Date.now()) {
  console.log('[coach-rosters] source cooldown', new Date(state.retryAt).toISOString());
  process.exit(77);
}
if (state.season !== season) state = { season };
let index = Math.max(0, teams.findIndex(team => team.team_id === state.nextId));
const maxTeams = values.full ? teams.length : Math.min(350, teams.length);
const deadline = Date.now() + (values.full ? 40 * 60 * 1000 : 8 * 60 * 1000);
const identities = new Map();
const totals = { checked: 0, coaches: 0, saved: 0, empty: 0, unavailable: 0, failed: 0 };
let lastRequestAt = 0;
async function fetchJson(url, headers = {}) {
  await pause(Math.max(0, 400 - (Date.now() - lastRequestAt)));
  lastRequestAt = Date.now();
  const response = await fetch(url, { headers: { accept: 'application/json', ...headers }, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw Object.assign(new Error(`FACEIT HTTP ${response.status}`), {
    status: response.status, retryAfter: retryAfterMs(response.headers.get('retry-after')),
  });
  return response.json();
}
async function identity(id) {
  if (identities.has(id)) return identities.get(id);
  if (!process.env.FACEIT_API_KEY) throw new Error('FACEIT_API_KEY is required');
  const player = await fetchJson(`https://open.faceit.com/data/v4/players/${id}`, {
    Authorization: `Bearer ${process.env.FACEIT_API_KEY}`,
  });
  if (player.player_id !== id || !player.nickname?.trim()) throw new Error('Coach profile identity mismatch');
  identities.set(id, player);
  return player;
}
async function checkpoint(status, retryAt = 0) {
  if (!values.apply || values.team) return;
  const at = new Date().toISOString();
  await result(db.from('worker_status').upsert({ worker_name: workerName, status, last_ping: at, updated_at: at,
    detail: JSON.stringify({ season, nextId: teams[index].team_id, retryAt, ...totals }) }, { onConflict: 'worker_name' }));
}
for (let completed = 0; completed < maxTeams && Date.now() < deadline; completed++) {
  const team = teams[index];
  const observedAt = new Date().toISOString();
  let roster = null;
  let writing = false;
  try {
    const users = [...new Set(team.team.playerIds || [])].filter(uuid).slice(0, 3);
    for (const userId of users) {
      const url = `https://www.faceit.com/api/team-leagues/v2/leagues/${ESEA_LEAGUE_ID}/users/${userId}/teams/active`;
      roster = parseLeagueCoachRoster(await fetchJson(url), team);
      if (roster) break;
    }
    if (!roster) {
      totals.unavailable++;
    } else {
      const player = roster.coachId ? await identity(roster.coachId) : null;
      if (player) totals.coaches++;
      else totals.empty++;
      if (values.apply) {
        writing = true;
        const stored = await result(db.rpc('record_esea_coach_roster', {
          p_team_id: team.team_id, p_season: season, p_observed_at: observedAt,
          p_coach_id: roster.coachId, p_nickname: player?.nickname || null,
          p_country: /^[a-z]{2}$/i.test(player?.country || '') ? player.country.toUpperCase() : null,
          p_started_at: roster.startedAt,
        }));
        totals.saved += Number(stored);
      }
      if (player || values.team) console.log('[coach-rosters]', team.team_id, team.team.name,
        player?.nickname || '(empty coach slot)', roster.coachId || '');
    }
    totals.checked++;
  } catch (error) {
    totals.failed++;
    console.warn('[coach-rosters]', team.team_id, error.message);
    if (writing) throw error;
    if ([401, 403, 429].includes(error.status)) {
      await checkpoint('cooldown', Date.now() + Math.max(3600000, error.retryAfter || 0));
      process.exitCode = 77;
      break;
    }
    if (values.team) {
      process.exitCode = 1;
      break;
    }
  }
  index = (index + 1) % teams.length;
  await checkpoint('running');
}
if (!process.exitCode) await checkpoint('online');
console.log('[coach-rosters]', JSON.stringify({ season, ...totals, nextId: teams[index].team_id }));
