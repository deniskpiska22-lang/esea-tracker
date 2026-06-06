import { useParams, Link } from "react-router-dom"
import teams from "../data/teams"
import history from "../data/teamHistory.json"
import playersData from "../data/players"
import matchesData from "../data/matches"


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
  const teamMatches = matchesData?.[slug] ?? []
  const recentForm = teamMatches.slice(0, 5);
  const teamPlayersStats = playersData?.[slug] ?? []

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
            <div className="flex gap-12 mt-5 flex-wrap items-center justify-center md:justify-start">

  <div className="flex gap-3">

    <span className="px-4 py-2 bg-orange-500/10 border border-orange-500/20 rounded-xl text-orange-400 font-semibold">
      {currentRating} Rating
    </span>

    <span className="px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400 font-semibold">
      {winrate}% WR
    </span>

  </div>

  <div className="-mt-5">

    <div className="text-xs uppercase tracking-[0.2em] text-gray-500 mb-2">
      Last 5
    </div>

    <div className="flex gap-2">

      {recentForm.map((match, index) => (
        <div
          key={index}
          className={`
            w-9
            h-9
            rounded-lg
            flex
            items-center
            justify-center
            font-black
            text-sm
            ${
              match.result === "WIN"
                ? "bg-green-500/15 text-green-400 border border-green-500/30"
                : "bg-red-500/15 text-red-400 border border-red-500/30"
            }
          `}
        >
          {match.result === "WIN" ? "W" : "L"}
        </div>
      ))}

    </div>

  </div>

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

{/* NAVIGATION */}
<div className="max-w-6xl mx-auto mt-8 mb-4">

  <div className="flex gap-2 border-b border-[#263041] pb-3">

    <Link
      to={`/team/${slug}`}
      className="
        px-5
        py-2
        rounded-xl
        bg-orange-500/10
        text-orange-400
        font-semibold
      "
    >
      Overview
    </Link>

    <Link
      to={`/team/${slug}/matches`}
      className="
        px-5
        py-2
        rounded-xl
        text-gray-300
        hover:bg-[#141d2a]
        transition
      "
    >
      Matches
    </Link>

  </div>

</div>

{/* 🧑 PLAYERS */}

<div className="max-w-6xl mx-auto mt-8 flex gap-4 flex-wrap">

{teamPlayersStats.map((player, index) => (
<a
key={`${player.nickname}-${index}`}
href={`https://www.faceit.com/en/players/${player.nickname}`}
target="_blank"
rel="noreferrer"
className="
flex-1
min-w-[190px]
bg-gradient-to-b
from-[#182230]
to-[#0f141c]
border
border-[#2a3547]
rounded-3xl
p-6
relative
overflow-hidden
transition-all
duration-300
hover:-translate-y-2
hover:border-orange-500/50
hover:shadow-[0_15px_40px_rgba(249,115,22,0.15)]
"
>
  {/* TOP COLOR BAR */}
  <div
    className={`absolute top-0 left-0 w-full h-1 ${
      player.rating >= 1.1
        ? "bg-green-500"
        : player.rating < 0.95
        ? "bg-red-500"
        : "bg-orange-500"
    }`}
  />

  <div className="flex flex-col items-center text-center">

    {/* PLAYER ICON */}
    <div
      className="
      w-16
      h-16
      rounded-full
      bg-gradient-to-br
      from-orange-500/20
      to-orange-700/10
      border
      border-orange-500/20
      flex
      items-center
      justify-center
      text-xl
      font-black
      text-orange-300
      mb-4
      mt-2
      "
    >
      {player.nickname[0].toUpperCase()}
    </div>

    {/* NICKNAME */}
    <h3 className="font-bold text-white text-lg">
      {player.nickname}
    </h3>

    {/* RATING */}
    <div className="mt-5">

      <div
        className={`text-4xl font-black leading-none ${
          player.rating >= 1.1
            ? "text-green-400"
            : player.rating < 0.95
            ? "text-red-400"
            : "text-orange-400"
        }`}
      >
        {player.rating ?? "-"}
      </div>

      <div className="text-[11px] uppercase tracking-[0.2em] text-gray-500 mt-1">
        Rating
      </div>

    </div>

    {/* ELO */}
    <div className="mt-5 w-full border-t border-[#243041] pt-4">

      <div className="text-[11px] uppercase tracking-[0.2em] text-gray-500">
        FACEIT ELO
      </div>

      <div className="text-white font-bold text-xl mt-1">
        {player.elo ?? "-"}
      </div>

    </div>

  </div>

</a>
))}

</div>

    {/* 📈 GRAPH (MOVED DOWN) */}
    <div className="max-w-6xl mx-auto mt-10 bg-[#111823] border border-[#1f2a3a] rounded-2xl p-6">

      <h2 className="text-2xl font-bold mb-6">
        Rating History
      </h2>

      {teamHistory.length ? (
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={teamHistory}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="week" />
              <YAxis />
              <Tooltip
  contentStyle={{
    background: "#111823",
    border: "1px solid #2a3547",
    borderRadius: "12px",
    color: "#fff",
  }}
/>
              <Line
  type="monotone"
  dataKey="rating"
  stroke="#f97316"
  strokeWidth={4}
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

</div>   

)
}

export default TeamPage