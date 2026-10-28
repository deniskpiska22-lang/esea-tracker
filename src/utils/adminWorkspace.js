export const ADMIN_SECTIONS = ['overview', 'traffic', 'users', 'teams', 'forum', 'news', 'demos', 'system'];
export function adminSection(value) {
  return ADMIN_SECTIONS.includes(value) ? value : 'overview';
}
export function workerHealth(worker, now = Date.now()) {
  const status = String(worker?.status || '').toLowerCase();
  // Explicitly paused/disabled jobs are not failed heartbeats.
  if (['paused', 'access_required', 'disabled'].includes(status)) return 'paused';
  const ping = Date.parse(worker?.last_ping);
  if (!Number.isFinite(ping)) return 'unknown';
  if (now - ping > 15 * 60_000) return 'stale';
  if (['error', 'failed', 'offline', 'rate-limited', 'rate_limited'].includes(status)) return 'error';
  return 'online';
}
export function safeWebUrl(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  try {
    const url = new URL(text);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
export function cleanSocialLinks(rows) {
  return rows.filter(row => String(row.url || '').trim()).map(row => {
    const url = safeWebUrl(row.url);
    if (!url) throw new Error('Use a valid HTTP or HTTPS URL.');
    return { platform: String(row.platform || 'Website').trim().slice(0, 50), url };
  });
}
export function filterAdminTeams(teams, query, division = 'all') {
  const search = query.trim().toLowerCase();
  return teams.filter(team => (!search || `${team.name} ${team.slug}`.toLowerCase().includes(search)) && (division === 'all' || team.division === division));
}
