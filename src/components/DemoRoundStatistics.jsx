import { tx, tf } from '../i18n/translate.js';

function Metric({ label, value, color }) {
  return <div className="rounded-xl border border-white/[0.07] bg-[#0b121c] px-4 py-4">
    <h3 className="text-xs font-bold text-slate-400">{tx(label)}</h3>
    <p className={`mt-3 text-3xl font-black tabular-nums ${color}`}>{value.rate === null ? '—' : `${value.rate.toFixed(1)}%`}</p>
    <p className="mt-2 text-xs tabular-nums text-slate-500">{tf('Won: {0} / {1}', value.won, value.total)}</p>
  </div>;
}

export default function DemoRoundStatistics({ stats }) {
  return <section className="overflow-hidden rounded-2xl border border-[#263244] bg-[#101722]" aria-label={tx('Verified demo statistics')}>
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] px-5 py-4">
      <h2 className="text-sm font-black text-slate-200">{tx('Verified demo statistics')}</h2>
      <span className="rounded-full border border-sky-400/15 bg-sky-400/5 px-3 py-1 text-xs font-bold tabular-nums text-sky-300">{stats.covered} / {stats.eligible} {tx('Maps')}</span>
    </header>
    <div className="space-y-4 p-4 sm:p-5">
      <p className="text-xs leading-5 text-slate-400">{tf('Processed demos: {0} of {1} played maps.', stats.covered, stats.eligible)}</p>
      {!stats.covered && <p className="rounded-xl border border-amber-400/15 bg-amber-400/5 px-4 py-3 text-sm text-amber-200">{tx('No verified demo statistics yet.')}</p>}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Metric label="CT rounds" value={stats.ct} color="text-sky-300" />
        <Metric label="T rounds" value={stats.t} color="text-amber-300" />
        <Metric label="Pistol rounds" value={stats.pistol} color="text-emerald-300" />
        <Metric label="CT pistols" value={stats.ctPistol} color="text-sky-300" />
        <Metric label="T pistols" value={stats.tPistol} color="text-amber-300" />
        <Metric label="Overtime rounds" value={stats.overtime} color="text-violet-300" />
      </div>
      <p className="text-xs leading-5 text-slate-500">{tx('CT/T rates include overtime. Pistols are the opening rounds of the two regulation halves.')}</p>
      <details className="rounded-xl border border-white/[0.07] px-4 py-3">
        <summary className="cursor-pointer text-xs font-bold text-slate-300">{tx('Regulation halves won')}</summary>
        <p className="mt-3 text-lg font-black tabular-nums text-slate-100">{stats.halves.rate === null ? '—' : `${stats.halves.rate.toFixed(1)}%`} <span className="ml-2 text-xs font-normal text-slate-400">{tf('{0} wins, {1} draws in {2} halves', stats.halves.won, stats.halves.draws, stats.halves.total)}</span></p>
        <p className="mt-2 text-xs leading-5 text-slate-500">{tx('Halves are compared by rounds won; the final half can be shortened. Overtime is excluded.')}</p>
      </details>
    </div>
  </section>;
}
