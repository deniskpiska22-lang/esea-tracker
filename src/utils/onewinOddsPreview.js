import { buildOneWinMatchUrl } from './onewinMatch.js';

const MATCH_ID = '1-19ff85af-b700-41a2-a23b-4722323b0a03';

// An explicit design preview of the user-supplied DNK–LPH example. These
// prices are a captured sample and must never enter the live odds API.
export function getOneWinOddsPreview(matchId, search) {
  if (matchId !== MATCH_ID || new URLSearchParams(search).get('oddsPreview') !== '1') return null;
  return {
    matchId: MATCH_ID,
    provider: '1win',
    team1: { name: 'DNK', price: 3.2 },
    team2: { name: 'LPH Gaming', price: 1.3 },
    updatedAt: '2026-10-25T23:37:49.418Z',
    href: buildOneWinMatchUrl({ id: 42108768, slug: 'dnk-vs-lph', serviceV2: 'prematch', sourceOrigin: 'https://one-vv8346.com' }),
  };
}
