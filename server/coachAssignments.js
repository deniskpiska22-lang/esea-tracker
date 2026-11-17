import { linkedPlayerProfile } from '../src/data/linkedPlayerProfiles.js';

export const coachAssignments = [
  {
    coachId: '0871c9f5-cacc-460e-a44a-c85bb414ad5b',
    teamId: '7f46e5e4-a472-4945-a5fc-2f20b5b6725d',
    season: 58,
  },
  {
    coachId: '0871c9f5-cacc-460e-a44a-c85bb414ad5b',
    teamId: 'dcb2f3b3-72b5-4e7a-b8c5-921e1c3eeee4',
    start: '2026-11-07',
    current: true,
    handoffOnCoachLobby: true,
  },
];

export function assignedCoach(id) {
  const person = linkedPlayerProfile(id);
  if (!person || !coachAssignments.some(assignment => assignment.coachId === person.id)) return null;
  return { id: person.id, nickname: person.nickname, country: 'RU' };
}

export function assignmentMatches(assignment, match) {
  if (![match.team1_id, match.team2_id].includes(assignment.teamId)) return false;
  if (assignment.season && !new RegExp(`^\\s*(?:ESEA\\s+(?:Season\\s+)?|S)${assignment.season}\\b`, 'i').test(match.competition_name || '')) return false;
  // Ignore upstream zero dates. Prefer the start of a match so a game
  // that spans midnight is attributed to the correct coaching period.
  const day = [match.started_at, match.scheduled_at, match.finished_at].find(value => Date.parse(value) > Date.UTC(2000, 0));
  return Boolean(day && (!assignment.start || Date.parse(day) >= Date.parse(assignment.start))
    && (!assignment.end || (assignment.endExclusive
      ? Date.parse(day) < Date.parse(assignment.end) : Date.parse(day) <= Date.parse(assignment.end))));
}

export function assignedCoachRows(matches, assignment, coach, lobbyRows, now) {
  const existing = new Map(lobbyRows.map(row => [row.match_id || row.matches.id, row]));
  const seen = new Set();
  const coachIds = new Set([coach.id, ...(linkedPlayerProfile(coach.id)?.linkedIds || [])]);
  return matches.flatMap(match => {
    if (!assignmentMatches(assignment, match) || seen.has(match.id)) return [];
    seen.add(match.id);
    const terminal = ['FINISHED', 'MATCH_STATUS_FINISHED'].includes(match.status);
    const ownSide = match.team1_id === assignment.teamId ? 'team1' : 'team2';
    const lobby = existing.get(match.id);
    const lobbySide = lobby?.teams.find(team => team.id === assignment.teamId);
    const validEvidence = lobby?.terminal || Date.parse(lobby?.checked_at) >= now - 8 * 3600000;
    if (assignment.source === 'league_roster' && validEvidence && lobbySide?.coaches?.length
      && !lobbySide.coaches.some(person => coachIds.has(person.id))) return [];
    const startedAt = [match.started_at, match.scheduled_at, match.finished_at].find(value => Date.parse(value) > Date.UTC(2000, 0));
    return [{
      terminal, checked_at: new Date(now).toISOString(),
      matches: { ...match, finished_at: Date.parse(match.finished_at) > Date.UTC(2000, 0) ? match.finished_at : null,
        scheduled_at: Date.parse(match.scheduled_at) > Date.UTC(2000, 0) ? match.scheduled_at : startedAt },
      teams: [{
        id: assignment.teamId, name: lobbySide?.name || match[`${ownSide}_name`],
        logo: lobbySide?.logo || match[`${ownSide}_logo`], roster: (lobbySide?.roster || []).filter(player => !coachIds.has(player.id)),
        coaches: [coach], assignment,
      }],
    }];
  });
}

export function rosterCoachAssignments(rows, manualAssignments = [], now = Date.now()) {
  return rows.filter(row => Date.parse(row.period_started_at || row.source_started_at) > Date.UTC(2000, 0)
    && Date.parse(row.period_started_at || row.source_started_at) <= now
    && !manualAssignments.some(assignment => assignment.teamId === row.team_id))
    .map(row => {
      const catalog = row.team_catalog?.team;
      const current = row.active && catalog?.activeSeasonParticipant === true
        && row.season === Number(catalog.season) && Date.parse(row.observed_at) >= now - 30 * 86400000;
      return { coachId: row.coach_id, teamId: row.team_id, start: row.period_started_at || row.source_started_at,
        end: current ? null : row.ended_at || row.observed_at, current, source: 'league_roster',
        periodId: row.id, startSource: row.start_source || 'league_membership', registeredSeason: row.season };
    });
}
