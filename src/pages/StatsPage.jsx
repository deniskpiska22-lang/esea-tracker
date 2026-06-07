import { Link, useParams } from "react-router-dom";
import teams from "../data/teams";
import matchesData from "../data/matches";

function StatsPage() {
  const { slug } = useParams();

  const team = teams.find((t) => t.slug === slug);

  const teamMatches = matchesData.filter(
  (match) => match.teamSlug === slug
);

const mapStats = Object.values(
  teamMatches.reduce((acc, match) => {
    match.mapScores?.forEach((map) => {
      if (!map.map) return;

      if (!acc[map.map]) {
        acc[map.map] = {
          name: map.map,
          played: 0,
          wins: 0,
        };
      }

      acc[map.map].played += 1;

      if (map.won) {
        acc[map.map].wins += 1;
      }
    });

    return acc;
  }, {})
)
  .map((map) => ({
    ...map,
    losses: map.played - map.wins,
    winrate: Math.round(
      (map.wins / map.played) * 100
    ),
  }))
  .sort((a, b) => {
    // Сначала по винрейту
    if (b.winrate !== a.winrate) {
      return b.winrate - a.winrate;
    }

    // Если винрейт одинаковый — больше сыгранных карт выше
    return b.played - a.played;
  });
  

  return (
  <div className="bg-[#0b0f14] min-h-screen text-white p-8">
    <div className="max-w-6xl mx-auto">

      <Link
        to={`/team/${slug}`}
        className="text-orange-400 hover:text-orange-300"
      >
        ← Back to Team
      </Link>

      <h1 className="text-5xl font-black mt-4 mb-8">
        {team?.name} Stats
      </h1>

      <div className="grid md:grid-cols-3 gap-4 mb-8">

        <div className="bg-[#111823] border border-[#243041] rounded-2xl p-5">
          <div className="text-gray-500 text-sm uppercase mb-2">
            Best Map
          </div>

          <div className="text-2xl font-black text-green-400">
            {mapStats[0]?.name || "-"}
          </div>

          <div className="text-gray-400">
            {mapStats[0]?.winrate || 0}% WR
          </div>
        </div>

        <div className="bg-[#111823] border border-[#243041] rounded-2xl p-5">
          <div className="text-gray-500 text-sm uppercase mb-2">
            Worst Map
          </div>

          <div className="text-2xl font-black text-red-400">
            {mapStats[mapStats.length - 1]?.name || "-"}
          </div>

          <div className="text-gray-400">
            {mapStats[mapStats.length - 1]?.winrate || 0}% WR
          </div>
        </div>

        <div className="bg-[#111823] border border-[#243041] rounded-2xl p-5">
          <div className="text-gray-500 text-sm uppercase mb-2">
            Maps Played
          </div>

          <div className="text-2xl font-black text-orange-400">
            {mapStats.reduce(
              (sum, map) => sum + map.played,
              0
            )}
          </div>
        </div>

      </div>

      <div className="space-y-5">

        {mapStats.map((map) => {

          const imageName = map.name.toLowerCase();

          return (
            <div
              key={map.name}
              className="
                overflow-hidden
                rounded-2xl
                border
                border-[#243041]
                bg-[#111823]
                hover:border-orange-500/40
                transition-all
              "
            >

              <div
                className="relative h-28 bg-cover bg-center"
                style={{
                  backgroundImage: `url(/maps/${imageName}.png)`,
                }}
              >

                <div className="absolute inset-0 bg-black/55" />

                <div className="relative z-10 h-full flex items-center justify-between px-6">

                  <div>
                    <h2 className="text-3xl font-black">
                      {map.name}
                    </h2>

                    <div className="text-sm text-gray-300 mt-1">
                      {map.played} maps played
                    </div>
                  </div>

                  <div className="text-right">

                    <div className="text-4xl font-black text-orange-400">
                      {map.winrate}%
                    </div>

                    <div className="text-gray-300">
                      Win Rate
                    </div>

                  </div>

                </div>

              </div>

              <div className="p-5">

                <div className="flex justify-between items-center mb-3">

                  <div className="flex gap-6">

                    <div>
                      <div className="text-gray-500 text-xs uppercase">
                        Wins
                      </div>

                      <div className="text-green-400 font-black text-xl">
                        {map.wins}
                      </div>
                    </div>

                    <div>
                      <div className="text-gray-500 text-xs uppercase">
                        Losses
                      </div>

                      <div className="text-red-400 font-black text-xl">
                        {map.losses}
                      </div>
                    </div>

                  </div>

                  <div className="text-gray-400">
                    {map.wins}-{map.losses}
                  </div>

                </div>

                <div className="h-3 rounded-full bg-[#0b0f14] overflow-hidden">

                  <div
                    className="h-full rounded-full bg-orange-500"
                    style={{
                      width: `${map.winrate}%`,
                    }}
                  />

                </div>

              </div>

            </div>
          );
        })}

      </div>

    </div>
  </div>
);
}

export default StatsPage;