const idOf=row=>row.matchId||row.id;
const nameKey=value=>String(value||'').normalize('NFKD').replace(/\p{Diacritic}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
export function recentPrematchResults(matches,currentId,now=new Date()){
 const end=new Date(now),start=new Date(now);start.setUTCMonth(start.getUTCMonth()-3);start.setUTCHours(0,0,0,0);
 const seen=new Set();
 return matches.filter(row=>{
  const id=idOf(row),date=Date.parse(row.date);
  if(!id||id===currentId||seen.has(id)||!Number.isFinite(date)||date<start.getTime()||date>end.getTime())return false;
  seen.add(id);return true;
 }).sort((a,b)=>Date.parse(b.date)-Date.parse(a.date));
}
export function prematchHeadToHead(leftMatches,rightMatches,left,right,currentId){
 const seen=new Set(),rows=[];
 const leftSlug=left.slug||`history-left:${left.id}`,rightSlug=right.slug||`history-right:${right.id}`;
 for(const [matches,opponent,slug] of [[leftMatches,right,leftSlug],[rightMatches,left,rightSlug]]){
  for(const row of matches){
   const id=idOf(row);if(!id||id===currentId||seen.has(id))continue;
   // An explicit FACEIT ID always wins over a current/historical team name.
   const opponentId=row.opponentId||row.opponent_id||row.opponent?.id;
   const matchesOpponent=opponentId&&opponent.id?String(opponentId)===String(opponent.id):Boolean(nameKey(opponent.name)&&nameKey(row.opponentName)===nameKey(opponent.name));
   if(!matchesOpponent)continue;
   seen.add(id);rows.push({...row,matchId:id,teamSlug:slug});
  }
 }
 return {matches:rows.sort((a,b)=>String(b.date).localeCompare(String(a.date))),leftSlug};
}
