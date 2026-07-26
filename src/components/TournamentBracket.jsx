import { Link } from "react-router-dom";

function TeamRow({ team, score, winner }) {
  const isTbd = !team?.name;

  return (
    <div
      className={`flex items-center justify-between gap-2 border-b border-[#1d2634] px-2.5 py-1.5 last:border-b-0 ${
        winner ? "bg-emerald-500/[0.06]" : ""
      }`}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        {isTbd ? (
          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm bg-[#1d2634] text-[9px] text-slate-600">
            ?
          </span>
        ) : team.logo ? (
          <img
            src={team.logo}
            alt=""
            className="h-4 w-4 shrink-0 rounded-sm object-contain"
          />
        ) : (
          <span className="h-4 w-4 shrink-0 rounded-sm bg-[#1d2634]" />
        )}

        <span
          className={`truncate text-xs font-bold ${
            isTbd
              ? "text-slate-600"
              : winner
                ? "text-emerald-400"
                : "text-slate-300"
          }`}
        >
          {team?.name || "TBD"}
        </span>

        {team?.tag && (
          <span className="shrink-0 rounded bg-orange-500/15 px-1 text-[9px] font-black uppercase text-orange-400">
            {team.tag}
          </span>
        )}
      </div>

      <span
        className={`shrink-0 text-xs font-black ${
          winner ? "text-emerald-400" : "text-slate-500"
        }`}
      >
        {score ?? ""}
      </span>
    </div>
  );
}

export function BracketMatchBox({ match }) {
  const content = (
    <div className="w-full min-w-[190px] overflow-hidden rounded-lg border border-[#263244] bg-[#101722] transition hover:border-orange-500/30">
      <TeamRow
        team={match?.team1}
        score={match?.score1}
        winner={match?.winner === 1}
      />
      <TeamRow
        team={match?.team2}
        score={match?.score2}
        winner={match?.winner === 2}
      />
    </div>
  );

  if (match?.matchId) {
    return <Link to={`/match/${match.matchId}`}>{content}</Link>;
  }

  return content;
}

export function Bracket({ rounds }) {
  const list = Array.isArray(rounds) ? rounds : [];

  if (list.length === 0) {
    return null;
  }

  return (
    <div className="flex gap-8 overflow-x-auto pb-3 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.14)_transparent] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb:hover]:bg-white/20 [&::-webkit-scrollbar-track]:bg-transparent">
      {list.map((round, roundIndex) => (
        <div key={round.name || roundIndex} className="flex shrink-0 flex-col">
          <div className="mb-3 text-center text-xs font-black uppercase tracking-wide text-slate-500">
            {round.name}
          </div>

          <div className="flex flex-1 flex-col justify-around gap-4">
            {(round.matches || []).map((match, matchIndex) => (
              <div key={matchIndex} className="relative">
                <BracketMatchBox match={match} />

                {roundIndex < list.length - 1 && (
                  <div className="absolute left-full top-1/2 h-px w-8 bg-[#263244]" />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
