import Link from "../components/SiteLink.jsx";
import { tx } from "../i18n/translate.js";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

function TopPlayersPage() {
  const [visiblePlayers, setVisiblePlayers] = useState(100);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let running = false;
    async function loadPlayers() {
      if (running) return;
      running = true;
      try {
        if (!supabase) throw new Error("Supabase unavailable");
        const rows = [];
        for (let offset = 0; offset < visiblePlayers; offset += 100) {
          const { data, error: queryError } = await supabase.rpc("get_top_player_ratings", {
            p_limit: 100, p_offset: offset,
          });
          if (queryError) throw queryError;
          if (cancelled) return;
          rows.push(...(data || []));
          if (!data || data.length < 100) break;
        }
        if (!cancelled) {
          setPlayers(rows.map((row) => ({ ...row, rating: Number(row.rating),
            matches: row.matches_played, team: row.team_name || "—", teamSlug: row.team_slug })));
          setHasMore(rows.length === visiblePlayers);
          setError("");
        }
      } catch (err) {
        console.warn("Top players unavailable:", err.message);
        if (!cancelled) setError(tx("Automatic statistics are temporarily unavailable"));
      } finally {
        running = false;
        if (!cancelled) setLoading(false);
      }
    }
    loadPlayers();
    const timer = setInterval(() => { if (!document.hidden) loadPlayers(); }, 60000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [visiblePlayers]);

  const getPlayerPath = (player) => `/players/${encodeURIComponent(player.nickname || player.player_id)}`;
const top3 = players.slice(0, 3);



  return (
    <div className="bg-[#0b0f14] min-h-screen text-white p-8">
      <div className="max-w-7xl mx-auto">

<div className="flex gap-6 text-sm mb-8 border-b border-[#243041] pb-4">

  <Link
    to="/"
    className="text-gray-400 hover:text-white transition"
  >{tx(" Rankings ")}</Link>

  <Link
    to="/players"
    className="text-white border-b border-orange-500 pb-1"
  >{tx(" Players ")}</Link>

  <Link
    to="/Media"
    className="text-gray-400 hover:text-white transition"
  >{tx(" Media ")}</Link>

  <Link
    to="/about"
    className="text-gray-400 hover:text-white transition"
  >{tx(" About ")}</Link>

</div>

        <h1 className="text-5xl font-black mb-10">{tx(" Top Players ")}</h1>

      

        {loading && <p role="status" className="mb-6 text-gray-400">{tx("Loading...")}</p>}
        {error && <p role="alert" className="mb-6 text-yellow-300">{error}</p>}
        {/* TOP 3 */}

        <div className="grid md:grid-cols-3 gap-6 mb-12">

          {top3.map((player, index) => (
            <Link
              key={player.player_id}
              to={getPlayerPath(player)}
state={{
  from: "/players",
  label: "← Back to Top Players"
}}
              className="
                bg-[#111823]
                border border-[#243041]
                rounded-2xl
                p-6
                hover:border-orange-500/50
                transition-all
              "
            >

              <div className="text-5xl mb-4">
                {index === 0
                  ? "🥇"
                  : index === 1
                  ? "🥈"
                  : "🥉"}
              </div>

              <div className="relative h-40 mb-4 flex items-end justify-center overflow-hidden">

                <img
                  src={player.avatar || "/player-silhouette.png"}
                  alt={player.nickname}
                  onError={(e) => {
                    e.currentTarget.src =
                      "/player-silhouette.png";
                  }}
                  className="h-full object-contain"
                />

              </div>

              <h2 className="text-2xl font-black">
                {player.nickname}
              </h2>

              <div className="text-gray-400 mt-1">
  {player.team}
</div>

<div className="text-xs text-orange-400 mt-1">
  {player.division}
</div>

<div className="text-xs text-gray-500 mt-1">
  {player.matches}{tx(" matches ")}</div>

              <div className="text-orange-400 text-3xl font-black mt-4">
                {player.rating.toFixed(2)}
              </div>

            </Link>
          ))}

        </div>

        {/* TABLE */}

        <div className="bg-[#111823] border border-[#243041] rounded-2xl overflow-x-auto">

          <div className="grid min-w-[650px] grid-cols-[80px_1fr_1fr_120px_120px] px-6 py-4 bg-[#161f2c] font-bold text-gray-300">

            <div>#</div>
<div>{tx("Player")}</div>
<div>{tx("Team")}</div>
<div>{tx("Matches")}</div>
<div>{tx("Rating")}</div>

          </div>

          {players.slice(0, visiblePlayers).map((player, index) => (
            <Link
              key={player.player_id}
              to={getPlayerPath(player)}
state={{
  from: "/players",
  label: "← Back to Top Players"
}}
              className="
                grid
                min-w-[650px] grid-cols-[80px_1fr_1fr_120px_120px]
                items-center
                px-6
                py-4
                border-t border-[#243041]
                hover:bg-[#151f2b]
                transition
              "
            >

              <div className="font-black text-lg">
                {index + 1}
              </div>

              <div className="flex items-center gap-3">

                <img
                  src={player.avatar || "/player-silhouette.png"}
                  alt={player.nickname}
                  onError={(e) => {
                    e.currentTarget.src =
                      "/player-silhouette.png";
                  }}
                  className="w-12 h-12 object-cover rounded-lg"
                />

                <span className="font-semibold">
                  {player.nickname}
                </span>

              </div>

              <div>
  <div className="text-gray-300">
    {player.team}
  </div>

  <div className="text-xs text-orange-400">
    {player.division}
  </div>
</div>

<div className="text-gray-400 font-medium">
  {player.matches}
</div>

<div className="text-orange-400 font-black text-xl">
  {player.rating.toFixed(2)}
</div>

            </Link>
          ))}

        </div>

      </div>
      {hasMore && (
  <div className="flex justify-center mt-8">
    <button
      onClick={() => setVisiblePlayers((v) => v + 100)}
      className="
        px-6
        py-3
        bg-[#111823]
        border border-[#243041]
        rounded-xl
        text-white
        hover:border-orange-500
        hover:text-orange-400
        transition
      "
    >{tx(" Load More Players ")}</button>
  </div>
)}
    </div>
  );
}

export default TopPlayersPage;
