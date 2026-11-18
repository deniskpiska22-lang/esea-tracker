import { useEffect, useState } from 'react';
import tournaments from '../data/tournaments.js';
import { supabase } from '../lib/supabaseClient';

const columns = 'id,championship_id,name,logo,tier,location,start_date,end_date,completed_at,url,prize_pool,lifecycle';
const known = new Map(tournaments.map(tournament => [tournament.id, tournament]));

function mergeTournamentSummaries(rows) {
  const merged = new Map(known);
  for (const row of rows) {
    const seed = known.get(row.id);
    // Preserve the confirmed bundled repair during the deployment handover.
    const completedAt = row.completed_at || seed?.completedAt || null;
    merged.set(row.id, {
      ...seed,
      id: row.id, championshipId: row.championship_id, name: row.name, logo: row.logo,
      tier: row.tier, location: row.location, startDate: row.start_date || seed?.startDate,
      endDate: completedAt?.slice(0, 10) || row.end_date || seed?.endDate,
      completedAt, lifecycle: row.lifecycle || seed?.lifecycle, url: row.url, prizePool: row.prize_pool,
    });
  }
  return [...merged.values()];
}

export default function useTournamentSummaries() {
  const [summaries, setSummaries] = useState(tournaments);
  useEffect(() => {
    if (!supabase) return;
    let controller;
    async function refresh() {
      if (controller) return;
      controller = new AbortController();
      const signal = controller.signal;
      try {
        const { data, error } = await supabase.from('tournaments').select(columns).order('start_date', { ascending: false }).abortSignal(signal);
        if (!signal.aborted && !error && data) setSummaries(mergeTournamentSummaries(data));
      } catch {
        // Keep the last usable summary when the network is unavailable.
      } finally {
        controller = null;
      }
    }
    void refresh();
    const timer = window.setInterval(() => { if (!document.hidden) void refresh(); }, 60_000);
    return () => { window.clearInterval(timer); controller?.abort(); };
  }, []);
  return summaries;
}
