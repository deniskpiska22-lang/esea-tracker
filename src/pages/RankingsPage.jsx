import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import teams from "../data/teams";
import rankingSnapshot from "../data/rankingSnapshot.json";

const DIVISIONS = [
  "All",
  "Advanced",
  "Main",
  "Intermediate",
  "Entry",
];

function ChangeText({ value }) {
  const change = Number(value) || 0;

  if (change === 0) {
    return null;
  }

  return (
    <span
      className={`ml-2 text-xs font-bold ${
        change > 0 ? "text-green-400" : "text-red-400"
      }`}
    >
      {change > 0 ? `+${change}` : change}
    </span>
  );
}

function RankingsPage() {
  const [selectedDivision, setSelectedDivision] = useState("All");

  const snapshotBySlug = useMemo(() => {
    const snapshot = Array.isArray(rankingSnapshot)
      ? rankingSnapshot
      : [];

    return Object.fromEntries(
      snapshot.map((team) => [team.slug, team])
    );
  }, []);

  const sortedTeams = useMemo(() => {
    return [...teams]
      .filter((team) =>
        Number.isFinite(Number(team.points))
      )
      .sort((first, second) => {
        const pointsDifference =
          Number(second.points) - Number(first.points);

        if (pointsDifference !== 0) {
          return pointsDifference;
        }

        return String(first.name).localeCompare(
          String(second.name),
          "ru"
        );
      })
      .map((team, index) => {
        const snapshot = snapshotBySlug[team.slug];

        return {
          ...team,
          rank: index + 1,
          rankChange: Number(snapshot?.rankChange) || 0,
          pointsChange: Number(snapshot?.pointsChange) || 0,
        };
      });
  }, [snapshotBySlug]);

  const filteredTeams = useMemo(() => {
    if (selectedDivision === "All") {
      return sortedTeams;
    }

    return sortedTeams.filter(
      (team) => team.division === selectedDivision
    );
  }, [selectedDivision, sortedTeams]);

  return (
    <div className="min-h-screen bg-[#05070a] text-white">
      <div className="mx-auto max-w-7xl px-4 pt-6 md:px-8">
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">
              Team Rankings
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              ESEA team ranking by points
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {DIVISIONS.map((division) => (
            <button
              type="button"
              key={division}
              onClick={() =>
                setSelectedDivision(division)
              }
              className={`rounded-lg px-4 py-2 text-sm transition ${
                selectedDivision === division
                  ? "bg-orange-500 text-white"
                  : "border border-white/5 bg-[#0f131a] text-gray-300 hover:bg-[#121a25]"
              }`}
            >
              {division}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-7xl p-4 md:p-8">
        <div className="overflow-x-auto">
          <div className="min-w-[1000px]">
            <div className="grid grid-cols-[110px_2fr_170px_120px_140px] rounded-xl border border-white/5 bg-[#0f141a] p-4 text-sm font-semibold text-gray-400">
              <div>Rank</div>
              <div>Team</div>
              <div>Points</div>
              <div>Record</div>
              <div>Division</div>
            </div>

            <div className="mt-3 space-y-2">
              {filteredTeams.length === 0 ? (
                <div className="rounded-xl border border-white/5 bg-[#0c1016] p-8 text-center text-gray-500">
                  No teams added
                </div>
              ) : (
                filteredTeams.map((team) => (
                  <Link
                    key={team.slug}
                    to={`/teams/${team.slug}`}
                    className="group relative grid grid-cols-[110px_2fr_170px_120px_140px] items-center overflow-hidden rounded-xl border border-white/5 bg-[#0c1016] p-4 transition-all duration-300 hover:z-10 hover:-translate-y-[3px] hover:border-orange-500/20 hover:bg-[#121a25] hover:shadow-[0_18px_45px_rgba(0,0,0,0.75)]"
                  >
                    <div className="flex items-center font-bold text-orange-400">
                      <span>#{team.rank}</span>
                      <ChangeText value={team.rankChange} />
                    </div>

                    <div className="flex min-w-0 items-center gap-3">
                      {team.flag ? (
                        <img
                          src={team.flag}
                          alt=""
                          className="h-5 w-5 object-contain"
                        />
                      ) : (
                        <div className="h-5 w-5 rounded bg-white/5" />
                      )}

                      {team.logo ? (
                        <img
                          src={team.logo}
                          alt=""
                          className="h-9 w-9 object-contain"
                        />
                      ) : (
                        <div className="h-9 w-9 rounded-lg bg-white/5" />
                      )}

                      <span className="truncate font-semibold transition group-hover:text-orange-400">
                        {team.name}
                      </span>
                    </div>

                    <div className="flex items-center font-semibold">
                      <span>{team.points}</span>
                      <ChangeText value={team.pointsChange} />
                    </div>

                    <div className="text-gray-300">
                      {team.record ||
                        (team.stats
                          ? `${team.stats.wins ?? 0}-${team.stats.losses ?? 0}`
                          : "0-0")}
                    </div>

                    <div className="font-medium text-orange-400">
                      {team.division || "—"}
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RankingsPage;
