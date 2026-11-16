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

export async function loadCoachIdentity(id) {
  const { data, error } = await coachClient().from('esea_coach_lobbies')
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
  return new Map(data.map(player => [player.id, player.nickname]));
}

export async function resolvePlayerCoachId(db, nickname) {
  const escaped = nickname.replace(/[\\%_]/g, '\\$&');
  const { data, error } = await db.from('players').select('faceit_id').ilike('nickname', escaped).limit(2);
  if (error) throw error;
  if (data.length) return data.length === 1 ? data[0].faceit_id : null;
  const alias = await db.from('player_profile_aliases').select('player_id').eq('nickname', nickname.toLowerCase()).maybeSingle();
  if (alias.error) throw alias.error;
  return alias.data?.player_id || null;
}
