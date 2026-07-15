import { createClient } from "@supabase/supabase-js";

const FINISHED = ["FINISHED", "MATCH_STATUS_FINISHED"];

function aggregateMaps(matches, teamId) {
  const totals = new Map();
  for (const match of matches) {
    const maps = Array.isArray(match.map_scores) ? match.map_scores : [];
    for (const item of maps) {
      if (!item?.map) continue;
      const current = totals.get(item.map) || { name: item.map, played: 0, wins: 0 };
      current.played += 1;
      if (item.winner_id && item.winner_id === teamId) current.wins += 1;
      totals.set(item.map, current);
    }
  }
  return [...totals.values()]
    .map((item) => ({
      ...item,
      losses: item.played - item.wins,
      winrate: item.played ? Math.round((item.wins / item.played) * 100) : 0,
    }))
    .sort((a, b) => b.winrate - a.winrate || b.played - a.played || a.name.localeCompare(b.name));
}

export default async function handler(request, response) {
  try {
    const slug = String(request.query?.slug || "").trim();
    if (!slug) return response.status(400).json({ ok: false, error: "slug is required" });

    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY;
    if (!url || !key) return response.status(500).json({ ok: false, error: "Supabase environment variables are missing" });

    const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await supabase
      .from("matches")
      .select("id,status,competition_name,scheduled_at,finished_at,team1_id,team1_name,team1_slug,team1_logo,team1_score,team2_id,team2_name,team2_slug,team2_logo,team2_score,winner_id,faceit_url,maps,map_scores")
      .in("status", FINISHED)
      .or(`team1_slug.eq.${slug},team2_slug.eq.${slug}`)
      .order("finished_at", { ascending: false, nullsFirst: false })
      .limit(300);
    if (error) throw error;

    const matches = data || [];
    const first = matches[0];
    const teamId = first?.team1_slug === slug ? first.team1_id : first?.team2_id;
    const normalized = matches.map((match) => {
      const ownIsFirst = match.team1_slug === slug;
      return {
        id: match.id,
        matchId: match.id,
        teamSlug: slug,
        teamName: ownIsFirst ? match.team1_name : match.team2_name,
        opponentName: ownIsFirst ? match.team2_name : match.team1_name,
        teamScore: ownIsFirst ? match.team1_score : match.team2_score,
        opponentScore: ownIsFirst ? match.team2_score : match.team1_score,
        won: Boolean(teamId && match.winner_id === teamId),
        result: teamId && match.winner_id === teamId ? "WIN" : "LOSS",
        season: match.competition_name,
        date: match.finished_at || match.scheduled_at,
        status: match.status,
        maps: match.maps || [],
        mapScores: (Array.isArray(match.map_scores) ? match.map_scores : []).map((item) => ({
          map: item.map,
          teamScore: ownIsFirst ? item.team1_score : item.team2_score,
          opponentScore: ownIsFirst ? item.team2_score : item.team1_score,
          won: Boolean(teamId && item.winner_id === teamId),
        })),
        faceitUrl: match.faceit_url,
      };
    });

    response.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=120");
    return response.status(200).json({ ok: true, teamId, matches: normalized, maps: aggregateMaps(matches, teamId) });
  } catch (error) {
    console.error("team-stats error:", error);
    return response.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }
}
