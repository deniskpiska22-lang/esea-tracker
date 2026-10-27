// FACEIT's Data API returns URLs containing a literal {lang} placeholder.
// The immutable room ID is authoritative; stored URLs must never override it.
export function faceitMatchRoomUrl(matchId) {
  if (typeof matchId !== 'string' || !/^(?:1-)?[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(matchId)) return null;
  return `https://www.faceit.com/en/cs2/room/${matchId}`;
}
