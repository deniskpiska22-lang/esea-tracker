import { Link } from "react-router-dom";
import teams from "../data/teams";
import playerAverageRatings from "../data/playerAverageRatings.json";
import matchStatsCompact from "../data/matchStatsCompact.json";
import { normalizeNickname } from "../utils/normalizeNickname";


function TopPlayersPage() {
 const players = Object.entries(playerAverageRatings)
  .map(([nickname, rating]) => {
    const teamInfo = teams.find(
      (team) =>
        team.players?.some(
          (player) =>
            player.toLowerCase() === nickname.toLowerCase()
        )
    );

    if (!teamInfo) return null;

    const matchesPlayed = Object.values(
      matchStatsCompact
    ).reduce((count, match) => {
      const played = (match.teams || []).some((team) =>
        (team.players || []).some(
          (player) =>
            normalizeNickname(player.nickname) ===
            nickname
        )
      );

      return count + (played ? 1 : 0);
    }, 0);

    return {
      nickname,
      rating,
      matches: matchesPlayed,
      team: teamInfo.name,
      teamSlug: teamInfo.slug,
      division: teamInfo.division,
    };
  })
  .filter(Boolean)
  .sort(
  (a, b) =>
    b.rating * Math.min(b.matches / 10, 1) -
    a.rating * Math.min(a.matches / 10, 1)
);

const top3 = players.slice(0, 3);



  return (
    <div className="bg-[#0b0f14] min-h-screen text-white p-8">
      <div className="max-w-7xl mx-auto">

        <h1 className="text-5xl font-black mb-10">
          Top Players
        </h1>

        {/* TOP 3 */}

        <div className="grid md:grid-cols-3 gap-6 mb-12">

          {top3.map((player, index) => (
            <Link
              key={player.nickname}
              to={`/players/${player.nickname}`}
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
                  src={`/players/${player.nickname}.png`}
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
  {player.matches} matches
</div>

              <div className="text-orange-400 text-3xl font-black mt-4">
                {player.rating.toFixed(2)}
              </div>

            </Link>
          ))}

        </div>

        {/* TABLE */}

        <div className="bg-[#111823] border border-[#243041] rounded-2xl overflow-hidden">

          <div className="grid grid-cols-[80px_1fr_1fr_120px_120px] px-6 py-4 bg-[#161f2c] font-bold text-gray-300">

            <div>#</div>
<div>Player</div>
<div>Team</div>
<div>Matches</div>
<div>Rating</div>

          </div>

          {players.map((player, index) => (
            <Link
              key={player.nickname}
              to={`/players/${player.nickname}`}
              className="
                grid
                grid-cols-[80px_1fr_1fr_120px_120px]
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
                  src={`/players/${player.nickname}.png`}
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
    </div>
  );
}

export default TopPlayersPage;