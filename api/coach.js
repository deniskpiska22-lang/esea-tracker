import process from 'node:process';
import { createClient } from '@supabase/supabase-js';
import { result } from '../server/seoData.js';
import { uuid, matchId } from '../server/coachLobby.js';
import { buildCoachProfile } from '../server/coachProfile.js';
import { TEAM_MAP_COLUMNS } from '../src/utils/teamMapStats.js';

const person = fields => fields.map(({ id, nickname, avatar }) => ({ id, nickname, avatar }));
let client;
function getClient() {
  client ||= createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(12000) }) },
    });
  return client;
}

export default async function handler(request, response) {
  if (request.method !== 'GET') return response.status(405).json({ error: 'Method not allowed' });
  const { id, team, match } = request.query || {};
  if ([id, team, match].filter(value => value != null).length !== 1 ||
      (id != null && !uuid(id)) || (team != null && !uuid(team)) ||
      (match != null && !matchId(match))) return response.status(400).json({ error: 'Invalid coach, team or match ID' });
  try {
    const db = getClient();
    response.setHeader('Cache-Control', 'public, max-age=60, s-maxage=180');
    if (team) {
      const [row] = await result(db.rpc('esea_latest_coach_lobby', { p_team_id: team }));
      const coaches = row?.teams.find(side => side.id === team)?.coaches || [];
      return response.status(200).json({ coaches: person(coaches), matchId: row?.match_id, observedAt: row?.observed_at });
    }
    if (match) {
      const row = await result(db.from('esea_coach_lobbies').select('teams,terminal,checked_at').eq('match_id', match).maybeSingle());
      const valid = row && (row.terminal || Date.parse(row.checked_at) >= Date.now() - 8 * 3600000);
      return response.status(200).json({ teams: valid ? row.teams.filter(side => side.coaches.length)
        .map(side => ({ id: side.id, name: side.name, coaches: person(side.coaches) })) : [] });
    }

    const rows = await result(db.from('esea_coach_lobbies')
      .select(`teams,terminal,checked_at,matches!inner(${TEAM_MAP_COLUMNS.replace('competition_id:raw_data->>competition_id,', '')})`)
      .contains('coach_ids', [id]).order('checked_at', { ascending: false }).limit(400));
    const ids = [...new Set(rows.flatMap(row => row.teams.filter(side => side.coaches.some(coach => coach.id === id)).map(side => side.id)))];
    const [teams, links, biography] = ids.length ? await Promise.all([
      result(db.from('team_catalog').select('team_id,team,faceit_avatar_url').in('team_id', ids)),
      result(db.from('team_profile_urls').select('team_id,slug').in('team_id', ids)),
      result(db.from('players').select('faceit_id,country').eq('faceit_id', id).maybeSingle()).catch(() => null),
    ]) : [[], [], null];
    const slugs = new Map(links.map(row => [row.team_id, row.slug]));
    const catalog = new Map(teams.map(row => [row.team_id, { name: row.team.name, logo: row.faceit_avatar_url || row.team.logo, slug: slugs.get(row.team_id) }]));
    const profile = buildCoachProfile(id, rows, catalog);
    if (!profile) return response.status(404).json({ error: 'Coach not found' });
    return response.status(200).json({ ...profile, country: profile.country || biography?.country || null });
  } catch (error) {
    console.error('[coach]', error.message);
    response.setHeader('Cache-Control', 'no-store');
    return response.status(503).json({ error: 'Coach data temporarily unavailable' });
  }
}
