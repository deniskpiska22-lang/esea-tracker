import { Link } from "react-router-dom";
import TeamLogo from "./TeamLogo";

function RatingChange({ value }) {
  const change = Number(value) || 0;

  if (change === 0) {
    return <span className="text-slate-500">0</span>;
  }

  return (
    <span className={change > 0 ? "text-emerald-400" : "text-rose-400"}>
      {change > 0 ? `+${change}` : change}
    </span>
  );
}

function TeamHero({
  team,
  countryName,
  flagUrl,
  division,
  rating,
  ratingLoading,
  ratingChange,
  worldRank,
  recentMatches,
  getMatchResult,
}) {
  return (
    <section className="relative overflow-hidden rounded-[28px] border border-white/[0.07] bg-[#101722] shadow-[0_30px_90px_rgba(0,0,0,0.35)]">
      <div className="pointer-events-none absolute -left-28 -top-28 h-80 w-80 rounded-full bg-orange-500/10 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-0 h-64 w-64 rounded-full bg-sky-500/[0.06] blur-3xl" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-orange-400/80 to-transparent" />

      <div className="relative p-6 md:p-9">
        <div className="grid gap-7 xl:grid-cols-[1fr_330px]">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <div className="flex h-36 w-36 shrink-0 items-center justify-center rounded-3xl border border-white/10 bg-[#090d13] p-5 shadow-inner">
              <TeamLogo
                src={team.logo}
                name={team.name}
                className="h-full w-full"
              />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2.5">
                {flagUrl ? (
                  <img
                    src={flagUrl}
                    alt={countryName}
                    className="h-[18px] w-6 rounded-sm object-cover"
                  />
                ) : (
                  <div className="h-[18px] w-6 rounded-sm border border-white/10 bg-white/[0.04]" />
                )}

                <span className="text-sm font-medium text-slate-400">
                  {countryName}
                </span>

                <span className="text-slate-700">•</span>

                <span className="rounded-lg border border-orange-500/20 bg-orange-500/10 px-2.5 py-1 text-xs font-black uppercase tracking-wide text-orange-400">
                  {division}
                </span>
              </div>

              <h1 className="mt-3 truncate text-4xl font-black tracking-tight text-white sm:text-5xl md:text-6xl">
                {team.name}
              </h1>

              <div className="mt-5 flex flex-wrap items-end gap-6">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-600">
                    Current rating
                  </div>

                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-3xl font-black text-orange-400">
                      {ratingLoading ? "..." : rating}
                    </span>

                    <span className="text-sm font-black">
                      <RatingChange value={ratingChange} />
                    </span>
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-600">
                    Last 5
                  </div>

                  <div className="mt-2 flex gap-2">
                    {recentMatches.length ? (
                      recentMatches.map((match, index) => {
                        const result = getMatchResult(match);

                        return (
                          <div
                            key={match?.id ?? index}
                            className={`flex h-9 w-9 items-center justify-center rounded-lg border text-sm font-black ${
                              result === "WIN"
                                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                                : "border-rose-500/30 bg-rose-500/10 text-rose-400"
                            }`}
                          >
                            {result === "WIN" ? "W" : "L"}
                          </div>
                        );
                      })
                    ) : (
                      <span className="text-sm text-slate-600">No matches</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <aside className="rounded-2xl border border-white/[0.06] bg-[#0a0f16]/80 p-5">
            <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-600">
              World ranking
            </div>

            <div className="mt-2 flex items-end justify-between gap-4">
              <div className="text-5xl font-black tracking-tight text-white">
                {worldRank ? `#${worldRank}` : "—"}
              </div>

              <Link
                to="/rankings"
                className="text-sm font-bold text-orange-400 transition hover:text-orange-300"
              >
                Rankings →
              </Link>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-4">
                <div className="text-xs text-slate-600">Rating</div>
                <div className="mt-1 text-2xl font-black text-white">
                  {ratingLoading ? "..." : rating}
                </div>
              </div>

              <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-4">
                <div className="text-xs text-slate-600">Change</div>
                <div className="mt-1 text-2xl font-black">
                  <RatingChange value={ratingChange} />
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}

export default TeamHero;
