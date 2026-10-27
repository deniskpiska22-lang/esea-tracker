const UUID = /^(?:1-)?[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
export function readableMatchTeamName(name, id, fallback) {
  const value = typeof name === 'string' ? name.trim() : '';
  return value && value !== id && !UUID.test(value) ? value : fallback;
}
function slugPart(value) {
  return [...value.normalize('NFKD').replace(/\p{Diacritic}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,'-').replace(/^-|-$/g,'')].slice(0,80).join('').replace(/-$/,'');
}
export function matchPublicPath(match) {
  const id = match.id || match.matchId;
  if (!id) return null;
  const first = readableMatchTeamName(match.team1_name || match.team1?.name || match.teamName, match.team1_id || match.team1?.id, 'Team 1');
  const second = readableMatchTeamName(match.team2_name || match.team2?.name || match.opponentName || match.opponent?.name, match.team2_id || match.team2?.id, 'Team 2');
  const slug = first && second && `${slugPart(first) || 'team-1'}-vs-${slugPart(second) || 'team-2'}`;
  return `/match/${encodeURIComponent(id)}${slug ? `/${encodeURIComponent(slug)}` : ''}`;
}
