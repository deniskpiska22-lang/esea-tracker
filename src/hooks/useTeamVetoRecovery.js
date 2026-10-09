import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";

// Recover the team being viewed before the global historical queue reaches it.
// Two requests at a time keep FACEIT traffic bounded; failures remain retryable.
export function useTeamVetoRecovery(teamId, refresh) {
  const refreshRef = useRef(refresh);
  const [recovering, setRecovering] = useState(false);
  useEffect(() => { refreshRef.current = refresh; }, [refresh]);

  useEffect(() => {
    if (!teamId || !supabase) return;
    const controller = new AbortController();
    let stopped = false;

    async function recover() {
      const since = new Date(Date.now() - 90 * 86400000).toISOString();
      const { data, error } = await supabase.from("matches").select("id")
        .in("status", ["FINISHED", "MATCH_STATUS_FINISHED"])
        .or(`team1_id.eq.${teamId},team2_id.eq.${teamId}`)
        .gte("finished_at", since).eq("veto_synced", false)
        .eq("veto_unavailable", false).order("finished_at", { ascending: false })
        .limit(300).abortSignal(controller.signal);
      if (controller.signal.aborted) return;
      if (error || !data?.length) { setRecovering(false); return; }
      setRecovering(true);
      let cursor = 0;
      let completed = 0;
      async function worker() {
        while (!controller.signal.aborted && !stopped && cursor < data.length) {
          const match = data[cursor++];
          try {
            const response = await fetch(`/api/veto?matchId=${encodeURIComponent(match.id)}`, {
              signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]),
            });
            // Back off the whole page on throttling or provider outages.
            if (response.status === 429 || response.status >= 500) stopped = true;
            await response.text();
          } catch {
            stopped = true;
          }
          completed += 1;
          if (completed % 5 === 0 && !controller.signal.aborted) refreshRef.current?.();
        }
      }
      await Promise.all([worker(), worker()]);
      if (!controller.signal.aborted) {
        setRecovering(false);
        refreshRef.current?.();
      }
    }
    recover().catch(() => { if (!controller.signal.aborted) setRecovering(false); });
    return () => controller.abort();
  }, [teamId]);

  return recovering;
}
