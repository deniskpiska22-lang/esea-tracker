import { linkedPlayerProfile, linkedPlayerProfiles } from '../src/data/linkedPlayerProfiles.js';
import { assignedCoach, assignedCoachRows, coachAssignments, rosterCoachAssignments } from '../server/coachAssignments.js';
import { coachClient, coachPlayerNames, coachRosterRows, loadCoachLobbies, loadCoachTeamMatches, currentTeamCoach, findRosterCoaches, loadCoachIdentity, resolvePlayerCoachId } from '../server/coachData.js';
import { result } from '../server/seoData.js';
import { uuid, matchId } from '../server/coachLobby.js';
import { buildCoachProfile } from '../server/coachProfile.js';
import { TEAM_MAP_COLUMNS } from '../src/utils/teamMapStats.js';

const person = fields => fields.map(({ id, nickname, avatar }) => ({ id, nickname, avatar }));
export default async function handler(request, response) {
  if (request.method !== 'GET') return response.status(405).json({ error: 'Method not allowed' });
  const { id, team, match, search, player, identity } = request.query || {};
  const textKey = value => typeof value === 'string' && value.trim().length >= 2 && value.length <= 80;
  if ([id, team, match, search, player, identity].filter(value => value != null).length !== 1 ||
      (id != null && !uuid(id)) || (team != null && !uuid(team)) || (identity != null && !uuid(identity)) ||
      (match != null && !matchId(match)) || (search != null && !textKey(search)) ||
      (player != null && !textKey(player))) return response.status(400).json({ error: 'Invalid coach lookup' });
  try {
    const db = coachClient();
    response.setHeader('Cache-Control', 'public, max-age=60, s-maxage=180');
    if (search != null) {
      const [lobbyCoaches, rosterCoaches] = await Promise.all([
        result(db.rpc('find_esea_coaches', { p_query: search.trim() })),
        findRosterCoaches(db, search.trim()),
      ]);
      const key = search.trim().toLowerCase();
      const editorial = linkedPlayerProfiles.filter(profile =>
        [profile.nickname, ...profile.aliases].some(nick => nick.toLowerCase().includes(key)))
        .map(profile => assignedCoach(profile.id)).filter(Boolean);
      const unique = [...new Map([...lobbyCoaches, ...rosterCoaches, ...editorial].map(coach => {
        const person = linkedPlayerProfile(coach.id);
        const merged = person ? { ...coach, id: person.id, nickname: person.nickname } : coach;
        return [merged.id, merged];
      })).values()].sort((a, b) => {
        const priority = name => name.toLowerCase() === key ? 0 : name.toLowerCase().startsWith(key) ? 1 : 2;
        return priority(a.nickname) - priority(b.nickname) || a.nickname.localeCompare(b.nickname);
      }).slice(0, 8);
      const names = await coachPlayerNames(db, unique.map(coach => coach.id));
      return response.status(200).json({ coaches: unique.map(coach => ({
        id: coach.id, nickname: coach.nickname, playerNickname: names.get(coach.id) || null,
      })) });
    }
    if (identity) {
      const canonical = linkedPlayerProfile(identity)?.id || identity;
      const coach = await loadCoachIdentity(canonical);
      const names = await coachPlayerNames(db, coach ? [canonical] : []);
      return response.status(200).json({ coach: coach ? { id: canonical, nickname: coach.nickname } : null,
        playerNickname: names.get(canonical) || null });
    }
    const lookup = player != null ? (uuid(player) ? player : await resolvePlayerCoachId(db, player.trim())) : id;
    const linked = linkedPlayerProfile(lookup);
    const coachId = linked?.id || lookup;
    if (player != null && !coachId) return response.status(404).json({ error: 'Coach not found' });
    if (team) {
      const [registration, [row]] = await Promise.all([
        currentTeamCoach(db, team),
        result(db.rpc('esea_latest_coach_lobby', { p_team_id: team })),
      ]);
      const coaches = registration ? (registration.coach_id ? [{ id: registration.coach_id, nickname: registration.nickname, avatar: null }] : [])
        : row?.teams.find(side => side.id === team)?.coaches || [];
      const editorial = coachAssignments.filter(assignment => assignment.teamId === team && assignment.current
        && Date.parse(assignment.start) <= Date.now()).map(assignment => assignedCoach(assignment.coachId)).filter(Boolean);
      const unique = [...new Map((editorial.length ? editorial : coaches).map(coach => {
        const canonical = assignedCoach(coach.id) || coach;
        return [canonical.id, canonical];
      })).values()];
      return response.status(200).json({ coaches: person(unique), matchId: row?.match_id, observedAt: registration?.observed_at || row?.observed_at });
    }
    if (match) {
      const row = await result(db.from('esea_coach_lobbies').select('teams,terminal,checked_at').eq('match_id', match).maybeSingle());
      const valid = row && (row.terminal || Date.parse(row.checked_at) >= Date.now() - 8 * 3600000);
      return response.status(200).json({ teams: valid ? row.teams.filter(side => side.coaches.length)
        .map(side => ({ id: side.id, name: side.name, coaches: person(side.coaches) })) : [] });
    }

    const columns = TEAM_MAP_COLUMNS.replace('competition_id:raw_data->>competition_id,', '');
    const matchColumns = `${columns},started_at`;
    const originalIds = [coachId, ...(linked?.linkedIds || [])];
    const manual = assignedCoach(coachId);
    const manualAssignments = manual ? coachAssignments.filter(assignment => assignment.coachId === coachId) : [];
    const now = Date.now();
    const [lobbies, assignmentLobbies, registrations, historyBounds] = await Promise.all([
      loadCoachLobbies(db, originalIds, columns),
      manualAssignments.some(assignment => assignment.current) ? result(db.from('esea_coach_lobbies')
        .select('match_id,teams').overlaps('team_ids', [...new Set(manualAssignments.filter(a => a.current).map(a => a.teamId))])
        .order('checked_at', { ascending: false }).limit(100)).catch(() => []) : [],
      coachRosterRows(db, originalIds),
      result(db.from('esea_coach_season_bounds').select('team_id,season,evidence')
        .in('coach_id', originalIds).order('season', { ascending: false }).limit(200)),
    ]);
    const assignments = [...manualAssignments, ...rosterCoachAssignments(registrations, manualAssignments, now)];
    const coach = manual || { id: coachId, nickname: linked?.nickname || registrations[0]?.nickname,
      country: registrations[0]?.country };
    const teamIds = [...new Set(assignments.map(assignment => assignment.teamId))];
    const teamMatches = new Map(await Promise.all(teamIds.map(async teamId =>
      [teamId, await loadCoachTeamMatches(db, teamId, matchColumns)])));
    const editorialRows = assignments.flatMap(assignment => assignedCoachRows(teamMatches.get(assignment.teamId),
      assignment, coach, [...lobbies, ...assignmentLobbies], now));
    const covered = new Set(editorialRows.flatMap(row => row.teams.map(side => `${row.matches.id}:${side.id}`)));
    const observed = lobbies.map(row => ({ ...row, teams: row.teams
      .filter(side => !covered.has(`${row.matches.id}:${side.id}`))
      .map(side => ({ ...side, coaches: side.coaches.map(coach => originalIds.includes(coach.id) ? manual || { ...coach, id: coachId } : coach) })) }));
    const rows = [...editorialRows, ...observed];
    const ids = [...new Set([...registrations.map(row => row.team_id), ...rows.flatMap(row => row.teams
      .filter(side => side.coaches.some(coach => coach.id === coachId)).map(side => side.id))])];
    const [teams, links, biography, playerNames] = ids.length ? await Promise.all([
      result(db.from('team_catalog').select('team_id,team,faceit_avatar_url').in('team_id', ids)),
      result(db.from('team_profile_urls').select('team_id,slug').in('team_id', ids)),
      result(db.from('players').select('faceit_id,country').eq('faceit_id', coachId).maybeSingle()).catch(() => null),
      coachPlayerNames(db, [coachId]),
    ]) : [[], [], null, new Map()];
    const slugs = new Map(links.map(row => [row.team_id, row.slug]));
    const catalog = new Map(teams.map(row => [row.team_id, { name: row.team.name, logo: row.faceit_avatar_url || row.team.logo, slug: slugs.get(row.team_id) }]));
    const byTeam = new Map(teams.map(row => [row.team_id, row.team]));
    const rosterEvidence = registrations.filter(row => catalog.has(row.team_id)).map(row => ({
      person: { id: coachId, nickname: linked?.nickname || row.nickname, country: row.country },
      team: { id: row.team_id, ...catalog.get(row.team_id) },
      season: row.season, start: row.source_started_at,
      observedAt: row.observed_at,
      current: row.active && byTeam.get(row.team_id)?.activeSeasonParticipant === true
        && row.season === Number(byTeam.get(row.team_id)?.season)
        && Date.parse(row.observed_at) >= now - 30 * 86400000,
    }));
    const profile = buildCoachProfile(coachId, rows, catalog, now, rosterEvidence);
    if (!profile) return response.status(404).json({ error: 'Coach not found' });
    return response.status(200).json({ ...profile, historyBounds,
      playerNickname: playerNames.get(coachId) || null, country: profile.country || biography?.country || null });
  } catch (error) {
    console.error('[coach]', error.message);
    response.setHeader('Cache-Control', 'no-store');
    return response.status(503).json({ error: 'Coach data temporarily unavailable' });
  }
}
