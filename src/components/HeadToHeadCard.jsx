import { Link } from "react-router-dom";

import {
  buildHeadToHeadMapRows,
  countHeadToHeadMapWins,
} from "../utils/headToHead";
import { formatMapName } from "../utils/formatMapName";

function HeadToHeadRow({ row, team1, team2, stripe }) {
  return (
    <Link
      to={`/match/${row.matchId}`}
      className={`flex items-center justify-between gap-3 border-b border-[#1d2634] px-4 py-2.5 text-sm transition-colors last:border-b-0 hover:bg-[#151e2b] ${
        stripe ? "bg-white/[0.035]" : ""
      }`}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="hidden shrink-0 text-xs text-slate-500 sm:inline">
          {row.date}
        </span>
        <span
          className={`truncate font-semibold ${
            row.leftWon ? "text-white" : "text-slate-500"
          }`}
        >
          {team1.name}
        </span>
        <span className="shrink-0 text-xs text-slate-600">vs</span>
        <span
          className={`truncate font-semibold ${
            row.leftWon ? "text-slate-500" : "text-white"
          }`}
        >
          {team2.name}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        {row.mapName && (
          <span className="hidden text-xs font-bold uppercase tracking-wide text-orange-400 sm:inline">
            {formatMapName(row.mapName)}
          </span>
        )}
        {row.overtime && (
          <span className="hidden rounded border border-[#2a3546] px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-400 sm:inline">
            OT
          </span>
        )}
        <span className="font-black">
          <span
            className={
              row.leftWon ? "text-emerald-400" : "text-rose-400"
            }
          >
            {row.leftScore}
          </span>
          <span className="text-slate-600"> : </span>
          <span
            className={
              row.leftWon ? "text-rose-400" : "text-emerald-400"
            }
          >
            {row.rightScore}
          </span>
        </span>
      </div>
    </Link>
  );
}

export default function HeadToHeadCard({
  matches,
  team1,
  team2,
  leftTeamSlug,
}) {
  const { leftWins, rightWins } = countHeadToHeadMapWins(
    matches,
    leftTeamSlug
  );

  const rows = buildHeadToHeadMapRows(matches, leftTeamSlug);
  const overtimeCount = rows.filter((row) => row.overtime).length;

  return (
    <div className="mt-8">
      <h2 className="mb-4 text-2xl font-black tracking-tight">
        Head to Head
      </h2>

      <div className="overflow-hidden rounded-[24px] border border-[#263244] bg-[#101722]">
        <div className="grid grid-cols-3 items-center border-b border-[#243041] p-6 text-center">
          <div className="flex flex-col items-center">
            {team1.logo && (
              <img
                src={team1.logo}
                alt={team1.name}
                className="mb-2 h-12 w-12 object-contain"
              />
            )}

            <div className="text-lg text-gray-400">{team1.name}</div>

            <div className="text-5xl font-black text-green-400">
              {leftWins}
            </div>

            <div className="mt-1 text-xs uppercase tracking-wider text-slate-500">
              Wins
            </div>
          </div>

          <div>
            <div className="text-5xl font-black text-slate-300">
              {overtimeCount}
            </div>

            <div className="mt-1 text-xs uppercase tracking-wider text-slate-500">
              Overtimes
            </div>
          </div>

          <div className="flex flex-col items-center">
            {team2.logo && (
              <img
                src={team2.logo}
                alt={team2.name}
                className="mb-2 h-12 w-12 object-contain"
              />
            )}

            <div className="text-lg text-gray-400">{team2.name}</div>

            <div className="text-5xl font-black text-red-400">
              {rightWins}
            </div>

            <div className="mt-1 text-xs uppercase tracking-wider text-slate-500">
              Wins
            </div>
          </div>
        </div>

        {rows.map((row) => (
          <HeadToHeadRow
            key={row.key}
            row={row}
            team1={team1}
            team2={team2}
            stripe={row.stripe}
          />
        ))}
      </div>
    </div>
  );
}
