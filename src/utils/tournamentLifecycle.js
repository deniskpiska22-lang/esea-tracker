// Browser display safety: stale/idle championships must not remain live forever.
export function lifecycleStatus(tournament,now=Date.now()) {
  const life=tournament?.lifecycle;
  if(!life)return null; // Preserve date-only legacy entries until refreshed.
  if(/^(FINISHED|COMPLETED|ENDED|CANCELLED|CANCELED|CHAMPIONSHIP_STATUS_(FINISHED|CANCELLED))$/i.test(life.sourceStatus||''))return 'finished';
  const checked=Date.parse(life.checkedAt);
  if(!Number.isFinite(checked)||now-checked>12*3600000)return 'pending';
  if(/^(CREATED|UPCOMING|SUBSCRIPTION.*|REGISTRATION.*|CHECK_?IN.*|DRAFT)$/i.test(life.sourceStatus||''))return 'upcoming';
  if(life.activeMatches>0&&life.activeMatchAt>=now-12*3600000)return 'live';
  if(life.nextMatchAt>now&&life.nextMatchAt<=now+86400000)return 'live';
  if(life.lastActivityAt&&life.lastActivityAt>=now-36*3600000)return 'live';
  return 'pending';
}
