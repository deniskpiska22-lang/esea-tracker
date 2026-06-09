import { Link, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import matchesData from "../data/matches";
import teams from "../data/teams";
import matchStatsV3 from "../data/matchStatsV3.json";

function MatchPage() {
  const { slug, matchId } = useParams();

  const match = matchesData.find(
  (m) => m.teamSlug === slug && m.matchId === matchId
);

const stats = matchStatsV3[matchId]?.[0];
console.log("MATCH V3", stats);

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

const recentTeamMatches = matchesData
  .filter((m) => m.teamSlug === slug && m.matchId !== match.matchId)
  .sort((a, b) => new Date(b.date) - new Date(a.date))
  .slice(0, 8);

  const threeMonthsAgo = new Date();
threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

const currentTeamMatches = matchesData
  .filter(
    (m) =>
      m.teamSlug === slug &&
      new Date(m.date) >= threeMonthsAgo
  )
  .sort((a, b) => new Date(b.date) - new Date(a.date));

const opponentMatches = opponentTeam
  ? matchesData
      .filter(
        (m) =>
          m.teamSlug === opponentTeam.slug &&
          new Date(m.date) >= threeMonthsAgo
      )
      .sort((a, b) => new Date(b.date) - new Date(a.date))
  : [];

const h2hMatches = opponentTeam
  ? matchesData.filter((m) => {
      return (
        (m.teamSlug === slug &&
          m.opponentName === opponentTeam.name) ||
        (m.teamSlug === opponentTeam.slug &&
          m.opponentName === match.teamName)
      );
    })
  : [];

  const uniqueH2HMatches = [
  ...new Map(
    h2hMatches.map((m) => [
      m.matchId,
      m
    ])
  ).values()
];

let teamWins = 0;
let opponentWins = 0;

uniqueH2HMatches.forEach((m) => {

  const [left, right] =
    m.boScore.split(":").map(Number);

  if (m.teamSlug === slug) {

    if (left > right)
      teamWins++;
    else
      opponentWins++;

  } else {

    if (left > right)
      opponentWins++;
    else
      teamWins++;

  }

});
  
const formatH2HScore = (item) => {
  if (item.teamSlug === slug) {
    return item.boScore;
  }

  const [left, right] =
    item.boScore.split(":");

  return `${right}:${left}`;
};

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

{/* PLAYER STATS */}

{stats?.teams && (
  <div className="mt-10">

    <h2 className="text-2xl font-black mb-4">
      Player Statistics
    </h2>

    <div className="grid lg:grid-cols-2 gap-6">

      {stats.teams.map((team, teamIndex) => (

        <div
          key={teamIndex}
          className="
            bg-[#111823]
            border
            border-[#243041]
            rounded-2xl
            overflow-hidden
          "
        >

          <div className="px-5 py-4 border-b border-[#243041]">

            <div className="text-xl font-black">
              {team.teamName}
            </div>

          </div>

          <table className="w-full">

            <thead>
              <tr className="text-gray-500 text-sm">

                <th className="text-left p-3">
                  Player
                </th>

                <th>K</th>
                <th>D</th>
                <th>ADR</th>
                <th>HS%</th>
                <th>K/D</th>

              </tr>
            </thead>

            <tbody>

              {[...(team.players || [])]
                .sort(
                  (a, b) =>
                    (b.kd || 0) -
                    (a.kd || 0)
                )
                .map((player) => (

                  <tr
                    key={player.playerId}
                    className="
                      border-t
                      border-[#1d2634]
                      hover:bg-[#151e2b]
                    "
                  >

                    <td className="p-3 font-semibold">
                      {player.nickname}
                    </td>

                    <td className="text-center">
                      {player.kills ?? 0}
                    </td>

                    <td className="text-center">
                      {player.deaths ?? 0}
                    </td>

                    <td className="text-center">
                      {player.adr
                        ? player.adr.toFixed(1)
                        : "0.0"}
                    </td>

                    <td className="text-center">
                      {player.hsRate
                        ? player.hsRate.toFixed(0)
                        : 0}
                      %
                    </td>

                    <td
                      className={`
                        text-center
                        font-bold
                        ${
                          (player.kd || 0) >= 1
                            ? "text-green-400"
                            : "text-red-400"
                        }
                      `}
                    >
                      {player.kd
                        ? player.kd.toFixed(2)
                        : "0.00"}
                    </td>

                  </tr>

                ))}

            </tbody>

          </table>

        </div>

      ))}

    </div>

  </div>
)}


{/* RECENT MATCHES */}

<div className="mt-10">

  <h2 className="text-2xl font-black mb-4">
    Recent Matches (Past 3 Months)
  </h2>

  <div className="grid md:grid-cols-2 gap-6">

    {/* OUR TEAM */}

    <div
      className="
        bg-[#111823]
        border
        border-[#243041]
        rounded-2xl
        overflow-hidden
        flex
        flex-col
      "
    >

      <div className="px-5 py-4 border-b border-[#243041]">

        <div className="font-black text-lg">
          {match.teamName}
        </div>

      </div>

      <div
        className="
          max-h-[340px]
          overflow-y-auto
        "
      >

        {currentTeamMatches.map((item) => (

          <Link
            key={item.matchId}
            to={`/team/${slug}/matches/${item.matchId}`}
            className="
              flex
              justify-between
              items-center
              px-5
              py-3
              border-b
              border-[#1d2634]
              last:border-b-0
              hover:bg-[#151e2b]
              transition-colors
            "
          >

            <div>

              <div className="font-medium">
                {item.opponentName}
              </div>

              <div className="text-xs text-gray-500">
                {item.date}
              </div>

            </div>

            <div
              className={`
                font-black
                ${
                  item.won
                    ? "text-green-400"
                    : "text-red-400"
                }
              `}
            >
              {item.teamSlug === slug
  ? item.boScore
  : item.boScore.split(":").reverse().join(":")
}
            </div>

          </Link>

        ))}

      </div>

    </div>

    {/* OPPONENT */}

    <div
      className="
        bg-[#111823]
        border
        border-[#243041]
        rounded-2xl
        overflow-hidden
        flex
        flex-col
      "
    >

      <div className="px-5 py-4 border-b border-[#243041]">

        <div className="font-black text-lg">
          {match.opponentName}
        </div>

      </div>

      {opponentTeam ? (

        <div
          className="
            max-h-[340px]
            overflow-y-auto
          "
        >

          {opponentMatches.map((item) => (

            <Link
              key={item.matchId}
              to={`/team/${item.teamSlug}/matches/${item.matchId}`}
              className="
                flex
                justify-between
                items-center
                px-5
                py-3
                border-b
                border-[#1d2634]
                last:border-b-0
                hover:bg-[#151e2b]
                transition-colors
              "
            >

              <div>

                <div className="font-medium">
                  {item.opponentName}
                </div>

                <div className="text-xs text-gray-500">
                  {item.date}
                </div>

              </div>

              <div
  className="
    w-1/3
    text-right
    font-black
    text-orange-400
  "
>
  {item.teamSlug === slug
    ? item.boScore
    : item.boScore
        .split(":")
        .reverse()
        .join(":")
  }
</div>

            </Link>

          ))}

        </div>

      ) : (

        <div className="p-6 text-gray-500">
          Team is not in CIS Rankings
        </div>

      )}

    </div>

  </div>

</div>

{/* HEAD TO HEAD */}

{opponentTeam && uniqueH2HMatches.length > 0 && (

<div className="mt-10">

  <h2 className="text-2xl font-black mb-4">
    Head to Head
  </h2>

  <div
    className="
      bg-[#111823]
      border
      border-[#243041]
      rounded-2xl
      overflow-hidden
    "
  >

    {/* SCORE */}

    <div
      className="
        grid
        grid-cols-3
        items-center
        text-center
        border-b
        border-[#243041]
        p-6
      "
    >

      <div className="flex flex-col items-center">

  {teamLogo && (
    <img
      src={teamLogo}
      alt={match.teamName}
      className="
        w-12
        h-12
        object-contain
        mb-2
      "
    />
  )}

  <div className="text-lg text-gray-400">
    {match.teamName}
  </div>

  <div className="text-5xl font-black text-green-400">
    {teamWins}
  </div>

</div>

      <div>

        <div className="text-gray-500 text-sm">
          H2H Record
        </div>

        <div className="text-xl font-bold">
          Matches: {uniqueH2HMatches.length}
        </div>

      </div>

<div className="flex flex-col items-center">

  {opponentLogo && (
    <img
      src={opponentLogo}
      alt={match.opponentName}
      className="
        w-12
        h-12
        object-contain
        mb-2
      "
    />
  )}

  <div className="text-lg text-gray-400">
    {match.opponentName}
  </div>

  <div className="text-5xl font-black text-red-400">
    {opponentWins}
  </div>

</div>

    </div>

    {/* MATCH LIST */}

    {uniqueH2HMatches.map((item) => (

      <Link
  key={`${item.matchId}-${item.teamSlug}`}
  to={`/team/${slug}/matches/${item.matchId}`}
  className="
  relative
    flex
    justify-between
    items-center
    px-5
    py-4
    border-b
    border-[#1d2634]
    last:border-b-0
    hover:bg-[#151e2b]
    transition-colors
  "
>

  <div className="font-medium">

  {item.teamSlug === slug
    ? `${item.teamName} vs ${item.opponentName}`
    : `${item.opponentName} vs ${item.teamName}`
  }

</div>

 <div
  className="
    absolute
    left-1/2
    -translate-x-1/2
    text-center
    px-4
  "
>

  <div className="text-gray-300 text-sm font-medium truncate">
    {item.season}
  </div>

  <div className="text-xs text-gray-500 mt-1">
    {item.date}
  </div>

</div>

  <div
  className="
    w-1/3
    text-right
    font-black
    text-orange-400
  "
>
  {formatH2HScore(item)}
</div>

</Link>

    ))}

  </div>

</div>

)}

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