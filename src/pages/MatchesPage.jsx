import { Link, useParams } from "react-router-dom";
import teams from "../data/teams";
import matchesData from "../data/matches";

function MatchesPage() {
  const { slug } = useParams();

  const team = teams.find((t) => t.slug === slug);

  const teamMatches = matchesData?.[slug] ?? [];

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

        {Object.entries(groupedMatches).map(
          ([season, matches]) => (
            <div
              key={season}
              className="mb-10"
            >
              <div className="bg-[#1a2330] rounded-xl p-4 mb-4">
                <h2 className="text-xl font-bold">
                  {season}
                </h2>
              </div>

              <div className="space-y-2">

                {matches.map((match, index) => (

                  <a
  key={`${match.matchId}-${index}`}
  href={`https://faceitanalyser.com/matchanalyser/${match.matchId}/1`}
  target="_blank"
  rel="noreferrer"
  className="
    flex
    items-center
    justify-between
    bg-[#111823]
    border
    border-[#243041]
    rounded-xl
    px-5
    py-4
    transition-all
    duration-300
    hover:border-orange-500/50
    hover:translate-x-1
    hover:shadow-[0_10px_30px_rgba(249,115,22,0.12)]
  "
>

                    <div className="flex items-center gap-4">

                      <span
                        className={`font-bold ${
                          match.result === "WIN"
                            ? "text-green-400"
                            : "text-red-400"
                        }`}
                      >
                        {match.result}
                      </span>

                      <span className="text-gray-500">
                        {match.date}
                      </span>

                      <span className="text-white">
                        vs {match.opponent}
                      </span>

                    </div>

                    <div className="flex items-center gap-3">

  <div className="font-black text-xl">
    {match.mapsPlayed > 1
      ? match.boScore
      : match.maps?.[0]?.score?.replace("/", ":")}
  </div>

  <span className="text-orange-400 text-lg">
    ↗
  </span>

</div>

                  </a>

                ))}

              </div>
            </div>
          )
        )}

      </div>
    </div>
  );
}

export default MatchesPage;