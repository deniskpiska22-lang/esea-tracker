import { currentTeamTenureCoaches } from '../server/coachTeamTenures.js';
import { buildCoachTenures, COACH_ABSENCE_LIMIT } from '../server/coachTenures.js';
import { resolveCoachAssignments } from '../server/coachHandoff.js';
import { linkedPlayerProfile, linkedPlayerProfiles } from '../src/data/linkedPlayerProfiles.js';
import { assignedCoach, assignedCoachRows, coachAssignments } from '../server/coachAssignments.js';
import { coachClient, coachPlayerNames, coachRosterRows, coachAssignmentHandoffs, loadCoachLobbies, loadCoachTeamLobbies, loadCoachTeamMatches, findRosterCoaches, loadCoachIdentity, resolvePlayerCoachId } from '../server/coachData.js';
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
    if (team) return response.status(200).json(await currentTeamTenureCoaches(db,team));
    if (match) {
      const row = await result(db.from('esea_coach_lobbies').select('teams,terminal,checked_at').eq('match_id', match).maybeSingle());
      const valid = row && (row.terminal || Date.parse(row.checked_at) >= Date.now() - 8 * 3600000);
      const sides = valid ? row.teams.filter(side => side.coaches.length) : [];
      const catalog = sides.length ? await result(db.from('team_catalog')
        .select('team_id,team,faceit_avatar_url').in('team_id', sides.map(side => side.id))) : [];
      const logos = new Map(catalog.map(team => [team.team_id, team.faceit_avatar_url || team.team?.logo]));
      return response.status(200).json({ teams: sides.map(side => ({ id: side.id, name: side.name,
        logo: logos.get(side.id) || side.logo || null, coaches: person(side.coaches) })) });
    }

    const columns = TEAM_MAP_COLUMNS.replace('competition_id:raw_data->>competition_id,', '');
    const matchColumns = `${columns},started_at`;
    const originalIds = [coachId, ...(linked?.linkedIds || [])];
    const manual = assignedCoach(coachId);
    const manualAssignments = manual ? coachAssignments.filter(assignment => assignment.coachId === coachId) : [];
    const now = Date.now();
    const [lobbies, registrations, historyBounds, handoffs] = await Promise.all([
      loadCoachLobbies(db, originalIds, columns),
      coachRosterRows(db, originalIds),
      result(db.from('esea_coach_season_bounds').select('team_id,season,evidence')
        .in('coach_id', originalIds).order('season', { ascending: false }).limit(200)),
      coachAssignmentHandoffs(db, manualAssignments.some(assignment => assignment.handoffOnCoachLobby) ? [coachId] : []),
    ]);
    const seeds = resolveCoachAssignments(manualAssignments, registrations, handoffs, now, lobbies);
    const roomCoach = lobbies.flatMap(row => row.teams.flatMap(side => side.coaches))
      .find(person => originalIds.includes(person.id));
    const coach = manual || { id: coachId, nickname: linked?.nickname || registrations[0]?.nickname || roomCoach?.nickname,
      country: registrations[0]?.country || roomCoach?.country };
    const teamIds = [...new Set([...seeds.map(assignment => assignment.teamId), ...lobbies.flatMap(row => row.teams
      .filter(side => side.coaches.some(person => originalIds.includes(person.id))).map(side => side.id))])];
    const [teamEntries, assignmentLobbies] = await Promise.all([
      Promise.all(teamIds.map(async teamId => [teamId, await loadCoachTeamMatches(db, teamId, matchColumns)])),
      loadCoachTeamLobbies(db, teamIds),
    ]);
    const teamMatches = new Map(teamEntries);
    const ids = [...new Set([...teamIds, ...registrations.map(row => row.team_id)])];
    const [teams, links, biography, playerNames] = ids.length ? await Promise.all([
      result(db.from('team_catalog').select('team_id,team,faceit_avatar_url').in('team_id', ids)),
      result(db.from('team_profile_urls').select('team_id,slug').in('team_id', ids)),
      result(db.from('players').select('faceit_id,country').eq('faceit_id', coachId).maybeSingle()).catch(() => null),
      coachPlayerNames(db, [coachId]),
    ]) : [[], [], null, new Map()];
    const slugs = new Map(links.map(row => [row.team_id, row.slug]));
    const catalog = new Map(teams.map(row => [row.team_id, { name: row.team.name, logo: row.faceit_avatar_url || row.team.logo, slug: slugs.get(row.team_id) }]));
    const byTeam = new Map(teams.map(row => [row.team_id, row.team]));
    for (const row of registrations) if (!catalog.has(row.team_id)) {
      const snapshot = row.team_catalog?.team || row.team_snapshot;
      if (snapshot) {
        catalog.set(row.team_id, { name: snapshot.name, logo: snapshot.logo, slug: slugs.get(row.team_id) });
        byTeam.set(row.team_id, { ...snapshot, activeSeasonParticipant: false });
      }
    }
    const assignments = buildCoachTenures({coachId,seeds,rooms:lobbies,teamMatches,
      teamRooms:assignmentLobbies,now,catalog:byTeam});
    const editorialRows = assignments.flatMap(assignment => assignedCoachRows(teamMatches.get(assignment.teamId)||[],
      assignment, coach, [...lobbies,...assignmentLobbies], now));
    const covered = new Set(editorialRows.flatMap(row => row.teams.map(side => `${row.matches.id}:${side.id}`)));
    const observed = lobbies.map(row => ({ ...row, teams: row.teams
      .filter(side => !covered.has(`${row.matches.id}:${side.id}`))
      .map(side => ({ ...side, coaches: side.coaches.map(person => originalIds.includes(person.id) ? coach : person) })) }));
    const rows = [...editorialRows,...observed];
    const rosterEvidence = assignments.filter(assignment => assignment.source && catalog.has(assignment.teamId))
      .map(assignment => ({person:coach,team:{id:assignment.teamId,...catalog.get(assignment.teamId)},
        season:assignment.registeredSeason,periodId:assignment.periodId,assignment,start:assignment.start,
        end:assignment.end,observedAt:assignment.observedAt,current:assignment.current}));
    const profile = buildCoachProfile(coachId, rows, catalog, now, rosterEvidence);
    if (!profile) return response.status(404).json({ error: 'Coach not found' });
    return response.status(200).json({ ...profile, historyBounds, absenceLimit: COACH_ABSENCE_LIMIT,
      playerNickname: playerNames.get(coachId) || null, country: profile.country || biography?.country || null });
  } catch (error) {
    console.error('[coach]', error.message);
    response.setHeader('Cache-Control', 'no-store');
    return response.status(503).json({ error: 'Coach data temporarily unavailable' });
  }
}
