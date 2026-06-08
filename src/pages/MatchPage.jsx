import { Link, useParams } from "react-router-dom";
import matchesData from "../data/matches";
import teams from "../data/teams";

function MatchPage() {
  const { slug, matchId } = useParams();

  const match = matchesData.find(
  (m) => m.teamSlug === slug && m.matchId === matchId
);

if (!match) {
  return (
    <div className="bg-[#0b0f14] min-h-screen text-white p-8">
      Match not found
    </div>
  );
}

const currentTeam = teams.find(
  (t) => t.slug === slug
);

const teamLogo =
  currentTeam?.logo || null;

const opponentTeam = teams.find(
  (t) =>
    t.name
      ?.replace(/\s+/g, "")
      .toLowerCase() ===
    match.opponentName
      ?.replace(/\s+/g, "")
      .toLowerCase()
);

const opponentLogo =
  opponentTeam?.logo || null;

  const opponentPage = teams.find(
  (t) =>
    t.name
      ?.replace(/\s+/g, "")
      .toLowerCase() ===
    match.opponentName
      ?.replace(/\s+/g, "")
      .toLowerCase()
);

  return (
    <div className="bg-[#0b0f14] min-h-screen text-white p-8">

      <div className="max-w-6xl mx-auto">

        <Link
          to={`/team/${slug}/matches`}
          className="text-orange-400 hover:text-orange-300"
        >
          ← Back to Matches
        </Link>

        {/* HERO */}

        <div
          className="
            mt-6
            bg-[#111823]
            border
            border-[#243041]
            rounded-3xl
            overflow-hidden
          "
        >
          <div className="p-10">

            <div className="grid grid-cols-3 items-center">

              <div className="flex items-center gap-5">

  {teamLogo ? (
    <img
      src={teamLogo}
      alt={match.teamName}
      className="
        w-20
        h-20
        object-contain
        rounded-xl
        bg-[#0b0f14]
        p-2
      "
    />
  ) : (
    <div
      className="
        w-20
        h-20
        rounded-xl
        bg-[#0b0f14]
        border
        border-[#243041]
        flex
        items-center
        justify-center
        text-2xl
        font-black
        text-gray-500
      "
    >
      ?
    </div>
  )}

  <Link
  to={`/team/${slug}`}
  className="
    text-4xl
    font-black
    hover:text-orange-400
    transition-colors
  "
>
  {match.teamName}
</Link>

</div>

              <div className="text-center">

                <div
  className="
    inline-flex
    px-4
    py-1
    rounded-full
    bg-orange-500/15
    border
    border-orange-500/30
    text-orange-400
    text-sm
    font-bold
    mb-4
  "
>
  BO{match.bestOf}
</div>

                <div className="text-7xl font-black text-orange-400">
                  {match.boScore}
                </div>

                <div className="text-gray-400 mt-4">
                  {match.season}
                </div>

                <div className="text-sm text-gray-500 mt-1">
                  {match.date}
                </div>

              </div>

<div className="flex items-center justify-end gap-5">

  {opponentPage ? (
  <Link
    to={`/team/${opponentPage.slug}`}
    className="
      text-4xl
      font-black
      hover:text-orange-400
      transition-colors
    "
  >
    {match.opponentName}
  </Link>
) : (
  <div className="text-4xl font-black">
    {match.opponentName}
  </div>
)}

  {opponentLogo ? (
    <img
      src={opponentLogo}
      alt={match.opponentName}
      className="
        w-20
        h-20
        object-contain
        rounded-xl
        bg-[#0b0f14]
        p-2
      "
    />
  ) : (
    <div
      className="
        w-20
        h-20
        rounded-xl
        bg-[#0b0f14]
        border
        border-[#243041]
        flex
        items-center
        justify-center
        text-2xl
        font-black
        text-gray-500
      "
    >
      ?
    </div>
  )}

</div>

            </div>

          </div>
        </div>

        {/* MAPS */}

        <div className="mt-8">

          <h2 className="text-2xl font-black mb-4">
            Maps
          </h2>

          <div className="grid md:grid-cols-3 gap-4">

            {match.mapScores?.map((map, index) => {

              const imageName =
                map.map?.toLowerCase();

              return (
                <div
                  key={index}
                  className="
                    bg-[#111823]
                    border
                    border-[#243041]
                    rounded-2xl
                    overflow-hidden
                  "
                >

                  <div
                    className="h-28 bg-cover bg-center relative"
                    style={{
                      backgroundImage: `url(/maps/${imageName}.png)`
                    }}
                  >

                    <div className="absolute inset-0 bg-black/60" />

                    <div className="relative z-10 p-4 h-full flex items-end">

                      <div className="text-2xl font-black">
                        {map.map}
                      </div>

                    </div>

                  </div>

                  <div className="p-4">

                    <div className="flex justify-between items-center">

                      <span className="text-gray-400">
                        Map Score
                      </span>

                      <span
                        className={`
                          text-xl
                          font-black
                          ${
                            map.won
                              ? "text-green-400"
                              : "text-red-400"
                          }
                        `}
                      >
                        {map.teamScore} : {map.opponentScore}
                      </span>

                    </div>

                  </div>

                </div>
              );
            })}

          </div>

        </div>

        {/* MATCH INFO */}

        <div className="mt-10">

          <h2 className="text-2xl font-black mb-4">
            Match Information
          </h2>

          <div
            className="
              bg-[#111823]
              border
              border-[#243041]
              rounded-2xl
              p-6
            "
          >

            <div className="grid md:grid-cols-2 gap-6">

              <div>

                <div className="text-gray-500 text-sm">
                  Opponent
                </div>

                <div className="font-bold text-lg">
                  {match.opponentName}
                </div>

              </div>

              <div>

                <div className="text-gray-500 text-sm">
                  League
                </div>

                <div className="font-bold text-lg">
                  {match.season}
                </div>

              </div>

              <div>

                <div className="text-gray-500 text-sm">
                  Match Date
                </div>

                <div className="font-bold text-lg">
                  {match.date}
                </div>

              </div>

              <div>

                <div className="text-gray-500 text-sm">
                  Format
                </div>

                <div className="font-bold text-lg">
                  BO{match.bestOf}
                </div>

              </div>

            </div>

            <a
              href={match.faceitUrl}
              target="_blank"
              rel="noreferrer"
              className="
                inline-flex
                mt-6
                px-5
                py-3
                rounded-xl
                bg-orange-500
                hover:bg-orange-600
                font-bold
                transition-all
              "
            >
              Open FACEIT Match Room →
            </a>

          </div>

        </div>

      </div>

    </div>
  );
}

export default MatchPage;