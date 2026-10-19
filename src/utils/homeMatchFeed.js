const PAGE_SIZE = 500;

async function readActivePages(makeQuery) {
  const rows = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const response = await makeQuery().order('scheduled_at', { ascending: true, nullsFirst: false })
      .order('id', { ascending: true }).range(offset, offset + PAGE_SIZE - 1);
    if (response.error) return { data: null, error: response.error };
    rows.push(...(response.data || []));
    if ((response.data || []).length < PAGE_SIZE) return { data: rows, error: null };
  }
}

export async function loadHomeMatchFeed(client, { columns, liveStatuses, now, end, resultsLimit }) {
  // Each stream has its own pagination: a busy live evening must never
  // exhaust the response limit before the first scheduled match is read.
  const [live, upcoming, finished] = await Promise.all([
    readActivePages(() => client.from('matches').select(columns).in('status', [...liveStatuses])),
    readActivePages(() => client.from('matches').select(columns)
      .in('status', ['SCHEDULED', 'MATCH_STATUS_SCHEDULED'])
      .gte('scheduled_at', now.toISOString()).lte('scheduled_at', end.toISOString())),
    client.from('matches').select(columns).in('status', ['FINISHED', 'MATCH_STATUS_FINISHED'])
      .order('finished_at', { ascending: false, nullsFirst: false }).limit(resultsLimit),
  ]);
  const error = live.error || upcoming.error || finished.error;
  if (error) return { data: null, error };
  // Status may change between requests. Prefer live over scheduled, and
  // confirmed results over either, without rendering duplicate match IDs.
  const byId = new Map([...upcoming.data, ...live.data, ...(finished.data || [])].map(row => [row.id, row]));
  return { data: [...byId.values()], error: null };
}
