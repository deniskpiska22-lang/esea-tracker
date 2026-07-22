import { useMemo } from "react";
import teams from "../data/teams";

function groupCount(items, keyGetter) {
  const counts = new Map();
  for (const item of items) {
    const key = keyGetter(item) || "Unknown";
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

export default function DataStatusPage() {
  const stats = useMemo(() => {
    const generated = teams.filter((team) => team.generated);
    const withMatches = teams.filter((team) => Number(team?.standings?.matches ?? 0) > 0);
    const zeroMatches = teams.length - withMatches.length;

    return {
      total: teams.length,
      generated: generated.length,
      withMatches: withMatches.length,
      zeroMatches,
      divisions: groupCount(teams, (team) => team.division),
      regions: groupCount(teams, (team) => team.sources?.[0]?.region),
      conferences: groupCount(
        teams,
        (team) => `${team.sources?.[0]?.region || "Unknown"} · ${team.division || "Unknown"} · ${team.conference || "—"}`
      ),
    };
  }, []);

  const cards = [
    ["All registered teams", stats.total],
    ["Generated automatically", stats.generated],
    ["Already played", stats.withMatches],
    ["Zero matches", stats.zeroMatches],
  ];

  return (
    <main className="mx-auto max-w-[1280px] px-4 py-8 md:px-6">
      <div className="mb-8">
        <div className="mb-2 inline-flex rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-amber-300">
          Test data monitor
        </div>
        <h1 className="text-3xl font-black tracking-tight">Season import status</h1>
        <p className="mt-2 max-w-3xl text-gray-400">
          This page reads the same generated team file as the rest of the website. After
          <code className="mx-1 rounded bg-white/5 px-1.5 py-0.5 text-gray-200">npm run v2:sync</code>
          the counters below change immediately in local development.
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(([label, value]) => (
          <article key={label} className="rounded-2xl border border-white/[0.07] bg-white/[0.035] p-5">
            <p className="text-sm font-bold text-gray-500">{label}</p>
            <p className="mt-2 text-3xl font-black text-white">{value}</p>
          </article>
        ))}
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <StatusTable title="By region" rows={stats.regions} />
        <StatusTable title="By division" rows={stats.divisions} />
      </section>

      <section className="mt-6">
        <StatusTable title="By region, division and conference" rows={stats.conferences} />
      </section>
    </main>
  );
}

function StatusTable({ title, rows }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.025]">
      <div className="border-b border-white/[0.07] px-5 py-4">
        <h2 className="font-black">{title}</h2>
      </div>
      <div className="divide-y divide-white/[0.06]">
        {rows.map(([label, count]) => (
          <div key={label} className="flex items-center justify-between gap-4 px-5 py-3">
            <span className="text-sm font-semibold text-gray-300">{label}</span>
            <span className="rounded-lg bg-white/[0.06] px-2.5 py-1 text-sm font-black text-white">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
