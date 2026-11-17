import { linkedPlayerProfile } from '../src/data/linkedPlayerProfiles.js';
import { assignedCoach } from './coachAssignments.js';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';
import { finished, upcoming } from './coachLobby.js';

let client;
export function coachClient() {
  client ||= createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(12000) }) },
    });
  return client;
}

const rosterColumns = 'coach_id,team_id,season,nickname,country,source_started_at,observed_at,active';
const recentRoster = () => new Date(Date.now() - 30 * 86400000).toISOString();

export async function coachRosterRows(db, ids) {
  const { data, error } = await db.from('esea_coach_rosters').select(`${rosterColumns},team_catalog!inner(team)`)
    .in('coach_id', ids).order('observed_at', { ascending: false }).limit(50);
  if (error) throw error;
  return data;
}

export async function currentTeamCoach(db, teamId) {
  const { data, error } = await db.from('esea_coach_roster_checks')
    .select('season,coach_id,observed_at,team_catalog!inner(team)').eq('team_id', teamId)
    .eq('team_catalog.team->>activeSeasonParticipant', 'true')
    .gte('observed_at', recentRoster()).order('observed_at', { ascending: false }).limit(8);
  if (error) throw error;
  const snapshot = data.find(row => row.season === Number(row.team_catalog.team.season));
  if (!snapshot || !snapshot.coach_id) return snapshot || null;
  const { data: person, error: identityError } = await db.from('esea_coach_rosters')
    .select(rosterColumns).eq('team_id', teamId).eq('season', snapshot.season)
    .eq('coach_id', snapshot.coach_id).maybeSingle();
  if (identityError) throw identityError;
  return person;
}

export async function findRosterCoaches(db, text) {
  const escaped = text.replace(/[\\%_]/g, '\\$&');
  const { data, error } = await db.from('esea_coach_rosters').select('coach_id,nickname')
    .ilike('nickname', `%${escaped}%`).order('active', { ascending: false })
    .order('observed_at', { ascending: false }).limit(32);
  if (error) throw error;
  const matching = data.filter(row => row.nickname.toLowerCase().includes(text.toLowerCase()));
  return [...new Map(matching.reverse().map(row => [row.coach_id, { id: row.coach_id, nickname: row.nickname }])).values()];
}

export async function loadCoachIdentity(id) {
  const manual = assignedCoach(id);
  if (manual) return manual;
  const db = coachClient();
  const [roster] = await coachRosterRows(db, [id]);
  if (roster) return { id, nickname: roster.nickname, country: roster.country };
  const { data, error } = await db.from('esea_coach_lobbies')
    .select('teams,terminal,checked_at,matches!inner(status,scheduled_at)')
    .contains('coach_ids', [id]).order('checked_at', { ascending: false }).limit(30);
  if (error) throw error;
  const now = Date.now();
  for (const row of data) {
    if (!(row.terminal && finished(row.matches.status)) &&
      !(!row.terminal && upcoming(row.matches.status) && Date.parse(row.checked_at) >= now - 8 * 3600000
        && Date.parse(row.matches.scheduled_at) >= now - 12 * 3600000)) continue;
    const person = row.teams.flatMap(team => team.coaches).find(coach => coach.id === id);
    if (person) return person;
  }
  return null;
}

export async function coachPlayerNames(db, ids) {
  if (!ids.length) return new Map();
  const { data, error } = await db.rpc('esea_coach_player_identities', { p_ids: ids });
  if (error) throw error;
  const names = new Map(data.map(player => [player.id, player.nickname]));
  for (const id of ids) {
    const manual = assignedCoach(id);
    if (manual) names.set(manual.id, manual.nickname);
  }
  return names;
}

export async function resolvePlayerCoachId(db, nickname) {
  const linked = linkedPlayerProfile(nickname);
  if (linked) return linked.id;
  const escaped = nickname.replace(/[\\%_]/g, '\\$&');
  const { data, error } = await db.from('players').select('faceit_id').ilike('nickname', escaped).limit(2);
  if (error) throw error;
  if (data.length) return data.length === 1 ? data[0].faceit_id : null;
  const alias = await db.from('player_profile_aliases').select('player_id').eq('nickname', nickname.toLowerCase()).maybeSingle();
  if (alias.error) throw alias.error;
  if (alias.data?.player_id) return alias.data.player_id;
  const roster = await db.from('esea_coach_rosters').select('coach_id').ilike('nickname', escaped).limit(20);
  if (roster.error) throw roster.error;
  const observed = await db.rpc('find_esea_coaches', { p_query: nickname });
  if (observed.error) throw observed.error;
  const ids = [...new Set([...roster.data.map(row => row.coach_id),
    ...observed.data.filter(row => row.nickname.toLowerCase() === nickname.toLowerCase()).map(row => row.id)])];
  return ids.length === 1 ? ids[0] : null;
}

export async function loadCoachTeamMatches(db, teamId, columns) {
  const rows = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await db.from('matches').select(columns)
      .or(`team1_id.eq.${teamId},team2_id.eq.${teamId}`)
      .order('id').range(offset, offset + 499);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 500) break;
  }
  return rows;
}

export async function loadCoachLobbies(db, ids, columns) {
  const rows = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await db.from('esea_coach_lobbies')
      .select(`teams,terminal,checked_at,matches!inner(${columns})`)
      .overlaps('coach_ids', ids).order('match_id').range(offset, offset + 499);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 500) return rows;
  }
}
