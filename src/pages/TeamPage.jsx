import { useParams, Link } from "react-router-dom"
import teams from "../data/teams"
import history from "../data/teamHistory.json"

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts"

function TeamPage() {
  const { slug } = useParams()
  console.log(slug)
console.log(teams.map(t => t.slug))

  // 🧠 TEAM
  const team = teams?.find((t) => t.slug === slug)

  if (!team) {
    return (
      <div className="bg-[#0b0f14] min-h-screen text-white flex items-center justify-center">
        <h1 className="text-3xl font-bold text-gray-400">
          Team not found
        </h1>
      </div>
    )
  }

  // 🧠 HISTORY SAFE
  const teamHistory = history?.[slug] ?? []

  // 🧠 CURRENT RATING (HLTV STYLE)
  const currentRating =
    teamHistory.length > 0
      ? teamHistory.at(-1)?.rating
      : team.points ?? 0

  // 🧠 STATS SAFE
  const wins = team.stats?.wins ?? 0
  const losses = team.stats?.losses ?? 0
  const total = wins + losses

  const winrate = total ? Math.round((wins / total) * 100) : 0

  return (
  <div className="bg-[#0b0f14] min-h-screen text-white px-4 md:px-8 py-8">

    {/* HEADER */}
    <Link
      to="/"
      className="inline-flex items-center gap-3 mb-8 hover:opacity-80 transition"
    >
      <span className="text-2xl md:text-3xl font-black text-orange-500">
        ESEA Tracker
      </span>
    </Link>

    {/* HERO */}
    <div className="max-w-6xl mx-auto relative overflow-hidden rounded-3xl border border-[#1f2a3a] bg-[#111823] shadow-2xl">

      <div className="p-6 md:p-10">

        <div className="flex flex-col md:flex-row items-center md:items-start gap-6">

          <div className="w-32 h-32 rounded-2xl bg-[#0f141c] border border-[#263041] flex items-center justify-center overflow-hidden">
            <img
              src={team.logo}
              alt={team.name}
              className="w-full h-full object-contain p-4"
            />
          </div>

          <div className="text-center md:text-left">

            <div className="flex items-center gap-3 justify-center md:justify-start">
              <img
                src={team.flag}
                className="w-7 h-7 rounded-sm"
              />

              <h1 className="text-4xl md:text-6xl font-black">
                {team.name}
              </h1>
            </div>

            <p className="text-gray-400 mt-3">
              Division:{" "}
              <span className="text-orange-400 font-semibold">
                {team.division}
              </span>
            </p>

            {/* HLTV VALUES */}
            <div className="flex gap-3 mt-5 flex-wrap justify-center md:justify-start">

              <span className="px-4 py-2 bg-orange-500/10 border border-orange-500/20 rounded-xl text-orange-400 font-semibold">
                {currentRating} Rating
              </span>

              <span className="px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400 font-semibold">
                {winrate}% WR
              </span>

            </div>
          </div>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-10">

          <div className="bg-[#1a2330]/80 border border-[#263041] rounded-2xl p-5">
            <p className="text-gray-400 text-sm">Wins</p>
            <p className="text-3xl font-bold text-green-400">
              {wins}
            </p>
          </div>

          <div className="bg-[#1a2330]/80 border border-[#263041] rounded-2xl p-5">
            <p className="text-gray-400 text-sm">Losses</p>
            <p className="text-3xl font-bold text-red-400">
              {losses}
            </p>
          </div>

          <div className="bg-[#1a2330]/80 border border-[#263041] rounded-2xl p-5">
            <p className="text-gray-400 text-sm">Winrate</p>
            <p className="text-3xl font-bold text-orange-400">
              {winrate}%
            </p>
          </div>

          <div className="bg-[#1a2330]/80 border border-[#263041] rounded-2xl p-5">
            <p className="text-gray-400 text-sm">Rating</p>
            <p className="text-3xl font-bold text-blue-400">
              {currentRating}
            </p>
          </div>

        </div>
      </div>
    </div>

{/* 🧑 PLAYERS CARDS (SAFE + CLEAN) */}
<div className="max-w-6xl mx-auto mt-8 flex gap-4">

  {(Array.isArray(team?.players) ? team.players : [])
    .slice(0, 5)
    .map((p, index) => {

      const nickname =
        typeof p === "string"
          ? p
          : p?.nickname ?? "unknown";

      const elo = typeof p === "object" ? p?.elo : null;
      const rating = typeof p === "object" ? p?.rating : null;
      const avatar = typeof p === "object" ? p?.avatar : null;

      return (
        <a
          key={`${nickname}-${index}`}
          href={`https://www.faceit.com/en/players/${nickname}`}
          target="_blank"
          rel="noreferrer"
          className="flex-1 bg-[#111823] border border-[#1f2a3a] rounded-2xl p-5 hover:border-orange-500/40 transition hover:scale-[1.03]"
        >
          <div className="flex flex-col items-center text-center">

            {/* AVATAR */}
            {avatar ? (
              <img
                src={avatar}
                alt={nickname}
                className="w-14 h-14 rounded-full object-cover mb-3 border border-[#263041]"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-[#1a2330] mb-3 flex items-center justify-center text-sm text-gray-300">
                {nickname.slice(0, 2).toUpperCase()}
              </div>
            )}

            {/* NICKNAME */}
            <p className="font-semibold text-white">
              {nickname}
            </p>

            {/* STATS */}
            <p className="text-xs text-gray-400 mt-1">
              {typeof p === "object" && elo && rating
                ? `Elo: ${elo} • Rating: ${rating}`
                : "FACEIT Player"}
            </p>

          </div>
        </a>
      );
    })}

</div>

    {/* 📈 GRAPH (MOVED DOWN) */}
    <div className="max-w-6xl mx-auto mt-10 bg-[#111823] border border-[#1f2a3a] rounded-2xl p-6">

      <h2 className="text-2xl font-bold mb-6">
        Rating History
      </h2>

      {teamHistory.length ? (
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={teamHistory}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="week" />
              <YAxis />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="rating"
                stroke="#f97316"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="text-gray-500">
          No history yet
        </div>
      )}
    </div>

    {/* ❌ LAST MATCHES REMOVED */}

  </div>
  );
}

export default TeamPage;