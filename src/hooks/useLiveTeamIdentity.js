import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';

// Refresh only the displayed team, not the whole catalogue or player history.
export function useLiveTeamIdentity(team) {
  const [snapshot, setSnapshot] = useState(null);
  const teamId = team?.faceitTeamId;
  useEffect(() => {
    if (!supabase || !teamId) return;
    let cancelled = false;
    let running = false;
    async function refresh() {
      if (running || document.hidden) return;
      running = true;
      try {
        const { data, error } = await supabase.from('team_catalog')
          .select('team_id,team').eq('team_id', teamId).maybeSingle();
        if (error) throw error;
        if (!cancelled && data?.team && data.team_id === teamId) {
          setSnapshot({ base: team, data: { ...data.team, faceitTeamId: data.team_id } });
        }
      } catch (error) {
        console.warn('Team identity refresh unavailable:', error.message);
      } finally {
        running = false;
      }
    }
    refresh();
    const timer = setInterval(refresh, 60000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [team, teamId]);
  return snapshot && snapshot.base === team ? { ...team, ...snapshot.data } : team;
}
