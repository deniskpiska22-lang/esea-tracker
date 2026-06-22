import { Link, useParams, useLocation } from "react-router-dom";
import teams from "../data/teams";
import matchesData from "../data/matches";

function MatchesPage() {
  const { slug } = useParams();
  const location = useLocation();

const mapFilter =
  new URLSearchParams(location.search).get("map");

  const team = teams.find((t) => t.slug === slug);

  const teamMatches = matchesData.filter((match) => {
  if (match.teamSlug !== slug) return false;

  if (!mapFilter) return true;

  return match.mapScores?.some(
    (m) =>
      m.map?.toLowerCase() ===
      mapFilter.toLowerCase()
  );
});

  const groupedMatches = teamMatches.reduce((acc, match) => {
    if (!acc[match.season]) {
      acc[match.season] = [];
    }

    acc[match.season].push(match);

    return acc;
  }, {});

  return (
    <div className="bg-[#0b0f14] min-h-screen text-white px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <Link
          to={`/team/${slug}`}
          className="text-orange-400 hover:text-orange-300"
        >
          ← Back to Team
        </Link>

        <h1 className="text-4xl font-black mt-4 mb-8">
          {team?.name} Matches
        </h1>

{mapFilter && (
  <div className="mb-6 flex items-center gap-3">
    <span className="px-3 py-1 rounded-full bg-orange-500/20 text-orange-400">
      {mapFilter}
    </span>

    <Link
      to={`/team/${slug}/matches`}
      className="text-gray-400 hover:text-white"
    >
      Clear Filter
    </Link>
  </div>
)}

        {Object.entries(groupedMatches).map(([season, matches]) => (
          <div key={season} className="mb-10">
            <div className="bg-[#1a2330] rounded-xl p-4 mb-4">
              <h2 className="text-xl font-bold">
                {season}
              </h2>
            </div>

            <div className="space-y-3">
              {matches.map((match, index) => (
                <Link
  key={`${match.matchId}-${index}`}
  to={`/team/${slug}/matches/${match.matchId}`}
                  className="
                    flex
                    items-center
                    justify-between
                    bg-[#111823]
                    border
                    border-[#243041]
                    rounded-xl
                    px-6
                    py-4
                    transition-all
                    duration-300
                    hover:border-orange-500/50
                    hover:translate-x-1
                    hover:shadow-[0_10px_30px_rgba(249,115,22,0.12)]
                  "
                >
                  {/* Левая часть */}
                  <div className="flex items-center gap-6 min-w-[180px]">
                    <span
                      className={`font-bold text-lg ${
                        match.won
                          ? "text-green-400"
                          : "text-red-400"
                      }`}
                    >
                      {match.result}
                    </span>

                    <span className="text-gray-500">
                      {match.date}
                    </span>
                  </div>

                  {/* Центр */}
                  <div className="flex-1 flex items-center justify-between px-8">

  <div className="font-bold text-white text-lg">
    VS {match.opponentName}
  </div>

  <div className="text-sm text-gray-400">
    {match.maps?.length > 0
      ? match.maps.join(" • ")
      : "Unknown map"}
  </div>

</div>

                  {/* Правая часть */}
                  <div className="flex items-center gap-4">
                    <div className="font-black text-2xl text-white">
                      {match.boScore}
                    </div>

                    <span className="text-orange-400 text-lg">
                      ↗
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default MatchesPage;