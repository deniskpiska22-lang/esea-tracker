import { linkedPlayerProfile } from '../src/data/linkedPlayerProfiles.js';
import { validFaceitAvatar } from '../src/utils/teamAvatar.js';
import { assignedCoach, coachAssignments } from './coachAssignments.js';
import { finished, upcoming, uuid } from './coachLobby.js';

export function buildCoachDirectory(rows, catalog, now = Date.now()) {
  const entries = new Map();
  function add(person, side, date, id, isFinished, manual = false) {
    if (!uuid(person.id) || !person.nickname || !uuid(side.id)) return;
    const linked = linkedPlayerProfile(person.id);
    const key = linked?.id || person.id;
    const previous = entries.get(key);
    const team = catalog.get(side.id);
    const entry = previous || { id: key, matches: new Set(), date: 0 };
    if (!previous || manual || (!entry.manual && date >= entry.date)) {
      Object.assign(entry, { nickname: linked?.nickname || person.nickname, team: team?.team?.name || side.name,
        avatar: validFaceitAvatar(person.avatar) || entry.avatar || null,
        country: person.country || entry.country || null,
        teamLogo: validFaceitAvatar(team?.faceit_avatar_url || side.logo || team?.team?.logo),
        date, manual });
    } else if (!entry.avatar) entry.avatar = validFaceitAvatar(person.avatar);
    if (isFinished && id) entry.matches.add(id);
    entries.set(key, entry);
  }

  for (const row of rows) {
    const match = row.matches;
    const completed = row.terminal && finished(match?.status);
    const date = Date.parse(match?.finished_at || match?.scheduled_at);
    if (!Number.isFinite(date) || (completed ? date > now : row.terminal || !upcoming(match?.status)
        || !(Date.parse(row.checked_at) >= now - 8 * 3600000) || date < now - 12 * 3600000)) continue;
    for (const side of row.teams || []) {
      if (![match.team1_id, match.team2_id].includes(side.id)) continue;
      for (const person of side.coaches || []) add(person, side, Math.min(date, now), row.match_id, completed);
    }
  }
  for (const assignment of coachAssignments) {
    const date = Date.parse(assignment.start);
    const person = assignedCoach(assignment.coachId);
    if (assignment.current && date <= now && person) add(person, { id: assignment.teamId }, date, null, false, true);
  }

  return [...entries.values()].sort((a,b) => b.date - a.date || a.nickname.localeCompare(b.nickname))
    .map(({ matches, manual, ...entry }) => ({ ...entry, observedMatches: matches.size, editorial: manual }));
}
