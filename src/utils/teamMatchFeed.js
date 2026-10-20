export const FINISHED_STATUSES = ['FINISHED', 'MATCH_STATUS_FINISHED'];
export const SCHEDULED_STATUSES = ['SCHEDULED', 'MATCH_STATUS_SCHEDULED'];
export const LIVE_STATUSES = ['LIVE', 'ONGOING', 'READY', 'VOTING', 'CONFIGURING', 'PAUSED',
  'MATCH_STATUS_ONGOING', 'MATCH_STATUS_READY', 'MATCH_STATUS_VOTING',
  'MATCH_STATUS_CONFIGURING', 'MATCH_STATUS_PAUSED'];
const COLUMNS = 'id,status,competition_name,scheduled_at,started_at,finished_at,best_of,team1_id,team1_slug,team1_name,team1_logo,team1_score,team2_id,team2_slug,team2_name,team2_logo,team2_score,maps,map_scores';

export function matchKind(row) {
  const status = String(row?.status || '').toUpperCase();
  return FINISHED_STATUSES.includes(status) ? 'finished'
    : LIVE_STATUSES.includes(status) ? 'live'
    : SCHEDULED_STATUSES.includes(status) ? 'upcoming' : null;
}

function quoteFilter(value) {
  return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

export function teamMatchFilter(team) {
  // FACEIT ID remains stable when a team renames itself or changes its public URL.
  const [column, value] = team?.faceitTeamId ? ['id', team.faceitTeamId]
    : team?.slug ? ['slug', team.slug] : ['name', team?.name];
  if (!value) throw new Error('Team not found');
  return `team1_${column}.eq.${quoteFilter(value)},team2_${column}.eq.${quoteFilter(value)}`;
}

export function teamIsFirstInMatch(row, team) {
  if (team?.faceitTeamId && (row.team1_id || row.team2_id)) {
    return row.team1_id === team.faceitTeamId;
  }
  if (team?.slug && (row.team1_slug || row.team2_slug)) return row.team1_slug === team.slug;
  const normalize = value => String(value || '').replace(/\s+/g, '').toLowerCase();
  return normalize(row.team1_name) === normalize(team?.name);
}

export function compareUpcomingMatches(first, second) {
  const liveFirst = Number(matchKind(second) === 'live') - Number(matchKind(first) === 'live');
  const time = row => Date.parse(row.scheduled_at || row.started_at) || Infinity;
  return liveFirst || time(first) - time(second) || String(first.id).localeCompare(String(second.id));
}

export async function loadTeamMatchFeed(client, team, now = new Date()) {
  const filter = teamMatchFilter(team);
  const query = () => client.from('matches').select(COLUMNS);
  async function readActivePages(makeQuery) {
    const rows = [];
    for (let offset = 0; ; offset += 500) {
      const response = await makeQuery().order('scheduled_at', { ascending: true, nullsFirst: false })
        .order('id', { ascending: true }).range(offset, offset + 499);
      if (response.error) return response;
      rows.push(...(response.data || []));
      if ((response.data || []).length < 500) return { data: rows, error: null };
    }
  }
  // Separate streams keep a long results history from hiding the next fixture.
  // Unknown start times stay visible; obsolete scheduled rooms do not.
  const [upcoming, live, finished] = await Promise.all([
    readActivePages(() => query().in('status', SCHEDULED_STATUSES)
      .or(`and(or(${filter}),or(scheduled_at.gte.${now.toISOString()},scheduled_at.is.null))`)),
    readActivePages(() => query().in('status', LIVE_STATUSES).or(filter)),
    query().in('status', FINISHED_STATUSES).or(filter)
      .order('finished_at', { ascending: false, nullsFirst: false }).limit(250),
  ]);
  const error = upcoming.error || live.error || finished.error;
  if (error) return { data: null, error };
  // If a room changes status between requests, its newest lifecycle stage wins.
  const byId = new Map([...upcoming.data, ...live.data, ...(finished.data || [])].map(row => [row.id, row]));
  return { data: [...byId.values()], error: null };
}
