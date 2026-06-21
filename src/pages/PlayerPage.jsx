import { useParams, Link } from "react-router-dom";
import matchStatsCompact from "../data/matchStatsCompact.json";
import teams from "../data/teams";
import players from "../data/players";
import playerTransfers from "../data/playerTransfers.json";
import playerAverageRatings from "../data/playerAverageRatings.json";
import { normalizeNickname } from "../utils/normalizeNickname";
import { calculatePlayerMatchRating } from "../utils/calculatePlayerRating";
import matchesData from "../data/matches.js";

function PlayerPage() {
  const { nickname } = useParams();

const decodedNickname = normalizeNickname(decodeURIComponent(nickname));
const averageRating =
  playerAverageRatings[normalizeNickname(decodedNickname)] || 0;
const avatarPath = `/players/${decodedNickname}.png`;

const playerTeam = teams.find((team) =>
  team.players?.some(
    (player) =>
      player.toLowerCase() === decodedNickname.toLowerCase()
  )
);

const playerInfo = Object.values(players)
  .flat()
  .find(
    (p) => normalizeNickname(p.nickname) === decodedNickname
  );

  const transfers =
  playerTransfers[decodedNickname] || [];

const normalizeTeamName = (name) =>
  name?.replace(/\s+/g, "").toLowerCase();

const playerMatches = Object.values(matchStatsCompact)
  .flatMap((match) =>
    (match.teams || []).flatMap((team) =>
      (team.players || [])
        .filter(
          (player) =>
            normalizeNickname(player.nickname) === decodedNickname
        )
        .map((player) => {
          const siteMatch = matchesData.find(
            (m) =>
              m.matchId === match.matchId &&
              normalizeTeamName(m.teamName) ===
                normalizeTeamName(team.teamName)
          );

          return {
            ...player,
            matchId: match.matchId,
            teamSlug: siteMatch?.teamSlug, // <-- добавляем здесь
            map: match.map,
            teamName: team.teamName,
            teamScore: team.score,
            opponent: match.teams?.find(
              (t) => t.teamId !== team.teamId
            ),
            rating: calculatePlayerMatchRating(player),
          };
        })
    )
  );

const recentForm = [...playerMatches]
  .reverse()
  .slice(0, 10)
  .map((match) => {
    const myTeam = match.teamName;
    const opponent = match.opponent;

    return {
      win:
        match.teamScore >
        (opponent?.score || 0),
      map: match.map,
    };
  });

const totalMatches = playerMatches.length;

const avg = (field) => {
  if (!playerMatches.length) return 0;

  return (
    playerMatches.reduce(
      (sum, match) => sum + (match[field] || 0),
      0
    ) / playerMatches.length
  );
};

const avgKills = avg("kills");
const avgDeaths = avg("deaths");
const avgAdr = avg("adr");
const avgKd = avg("kd");
const avgHs = avg("hsRate");

  return (
  <div className="min-h-screen bg-[#0b1118] text-white">
    <div className="max-w-7xl mx-auto px-6 py-8">

      <Link
  to={`/teams/${playerTeam?.slug}`}
  className="text-gray-400 hover:text-orange-400 transition"
>
  ← Back to {playerTeam?.name}
</Link>

      <div
        className="
          mt-6
          bg-[#111823]
          border border-[#243041]
          rounded-3xl
          p-8
        "
      >
        <div className="grid lg:grid-cols-[220px_1fr_220px] gap-8">

          {/* Avatar */}

<div
  className="
    relative
    w-[220px]
    h-[220px]
    rounded-3xl
    bg-[#111823]
    border border-[#243041]
    overflow-hidden
  "
>

  {/* Team Logo */}

  {playerTeam?.logo && (
    <img
      src={playerTeam.logo}
      alt={playerTeam.name}
      className="
        absolute
        inset-0
        w-full
        h-full
        object-contain
        opacity-20
        scale-125
      "
    />
  )}

  {/* Dark Overlay */}

  <div
    className="
      absolute
      inset-0
      bg-gradient-to-t
      from-[#111823]
      via-transparent
      to-transparent
      z-10
    "
  />

  {/* Player Silhouette */}

  <img
  src={avatarPath}
  alt={decodedNickname}
  onError={(e) => {
    e.currentTarget.src = "/player-silhouette.png";
  }}
  className="
    absolute
    bottom-0
    left-1/2
    -translate-x-1/2
    h-[110%]
    object-contain
    z-20
  "
/>

</div>


          {/* Main Info */}

          <div>

            <h1 className="text-5xl font-black">
              {decodedNickname}
            </h1>

            <div className="mt-3 text-xl text-gray-400">
              {playerTeam?.name || "Unknown Team"}
            </div>

<div className="text-sm text-gray-500 mt-3">
  Last {recentForm.length} matches
</div>

            <div className="flex gap-2 mt-5">

  {recentForm.map((game, index) => (

    <div
      key={index}
      title={game.map}
      className={`
        w-8
        h-8
        rounded-lg
        flex
        items-center
        justify-center
        text-xs
        font-bold
        ${
          game.win
            ? "bg-green-500/20 text-green-400 border border-green-500/30"
            : "bg-red-500/20 text-red-400 border border-red-500/30"
        }
      `}
    >
      {game.win ? "W" : "L"}
    </div>

  ))}

</div>

            <div className="mt-8 space-y-4">

              

              <div className="flex justify-between border-b border-[#243041] pb-2">
                <span className="text-gray-400">
                  Matches
                </span>

                <span>
                  {totalMatches}
                </span>
              </div>

              <div className="flex justify-between border-b border-[#243041] pb-2">
                <span className="text-gray-400">
                  Average ADR
                </span>

                <span>
                  {avgAdr.toFixed(1)}
                </span>
              </div>

              <div className="flex justify-between border-b border-[#243041] pb-2">
                <span className="text-gray-400">
                  Average K/D
                </span>

                <span>
                  {avgKd.toFixed(2)}
                </span>
              </div>

            </div>

          </div>

          {/* Right Stats */}

          <div className="space-y-4">

  <div className="bg-[#0f1623] rounded-2xl p-5 border border-[#243041]">
    <div className="text-gray-400 text-sm">
      FACEIT ELO
    </div>

    <div className="text-4xl font-black mt-2 text-orange-400">
      {playerInfo?.elo || "-"}
    </div>
  </div>

  <div className="bg-[#0f1623] rounded-2xl p-5 border border-[#243041]">
    <div className="text-gray-400 text-sm">
      PLAYER RATING
    </div>

    <div
      className={`
        text-4xl font-black mt-2
        ${
          averageRating >= 1.1
            ? "text-green-400"
            : averageRating >= 1
            ? "text-yellow-400"
            : "text-red-400"
        }
      `}
    >
      {averageRating ? averageRating.toFixed(2) : "-"}
    </div>
  </div>

  <div className="bg-[#0f1623] rounded-2xl p-5 border border-[#243041]">
    <div className="text-gray-400 text-sm">
      MATCHES
    </div>

    <div className="text-4xl font-black mt-2">
      {totalMatches}
    </div>
  </div>

</div>

        </div>
      </div>

{/* SECOND ROW */}

<div className="grid lg:grid-cols-2 gap-6 mt-6">

  {/* PERFORMANCE */}

  <div
    className="
      bg-[#111823]
      border border-[#243041]
      rounded-3xl
      p-6
    "
  >
    <h2 className="text-2xl font-black mb-6">
      Performance
    </h2>

    {[
      {
        label: "ADR",
        value: avgAdr,
        max: 120,
      },
      {
        label: "K/D",
        value: avgKd,
        max: 2,
      },
      {
        label: "HS%",
        value: avgHs,
        max: 100,
      },
      {
        label: "Kills",
        value: avgKills,
        max: 30,
      },
      {
        label: "Deaths",
        value: avgDeaths,
        max: 30,
      },
    ].map((stat) => (
      <div key={stat.label} className="mb-5">

        <div className="flex justify-between mb-1">
          <span>{stat.label}</span>

          <span className="font-bold">
            {stat.value.toFixed(2)}
          </span>
        </div>

        <div className="h-2 bg-[#1a2433] rounded-full overflow-hidden">
          <div
            className="h-full bg-orange-500"
            style={{
              width: `${Math.min(
                (stat.value / stat.max) * 100,
                100
              )}%`,
            }}
          />
        </div>

      </div>
    ))}
  </div>

 {/* RECENT MATCHES */}
<div
  className="
    bg-[#111823]
    border border-[#243041]
    rounded-3xl
    p-6
  "
>
  <h2 className="text-2xl font-black mb-6">
    Recent Matches
  </h2>

  {[...playerMatches]
  .sort((a, b) => new Date(b.date) - new Date(a.date)) // новая сверху
  .slice(0, 10)
  .map((match, index) => (
    <Link
      key={`${match.matchId}-${index}`}
      to={`/team/${match.teamSlug}/matches/${match.matchId}`} // Faceit ID
      className="
        flex
        justify-between
        items-center
        border-b
        border-[#243041]
        py-3
        px-2
        rounded
        hover:bg-[#151e2b]
        transition-colors
      "
    >
      <div>
        <div className="font-medium">
          {match.opponent?.teamName || "Unknown"}
        </div>
        <div className="text-sm text-gray-400">
          {match.map}
        </div>
      </div>

      <div
        className={`font-bold ${
          match.rating >= 1.15
            ? "text-green-400"
            : match.rating < 0.95
            ? "text-red-400"
            : "text-orange-400"
        }`}
      >
        {match.rating?.toFixed(2) || "-"}
      </div>
    </Link>
  ))}
</div>

</div>

    </div>
  </div>
);

{/* Team History */}

{transfers.length > 0 && (
  <div
    className="
      mt-8
      bg-[#111823]
      border
      border-[#243041]
      rounded-3xl
      p-6
    "
  >
    <h2 className="text-2xl font-black mb-6">
      Team History
    </h2>

    <div className="space-y-4">

      {transfers
        .slice()
        .reverse()
        .map((transfer, index) => (

          <div
            key={index}
            className="
              flex
              items-center
              justify-between
              border-b
              border-[#243041]
              pb-4
            "
          >

            <div>

              <div className="font-bold text-white">
                {transfer.from}
                {" → "}
                {transfer.to}
              </div>

              <div className="text-sm text-gray-500 mt-1">
                Transfer
              </div>

            </div>

            <div className="text-gray-400 text-sm">
              {transfer.date}
            </div>

          </div>

      ))}

    </div>

  </div>
)}

}

export default PlayerPage;