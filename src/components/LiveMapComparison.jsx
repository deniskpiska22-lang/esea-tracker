import { useMemo, useState } from 'react';
import { tx, tf } from '../i18n/translate.js';
import { normalizeMapKey } from '../utils/activeMapPool.js';
import { buildLiveMapComparison } from '../utils/liveMapComparison.js';

const COLORS = ['#fbbf24', '#38bdf8'];
const MODES = { win: 'Win %', pick: 'Pick %', ban: 'Ban %' };

function Radar({ rows, mode, leftTeam, rightTeam }) {
  const point = (index, value) => {
    const angle = -Math.PI / 2 + index * 2 * Math.PI / rows.length;
    return [180 + Math.cos(angle) * 115 * value / 100, 170 + Math.sin(angle) * 115 * value / 100];
  };
  const points = value => rows.map((_, index) => point(index, value).join(',')).join(' ');
  return (
    <svg viewBox="0 0 360 340" className="mx-auto w-full max-w-[400px]" role="img" aria-label={tf('Map comparison: {0} vs {1}', leftTeam.name, rightTeam.name)}>
      <title>{tx(MODES[mode])}</title>
      {[25, 50, 75, 100].map(value => <polygon key={value} points={points(value)} fill={value === 100 ? '#ffffff04' : 'none'} stroke="#334155" strokeWidth="1" />)}
      {rows.map((row, index) => {
        const edge = point(index, 100), label = point(index, 128);
        return <g key={row.name}>
          <line x1="180" y1="170" x2={edge[0]} y2={edge[1]} stroke="#334155" />
          <text x={label[0]} y={label[1]} fill="#cbd5e1" fontSize="13" fontWeight="600" textAnchor="middle" dominantBaseline="middle">{row.name}</text>
        </g>;
      })}
      {[0, 1].map(side => {
        const values = rows.map(row => row.records[side][mode]);
        const complete = values.every(value => value !== null);
        return <g key={side}>
          {complete && <polygon points={values.map((value, index) => point(index, value).join(',')).join(' ')} fill={COLORS[side]} fillOpacity="0.18" stroke={COLORS[side]} strokeWidth="2" />}
          {!complete && values.map((value, index) => {
            const next = (index + 1) % rows.length;
            if (value === null || values[next] === null) return null;
            const a = point(index, value), b = point(next, values[next]);
            return <line key={index} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={COLORS[side]} strokeWidth="2" />;
          })}
          {values.map((value, index) => value === null ? null : <circle key={index} cx={point(index, value)[0]} cy={point(index, value)[1]} r="3" fill={COLORS[side]}><title>{`${side === 0 ? leftTeam.name : rightTeam.name} · ${rows[index].name}: ${value}%`}</title></circle>)}
        </g>;
      })}
    </svg>
  );
}

function TeamLabel({ team, side }) {
  return <div className="flex min-w-0 items-center gap-2" style={{ color: COLORS[side] }}>
    {team.logo && <img src={team.logo} alt="" className="h-7 w-7 shrink-0 object-contain" />}
    <span className="truncate text-sm font-bold" title={team.name}>{team.name}</span>
  </div>;
}

export default function LiveMapComparison({ matchId, leftTeam, rightTeam, leftMatches, rightMatches, vetoSteps = [], loading = false, error = false }) {
  const [mode, setMode] = useState('win');
  const rows = useMemo(() => {
    const left = buildLiveMapComparison(leftMatches, { excludeMatchId: matchId });
    const right = buildLiveMapComparison(rightMatches, { excludeMatchId: matchId });
    return left.map((record, index) => ({ name: record.name, records: [record, right[index]] }));
  }, [leftMatches, rightMatches, matchId]);
  const hasValues = rows.some(row => row.records.some(record => record[mode] !== null));
  return <section className="overflow-hidden rounded-2xl border border-[#263244] bg-[#101722]">
    <header className="border-b border-[#243041] px-5 py-4">
      <h2 className="text-xl font-black">{tx('Map Statistics')}</h2>
      <p className="mt-1 text-sm text-slate-400">{tx('Team history · last 90 days · win rate from 3 maps')}</p>
    </header>
    <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="min-w-0 border-b border-[#243041] p-4 md:border-b-0 md:border-r">
        <div className="grid grid-cols-3 gap-1 rounded-lg bg-[#0b1119] p-1" role="group" aria-label={tx('Map comparison metric')}>
          {Object.entries(MODES).map(([key, label]) => <button key={key} type="button" aria-pressed={mode === key} onClick={() => setMode(key)} className={`rounded-md px-2 py-2 text-sm font-bold transition focus-visible:outline-2 focus-visible:outline-orange-400 ${mode === key ? 'bg-[#293649] text-white' : 'text-slate-400 hover:bg-[#1b2636] hover:text-white'}`}>{tx(label)}</button>)}
        </div>
        <Radar rows={rows} mode={mode} leftTeam={leftTeam} rightTeam={rightTeam} />
        <div className="flex flex-wrap justify-center gap-x-5 gap-y-2">
          {[leftTeam, rightTeam].map((team, side) => <div key={side} className="flex min-w-0 items-center gap-2 text-sm text-slate-300"><span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: COLORS[side] }} /><span className="max-w-[180px] truncate">{team.name}</span></div>)}
        </div>
        <p className="mt-3 text-center text-sm text-slate-400" role="status">{loading ? tx('Loading map statistics…') : !hasValues ? tx('Not enough tracked data for this metric.') : tx('Missing data is shown as —.')}</p>
        {error && <p className="mt-2 text-center text-sm text-amber-300">{tx('Live history unavailable. Saved data is shown.')}</p>}
      </div>
      <div className="min-w-0">
        <div className="grid grid-cols-[minmax(0,1fr)_90px_minmax(0,1fr)] items-center gap-2 border-b border-[#243041] px-3 py-4 sm:px-4">
          <TeamLabel team={leftTeam} side={0} /><span className="text-center text-sm text-slate-400">{tx('Map')}</span><TeamLabel team={rightTeam} side={1} />
        </div>
        {rows.map(row => {
          const actions = vetoSteps.filter(step => normalizeMapKey(step.map) === normalizeMapKey(row.name));
          const banned = actions.some(step => step.action === 'Banned');
          return <div key={row.name} className={`grid grid-cols-[minmax(0,1fr)_90px_minmax(0,1fr)] items-center gap-2 border-b border-[#243041] px-3 py-3 last:border-b-0 sm:px-4 ${banned ? 'bg-[#0c121b]' : 'bg-[#172131]'}`}>
            {row.records.map((record, side) => {
              const action = actions.find(step => step.selectedBy === (side === 0 ? 'faction1' : 'faction2') && ['Picked', 'Banned'].includes(step.action));
              const cell = <div className={`min-w-0 text-center ${banned ? 'opacity-60' : ''}`}>
                <div className="text-2xl font-black tabular-nums" style={{ color: COLORS[side] }}>{record[mode] === null ? '—' : `${record[mode]}%`}</div>
                <div className="text-xs text-slate-400">{mode === 'win' ? tf('{0} maps', record.played) : tf('{0} vetoes', record.vetoMatches)}</div>
                {action && <span className={`mt-1 inline-block rounded px-1.5 py-0.5 text-xs font-bold ${action.action === 'Picked' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-700 text-slate-300'}`}>{tx(action.action === 'Picked' ? 'Pick' : 'Ban')}</span>}
              </div>;
              return side === 0 ? <div key={side} className="contents">{cell}<div className="text-center"><div className="rounded-md border border-white/10 bg-cover bg-center py-2 text-sm font-black" style={{ backgroundImage: `linear-gradient(#0b1119a0, #0b1119a0), url(/maps/${normalizeMapKey(row.name)}.png)` }}>{row.name}</div>{actions.some(step => step.action === 'Decider') && <span className="mt-1 block text-xs text-amber-300">{tx('Decider')}</span>}</div></div> : <div key={side}>{cell}</div>;
            })}
          </div>;
        })}
      </div>
    </div>
  </section>;
}
