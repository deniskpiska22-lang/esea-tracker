import {
  Link,
  useParams,
} from "react-router-dom";

import teams from "../data/teams";
import matchesData from "../data/matches";
import { useTeamStats } from "../hooks/useTeamStats";

const UPCOMING_FEATURES = [
  {
    title: "Site preference",
    description:
      "How often the team hits A vs B, broken down by pistol/eco/force-buy rounds.",
  },
  {
    title: "Retake tendencies",
    description:
      "Retake win rate, how many players commit, and how fast.",
  },
  {
    title: "Economy patterns",
    description:
      "Typical eco/force/full-buy decisions based on the previous round's score.",
  },
  {
    title: "AI scouting summary",
    description:
      "A written pre-match rundown of an opponent's tendencies, generated from the stats above.",
  },
];

function AnalyticsPage() {
  const { slug } = useParams();

  const team =
    teams.find((item) => item.slug === slug) || null;

  const fallbackMatches = matchesData.filter(
    (match) => match.teamSlug === slug
  );

  const { matches, loading } = useTeamStats(
    slug,
    fallbackMatches
  );

  const finishedMatches = matches.length;
  const analyzableMatches = matches.filter(
    (match) => match.demoSynced
  ).length;

  const coveragePercent =
    finishedMatches > 0
      ? Math.round(
          (analyzableMatches / finishedMatches) * 100
        )
      : 0;

  if (!team) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#080d13] p-8 text-white">
        <div className="text-center">
          <h1 className="text-3xl font-black">Team not found</h1>
          <Link
            to="/"
            className="mt-4 inline-block text-orange-400 transition hover:text-orange-300"
          >
            ← Back Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#080d13] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1400px]">
        <Link
          to={`/team/${slug}`}
          className="text-sm font-bold text-orange-400 transition hover:text-orange-300"
        >
          ← Back to Team
        </Link>

        <div className="mb-7 mt-3">
          <div className="text-xs font-black uppercase tracking-[0.2em] text-orange-400">
            Demo-powered scouting
          </div>
          <h1 className="mt-1 text-3xl font-black sm:text-4xl">
            {team.name} Analytics
          </h1>
        </div>

        <section className="rounded-3xl border border-[#202c3a] bg-[#111923] p-6 sm:p-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/25 bg-orange-500/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-orange-300">
            In progress
          </div>

          <h2 className="mt-4 text-2xl font-black">
            Gameplay pattern analysis is coming soon
          </h2>

          <p className="mt-3 max-w-2xl text-sm text-[#8ca2c2]">
            We're building an automatic pipeline that parses this team's
            match demos to surface tactical tendencies — then uses AI to turn
            those numbers into a readable pre-match scouting report.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {UPCOMING_FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="rounded-2xl border border-[#202c3a] bg-[#151e29] p-4"
              >
                <div className="text-sm font-black text-slate-100">
                  {feature.title}
                </div>
                <div className="mt-2 text-xs text-[#6e87ad]">
                  {feature.description}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-[#202c3a] bg-[#111923] p-6 sm:p-8">
          <div className="text-xs font-black uppercase tracking-[0.18em] text-orange-400">
            Data readiness
          </div>
          <h2 className="mt-1 text-xl font-black">
            Demo coverage for this team
          </h2>

          {loading ? (
            <div className="mt-4 text-sm text-slate-500">
              Loading demo coverage...
            </div>
          ) : (
            <>
              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-[#202c3a] bg-[#151e29] p-5">
                  <div className="text-xs font-black uppercase tracking-[0.16em] text-[#587094]">
                    Finished matches
                  </div>
                  <div className="mt-3 text-3xl font-black">
                    {finishedMatches}
                  </div>
                </div>

                <div className="rounded-2xl border border-[#202c3a] bg-[#151e29] p-5">
                  <div className="text-xs font-black uppercase tracking-[0.16em] text-[#587094]">
                    Demos ready to analyze
                  </div>
                  <div className="mt-3 text-3xl font-black text-orange-400">
                    {analyzableMatches}
                  </div>
                </div>

                <div className="rounded-2xl border border-[#202c3a] bg-[#151e29] p-5">
                  <div className="text-xs font-black uppercase tracking-[0.16em] text-[#587094]">
                    Coverage
                  </div>
                  <div className="mt-3 text-3xl font-black">
                    {coveragePercent}%
                  </div>
                </div>
              </div>

              <div className="mt-5 h-2 overflow-hidden rounded-full bg-[#080d13]">
                <div
                  className="h-full rounded-full bg-orange-500 transition-all duration-500"
                  style={{ width: `${coveragePercent}%` }}
                />
              </div>

              <p className="mt-4 text-xs text-[#587094]">
                Demos are collected automatically as new matches finish.
                Older matches aren't backfilled — only recent matches have a
                real chance of being found on FACEIT's side.
              </p>
            </>
          )}
        </section>
      </div>
    </main>
  );
}

export default AnalyticsPage;
