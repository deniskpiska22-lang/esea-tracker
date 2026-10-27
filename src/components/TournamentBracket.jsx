import { matchPublicPath } from '../utils/matchUrls.js';
import { useRef } from "react";
import {
  FiChevronLeft,
  FiChevronRight,
  FiAward,
  FiArrowRight,
} from "react-icons/fi";
import Link from "./SiteLink.jsx";
import { translateTournamentText, tx } from "../i18n/translate.js";
import { bracketLayout, bracketWinner } from "../utils/bracketLayout.js";

function TeamRow({ team, score, winner, finished }) {
  const tbd = !team?.name;
  return (
    <div
      className={`flex h-9 items-center gap-2.5 px-3 ${winner ? "bg-emerald-400/[.075]" : ""}`}
    >
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/[.035] text-[10px] font-bold text-slate-600">
        {team?.logo ? (
          <img
            src={team.logo}
            loading="lazy"
            alt=""
            className="h-5 w-5 object-contain"
          />
        ) : tbd ? (
          "?"
        ) : (
          team.name.slice(0, 2).toUpperCase()
        )}
      </span>
      <span
        title={team?.name || tx("TBD")}
        className={`min-w-0 flex-1 truncate text-xs font-bold ${tbd ? "text-slate-600" : winner ? "text-emerald-300" : finished ? "text-slate-500" : "text-slate-200"}`}
      >
        {team?.name || tx("TBD")}
      </span>
      {team?.tag && (
        <span className="max-w-10 truncate text-[9px] font-bold text-orange-400">
          {team.tag}
        </span>
      )}
      <span
        className={`flex h-6 min-w-6 shrink-0 items-center justify-center rounded-md font-mono text-xs font-black ${winner ? "bg-emerald-400/10 text-emerald-300" : "bg-black/20 text-slate-500"}`}
      >
        {score ?? "–"}
      </span>
    </div>
  );
}
export function BracketMatchBox({ match, final = false }) {
  const winner = bracketWinner(match);
  const content = (
    <div
      className={`w-full min-w-[220px] overflow-hidden rounded-xl border shadow-[0_8px_22px_rgba(0,0,0,.18)] transition group-hover:border-orange-400/50 ${final ? "border-orange-400/30 bg-[#151a21]" : "border-white/[.09] bg-[#111a27]"}`}
    >
      <div
        className={`flex h-6 items-center justify-between border-b border-white/[.05] px-3 text-[9px] font-bold uppercase tracking-widest ${final ? "text-orange-300/80" : "text-slate-600"}`}
      >
        <span>
          {final ? (
            <span className="flex items-center gap-1.5">
              <FiAward />
              {tx("Final")}
            </span>
          ) : winner ? (
            tx("Finished")
          ) : (
            tx("Match")
          )}
        </span>
        {match?.matchId && (
          <FiArrowRight className="text-slate-500 transition group-hover:text-orange-300" />
        )}
      </div>
      <div className="divide-y divide-white/[.045]">
        <TeamRow
          team={match?.team1}
          score={match?.score1}
          winner={winner === 1}
          finished={!!winner}
        />
        <TeamRow
          team={match?.team2}
          score={match?.score2}
          winner={winner === 2}
          finished={!!winner}
        />
      </div>
    </div>
  );
  return match?.matchId ? (
    <Link
      to={matchPublicPath(match)}
      className="group block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
      aria-label={`${match.team1?.name || tx("TBD")} — ${match.team2?.name || tx("TBD")}`}
    >
      {content}
    </Link>
  ) : (
    content
  );
}
export function Bracket({ rounds }) {
  const viewport = useRef(null);
  const selectedRound = useRef(0);
  const layout = bracketLayout(rounds);
  if (!layout.length) return null;
  const columnWidth = 240,
    gap = 48;
  function goToRound(index) {
    const target = viewport.current;
    if (!target) return;
    const next = Math.max(0, Math.min(layout.length - 1, index));
    selectedRound.current = next;
    target.scrollTo({
      left: next * (columnWidth + gap),
      top: Math.max(0, layout[next].centers[0] + 84 - target.clientHeight / 2),
      behavior: "smooth",
    });
  }
  return (
    <div className="overflow-hidden rounded-2xl border border-white/[.07] bg-[#080f18]">
      <div className="flex items-center gap-3 border-b border-white/[.06] bg-[#0e1621] px-4 py-3">
        <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto [scrollbar-width:thin]">
          {layout.map(({ round }, i) => (
            <button
              key={i}
              onClick={() => goToRound(i)}
              className="shrink-0 rounded-lg border border-white/[.07] px-3 py-1.5 text-[10px] font-bold text-slate-400 transition hover:border-orange-400/30 hover:text-orange-300"
            >
              {translateTournamentText(round.name || tx("Round"))}
            </button>
          ))}
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            aria-label={tx("Previous round")}
            onClick={() => goToRound(selectedRound.current - 1)}
            className="rounded-lg border border-white/10 p-2 text-slate-400 hover:text-orange-300"
          >
            <FiChevronLeft />
          </button>
          <button
            type="button"
            aria-label={tx("Next round")}
            onClick={() => goToRound(selectedRound.current + 1)}
            className="rounded-lg border border-white/10 p-2 text-slate-400 hover:text-orange-300"
          >
            <FiChevronRight />
          </button>
        </div>
      </div>
      <div
        ref={viewport}
        role="region"
        tabIndex={0}
        aria-label={tx("Tournament bracket")}
        className="max-h-[760px] overflow-auto p-5 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange-400 [scrollbar-width:thin] [scrollbar-color:#354052_#0b121c]"
      >
        <div className="flex w-max gap-12 pb-2">
          {layout.map(({ round, height, centers, edges }, roundIndex) => (
            <section
              key={roundIndex}
              className="relative shrink-0"
              style={{ width: columnWidth }}
              aria-label={translateTournamentText(round.name)}
            >
              <h3
                className={`sticky -top-5 z-10 mb-4 flex h-12 items-center justify-between rounded-xl border bg-[#101925]/95 px-4 text-[11px] font-black uppercase tracking-wider shadow-lg backdrop-blur ${roundIndex === layout.length - 1 ? "border-orange-400/25 text-orange-300" : "border-white/[.07] text-slate-400"}`}
              >
                <span>
                  {translateTournamentText(round.name || tx("Round"))}
                </span>
                <span className="text-[10px] tabular-nums text-slate-600">
                  {round.matches.length}
                </span>
              </h3>
              <div className="relative" style={{ height }}>
                {round.matches.map((match, i) => (
                  <div
                    key={match.matchId || i}
                    className="absolute inset-x-0"
                    style={{ top: centers[i], transform: "translateY(-50%)" }}
                  >
                    <BracketMatchBox
                      match={match}
                      final={
                        round.matches.length === 1 &&
                        roundIndex === layout.length - 1
                      }
                    />
                  </div>
                ))}
                {edges.length > 0 && (
                  <svg
                    aria-hidden="true"
                    className="pointer-events-none absolute left-full top-0 overflow-visible"
                    width={gap}
                    height={height}
                  >
                    <g
                      fill="none"
                      stroke="#334155"
                      strokeWidth="1.5"
                      strokeLinejoin="round"
                    >
                      {edges.map((edge, i) => (
                        <path
                          key={i}
                          d={`M 0 ${edge.from} H 24 V ${edge.to} H 48`}
                        />
                      ))}
                    </g>
                  </svg>
                )}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
