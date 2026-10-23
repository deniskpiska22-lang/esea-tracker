import { useEffect, useMemo, useState } from 'react';
import { EMPTY_HISTORY, EMPTY_PLAYER_HISTORY, loadStaticHistory } from '../lib/staticHistory.js';
import { normalizeNickname } from '../utils/normalizeNickname.js';

export function useStaticHistory(kind, key, enabled = true) {
  const [result, setResult] = useState(null);
  useEffect(() => {
    if (!key || !enabled) return undefined;
    let active = true;
    loadStaticHistory(kind, key).then(value => {
      if (active) setResult({ kind, key, value });
    }).catch(error => {
      console.warn('Static history unavailable:', error.message);
      if (active) setResult({ kind, key, value: null });
    });
    return () => { active = false; };
  }, [kind, key, enabled]);
  return result?.kind === kind && result.key === key ? result.value : undefined;
}

export function useStaticTeamMatches(slug) {
  return useStaticHistory('teams', slug) || EMPTY_HISTORY;
}

export function useStaticMatch(matchId) {
  return useStaticHistory('matches', matchId) || EMPTY_HISTORY;
}

export function useStaticPlayerHistory(nickname) {
  const rows = useStaticHistory('players', normalizeNickname(nickname).toLowerCase());
  // Derive once when the JSON response changes, not on every render.
  return usePlayerProjection(rows);
}

function usePlayerProjection(rows) {
  return useMemo(() => rows ? {
    stats: Object.fromEntries(rows.map(row => [row.stats.matchId, row.stats])),
    matches: rows.flatMap(row => row.matches),
  } : EMPTY_PLAYER_HISTORY, [rows]);
}
