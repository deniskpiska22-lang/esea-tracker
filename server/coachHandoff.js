import { linkedPlayerProfile } from '../src/data/linkedPlayerProfiles.js';
import { finished, upcoming } from './coachLobby.js';
import { rosterCoachAssignments } from './coachAssignments.js';

export const coachAssignmentKey = (teamId, assignment) => assignment.tenureKey
  || (assignment.periodId ? `${teamId}:roster:${assignment.periodId}`
    : `${teamId}:assigned:${assignment.season || assignment.start}`);

export function resolveCoachAssignments(manual, registrations, checkpoints, now = Date.now(), rooms = []) {
  const released = new Map();
  const assignments = manual.map(assignment => {
    const checkpoint = assignment.handoffOnCoachLobby && checkpoints.find(row => row.coach_id === assignment.coachId
      && row.team_id === assignment.teamId && Date.parse(row.started_at) === Date.parse(assignment.start)
      && row.confirmed_match_id && row.confirmed_team_id && Date.parse(row.handoff_at) >= Date.parse(assignment.start)
      && Date.parse(row.confirmed_at) <= now && Date.parse(row.handoff_at) <= now);
    if (!checkpoint) return assignment;
    const closed = { ...assignment, current: false, end: checkpoint.handoff_at, endExclusive: true,
      handoff: checkpoint };
    released.set(assignment.teamId, closed);
    return closed;
  });
  const automatic = rosterCoachAssignments(registrations, assignments.filter(row => !row.handoff), now)
    .flatMap(assignment => {
      const closed = released.get(assignment.teamId);
      if (!closed) return [assignment];
      if (assignment.end && Date.parse(assignment.end) <= Date.parse(closed.end)) return [];
      return [{ ...assignment, start: Date.parse(assignment.start) < Date.parse(closed.end) ? closed.end : assignment.start }];
    });
  // A newer explicit room must beat a stale current-roster observation.
  for (const assignment of automatic) {
    if (!assignment.current || !released.size) continue;
    const registration = registrations.find(row => row.id === assignment.periodId);
    const checkpoint = [...released.values()][0].handoff;
    const transferAt = coachRoomTransferAt(rooms, assignment.coachId, assignment.teamId,
      Math.max(Date.parse(registration?.observed_at), Date.parse(checkpoint.handoff_at) - 1), now, checkpoints);
    if (Number.isFinite(transferAt)) {
      assignment.current = false;
      assignment.end = new Date(transferAt).toISOString();
      assignment.endExclusive = true;
    }
  }
  for (const closed of released.values()) {
    const boundaryOnly = automatic.find(row => row.teamId === closed.teamId
      && row.endExclusive && Date.parse(row.start) === Date.parse(row.end));
    if (boundaryOnly) {
      boundaryOnly.tenureKey = coachAssignmentKey(closed.teamId, closed);
      boundaryOnly.tenureStart = closed.start;
    }
    if (closed.handoff.confirmed_team_id !== closed.teamId) continue;
    // Only the initial continuous roster stint inherits the manually confirmed start.
    const continuation = automatic.filter(row => row.teamId === closed.teamId
      && Date.parse(row.start) <= Date.parse(closed.handoff.confirmed_at))
      .sort((a,b) => Date.parse(a.start)-Date.parse(b.start))[0];
    if (continuation) {
      continuation.tenureKey = coachAssignmentKey(closed.teamId, closed);
      continuation.tenureStart = closed.start;
    }
  }
  return [...assignments, ...automatic];
}

const roomMatchAt = row => Date.parse([row.matches.started_at, row.matches.scheduled_at, row.matches.finished_at]
  .find(value => Date.parse(value) > Date.UTC(2000, 0)));
const usableRoom = (row, now) => row.matches && (row.terminal && finished(row.matches.status)
  || !row.terminal && upcoming(row.matches.status) && Date.parse(row.checked_at) >= now - 8 * 3600000);

export function coachRoomTransferAt(rows, coachId, teamId, after, now = Date.now(), checkpoints = []) {
  const linked = linkedPlayerProfile(coachId), canonicalId = linked?.id || coachId;
  const identities = new Set([canonicalId, coachId, ...(linked?.linkedIds || [])]);
  const durable = checkpoints.filter(checkpoint => checkpoint.coach_id === canonicalId
    && checkpoint.confirmed_team_id && checkpoint.confirmed_team_id !== teamId
    && Date.parse(checkpoint.confirmed_at) <= now && Date.parse(checkpoint.handoff_at) > after)
    .map(checkpoint => Date.parse(checkpoint.handoff_at));
  return Math.min(Infinity, ...durable, ...rows.filter(row => usableRoom(row, now)
    && Math.min(roomMatchAt(row), Date.parse(row.checked_at)) > after
    && row.teams.some(side => side.id !== teamId && side.coaches.some(person => identities.has(person.id))))
    .map(row => Math.min(roomMatchAt(row), Date.parse(row.checked_at))));
}

// Rooms remain evidence, never an instruction to attribute all of a team's games.
// Join the initial room-based continuation to the manual history until a transfer.
export function continueCoachHandoffRooms(rows, assignments, coachId, now = Date.now(), evidence = rows) {
  const matchAt = roomMatchAt;
  const closures = assignments.filter(assignment => assignment.handoff
    && assignment.handoff.confirmed_team_id === assignment.teamId).map(closed => ({
      closed,
      transferAt: coachRoomTransferAt(evidence, coachId, closed.teamId, Date.parse(closed.end) - 1, now),
    }));
  return rows.map(row => ({ ...row, teams: row.teams.map(side => {
    if (!side.coaches.some(person => person.id === coachId)) return side;
    const entry = closures.find(({closed}) => closed.teamId === side.id);
    if (!entry) return side;
    const { closed, transferAt } = entry, at = matchAt(row);
    if (!Number.isFinite(at) || at < Date.parse(closed.end) || at >= transferAt) return side;
    return { ...side, assignment: { start: closed.end, tenureStart: closed.start,
      tenureKey: coachAssignmentKey(side.id, closed), source: 'match_rooms' } };
  }) }));
}
