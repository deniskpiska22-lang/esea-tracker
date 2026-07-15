import {
  Link,
  useParams,
} from "react-router-dom";

import teams from "../data/teams";
import matchesData from "../data/matches";
import { useTeamStats } from "../hooks/useTeamStats";

function StatsPage() {
  const { slug } = useParams();

  const team =
    teams.find(
      (item) =>
        item.slug === slug
    ) || null;

  const fallbackMatches =
    matchesData.filter(
      (match) =>
        match.teamSlug === slug
    );

  const {
    matches: teamMatches,
    maps: liveMapStats,
    loading,
    error,
  } = useTeamStats(
    slug,
    fallbackMatches
  );

  const fallbackMapStats =
    Object.values(
      teamMatches.reduce(
        (accumulator, match) => {
          const mapScores =
            Array.isArray(
              match.mapScores
            )
              ? match.mapScores
              : [];

          mapScores.forEach((map) => {
            if (!map.map) {
              return;
            }

            if (
              !accumulator[
                map.map
              ]
            ) {
              accumulator[
                map.map
              ] = {
                name:
                  map.map,

                played:
                  0,

                wins:
                  0,
              };
            }

            accumulator[
              map.map
            ].played += 1;

            if (map.won) {
              accumulator[
                map.map
              ].wins += 1;
            }
          });

          return accumulator;
        },
        {}
      )
    )
      .map((map) => ({
        ...map,

        losses:
          map.played -
          map.wins,

        winrate:
          map.played > 0
            ? Math.round(
                (
                  map.wins /
                  map.played
                ) * 100
              )
            : 0,
      }))
      .sort(
        (
          first,
          second
        ) =>
          second.winrate -
            first.winrate ||
          second.played -
            first.played ||
          first.name.localeCompare(
            second.name
          )
      );

  const mapStats =
    Array.isArray(
      liveMapStats
    ) &&
    liveMapStats.length > 0
      ? liveMapStats
      : fallbackMapStats;

  const bestMap =
    mapStats.length > 0
      ? mapStats[0]
      : null;

  /*
   * Худшая карта имеет смысл только тогда,
   * когда сыграно хотя бы две разные карты.
   */
  const worstMap =
    mapStats.length > 1
      ? mapStats[
          mapStats.length - 1
        ]
      : null;

  const mapsPlayed =
    mapStats.reduce(
      (sum, map) =>
        sum +
        Number(
          map.played || 0
        ),
      0
    );

  if (!team) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b0f14] p-8 text-white">
        <div className="text-center">
          <h1 className="text-3xl font-black">
            Team not found
          </h1>

          <Link
            to="/"
            className="mt-4 inline-block text-orange-400 hover:text-orange-300"
          >
            ← Back Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0f14] p-8 text-white">
      <div className="mx-auto max-w-6xl">
        <Link
          to={`/team/${slug}`}
          className="text-orange-400 hover:text-orange-300"
        >
          ← Back to Team
        </Link>

        <h1 className="mb-8 mt-4 text-5xl font-black">
          {team.name} Stats
        </h1>

        {loading && (
          <div className="mb-5 text-sm text-gray-500">
            Loading automatic map
            statistics...
          </div>
        )}

        {error && (
          <div className="mb-5 text-sm text-yellow-400">
            {error}. Saved match data
            is shown.
          </div>
        )}

        <div className="mb-8 grid gap-4 md:grid-cols-3">

          {/* BEST MAP */}

          <div className="rounded-2xl border border-[#243041] bg-[#111823] p-5">
            <div className="mb-2 text-sm uppercase text-gray-500">
              Best Map
            </div>

            <div className="text-2xl font-black text-green-400">
              {bestMap?.name || "-"}
            </div>

            <div className="text-gray-400">
              {bestMap
                ? `${bestMap.winrate}% WR`
                : "No data"}
            </div>
          </div>

          {/* WORST MAP */}

          <div className="rounded-2xl border border-[#243041] bg-[#111823] p-5">
            <div className="mb-2 text-sm uppercase text-gray-500">
              Worst Map
            </div>

            <div className="text-2xl font-black text-red-400">
              {worstMap?.name || "-"}
            </div>

            <div className="text-gray-400">
              {worstMap
                ? `${worstMap.winrate}% WR`
                : mapStats.length === 1
                  ? "Not enough maps"
                  : "No data"}
            </div>
          </div>

          {/* MAPS PLAYED */}

          <div className="rounded-2xl border border-[#243041] bg-[#111823] p-5">
            <div className="mb-2 text-sm uppercase text-gray-500">
              Maps Played
            </div>

            <div className="text-2xl font-black text-orange-400">
              {mapsPlayed}
            </div>
          </div>
        </div>

        {mapStats.length > 0 ? (
          <div className="space-y-5">
            {mapStats.map(
              (map) => {
                const imageName =
                  String(
                    map.name || ""
                  ).toLowerCase();

                return (
                  <Link
                    key={map.name}
                    to={`/team/${slug}/matches?map=${encodeURIComponent(
                      map.name
                    )}`}
                    className="block overflow-hidden rounded-2xl border border-[#243041] bg-[#111823] transition-all hover:border-orange-500/40"
                  >
                    <div
                      className="relative h-28 bg-cover bg-center"
                      style={{
                        backgroundImage:
                          `url(/maps/${imageName}.png)`,
                      }}
                    >
                      <div className="absolute inset-0 bg-black/55" />

                      <div className="relative z-10 flex h-full items-center justify-between px-6">
                        <div>
                          <h2 className="text-3xl font-black">
                            {map.name}
                          </h2>

                          <div className="mt-1 text-sm text-gray-300">
                            {map.played}{" "}
                            {map.played === 1
                              ? "map played"
                              : "maps played"}
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
                      <div className="mb-3 flex items-center justify-between">
                        <div className="flex gap-6">
                          <div>
                            <div className="text-xs uppercase text-gray-500">
                              Wins
                            </div>

                            <div className="text-xl font-black text-green-400">
                              {map.wins}
                            </div>
                          </div>

                          <div>
                            <div className="text-xs uppercase text-gray-500">
                              Losses
                            </div>

                            <div className="text-xl font-black text-red-400">
                              {map.losses}
                            </div>
                          </div>
                        </div>

                        <div className="text-gray-400">
                          {map.wins}-
                          {map.losses}
                        </div>
                      </div>

                      <div className="h-3 overflow-hidden rounded-full bg-[#0b0f14]">
                        <div
                          className="h-full rounded-full bg-orange-500"
                          style={{
                            width:
                              `${map.winrate}%`,
                          }}
                        />
                      </div>
                    </div>
                  </Link>
                );
              }
            )}
          </div>
        ) : (
          !loading && (
            <div className="rounded-2xl border border-[#243041] bg-[#111823] p-8 text-center text-gray-500">
              No played maps found
            </div>
          )
        )}
      </div>
    </div>
  );
}

export default StatsPage;