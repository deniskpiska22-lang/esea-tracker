import { useEffect, useState } from 'react';
import { useLanguage } from '../context/LanguageContext.jsx';
import { isAdProviderEnabled, loadAdPolicy } from '../lib/adPolicy.js';
import TeamNativeAd from './TeamNativeAd.jsx';
import OneWinMarketsAd from './OneWinMarketsAd.jsx';

const copy = {
  ru: { ad: 'Реклама', winner: 'Победитель матча', updated: 'Обновлено', open: 'Открыть матч в 1win', note: 'Коэффициенты могут измениться на 1win.' },
  en: { ad: 'Advertisement', winner: 'Match winner', updated: 'Updated', open: 'Open match on 1win', note: 'Odds may change on 1win.' },
  de: { ad: 'Werbung', winner: 'Spielsieger', updated: 'Aktualisiert', open: 'Spiel bei 1win öffnen', note: 'Die Quoten bei 1win können sich ändern.' },
  pt: { ad: 'Publicidade', winner: 'Vencedor da partida', updated: 'Atualizado', open: 'Abrir partida na 1win', note: 'As odds podem mudar na 1win.' },
  es: { ad: 'Publicidad', winner: 'Ganador del partido', updated: 'Actualizado', open: 'Abrir partido en 1win', note: 'Las cuotas pueden cambiar en 1win.' },
  fr: { ad: 'Publicité', winner: 'Vainqueur du match', updated: 'Mis à jour', open: 'Ouvrir le match sur 1win', note: 'Les cotes peuvent changer sur 1win.' },
  it: { ad: 'Pubblicità', winner: 'Vincitore della partita', updated: 'Aggiornato', open: 'Apri la partita su 1win', note: 'Le quote possono cambiare su 1win.' },
};

function OddsContent({ matchId, teams }) {
  const [result, setResult] = useState(null);
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    let stopped = false;
    let request;
    let poll;
    let expiry;
    let generation = 0;
    const refresh = async () => {
      if (stopped || document.hidden) return;
      const current = ++generation;
      request?.abort();
      request = new AbortController();
      const controller = request;
      const started = performance.now();
      const timeout = setTimeout(() => controller.abort(), 30_000);
      let nextPoll = 30_000;
      try {
        const response = await fetch(`/api/match-odds?matchId=${encodeURIComponent(matchId)}`, {
          cache: 'no-store', credentials: 'same-origin', signal: controller.signal,
        });
        const data = response.ok ? (await response.json()).odds : null;
        if (stopped || current !== generation) return;
        clearTimeout(expiry);
        const remaining = Number(data?.validForMs) - (performance.now() - started);
        const valid = data?.matchId === matchId && remaining > 0 && remaining <= 20_000;
        if (valid) nextPoll = 8000;
        setResult(valid ? { matchId, data } : null);
        setChecked(true);
        if (valid) expiry = setTimeout(() => setResult(null), remaining);
      } catch {
        if (!stopped && current === generation) {
          setResult(null);
          setChecked(true);
        }
      } finally {
        clearTimeout(timeout);
        if (!stopped && current === generation) poll = setTimeout(refresh, nextPoll);
      }
    };
    const onVisibility = () => {
      clearTimeout(poll);
      if (!document.hidden) refresh();
      else { generation += 1; request?.abort(); }
    };
    refresh();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stopped = true;
      request?.abort();
      clearTimeout(poll);
      clearTimeout(expiry);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [matchId]);
  const odds = result?.matchId === matchId ? result.data : null;
  if (!odds) return checked ? <OneWinMarketsAd /> : null;
  return <OddsCard odds={odds} teams={teams} />;
}

function TeamAvatar({ name, logo }) {
  const [failed, setFailed] = useState(false);
  const initials = String(name || '?').split(/\s+/).map(word => word[0]).join('').slice(0, 2).toUpperCase();
  return <span className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-[#0a121e] shadow-[inset_0_1px_0_#ffffff08,0_8px_24px_#00000030] sm:h-20 sm:w-20">
    {logo && !failed ? <img src={logo} alt="" decoding="async" className="h-full w-full object-contain p-2.5" onError={() => setFailed(true)} />
      : <span aria-hidden="true" className="text-xl font-black tracking-tight text-sky-200">{initials}</span>}
  </span>;
}

function ExternalArrow({ className = '' }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}><path d="M7 17 17 7M7 7h10v10" /></svg>;
}

function OddsCard({ odds, teams = [] }) {
  const { language, locale } = useLanguage();
  const labels = copy[language] || copy.en;
  const updated = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(odds.updatedAt));
  return (
    <aside data-match-odds={odds.matchId} aria-label={`${labels.ad} · 1win · 18+`} className="relative mt-6 overflow-hidden rounded-3xl border border-sky-300/20 bg-[#0e1723] shadow-[0_12px_40px_#00000025]">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,#38bdf814,transparent_65%)]" />
      <div className="relative flex flex-wrap items-center justify-between gap-x-4 gap-y-3 px-5 pb-4 pt-5 sm:px-6">
        <div className="flex items-center gap-3.5">
          <span className="flex h-12 w-16 shrink-0 items-center justify-center rounded-xl border border-sky-300/20 bg-sky-400/10 text-2xl font-black italic tracking-tighter text-white">1win</span>
          <div><h2 className="text-base font-bold text-white sm:text-lg">{labels.winner}</h2><p className="mt-1 text-[11px] font-medium text-slate-400">{labels.ad} · 18+</p></div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="flex items-center gap-1.5 text-[11px] text-slate-400"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true" className="h-3.5 w-3.5"><circle cx="8" cy="8" r="6" /><path d="M8 4.5V8l2.5 1.5" /></svg><span>{labels.updated} <time dateTime={odds.updatedAt}>{updated}</time></span></span>
        </div>
      </div>
      <div className="relative px-5 pb-5 sm:px-6 sm:pb-6">
        <div className="relative grid gap-3 sm:grid-cols-2 sm:gap-6">
          {[odds.team1, odds.team2].map((team, index) => (
            <a key={index} href={odds.href} target="_blank" rel="sponsored nofollow noopener noreferrer" aria-label={`${team.name}: ${team.price.toFixed(2)} · 1win`}
              className="group relative flex min-w-0 items-center gap-4 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.055] to-white/[0.015] p-4 transition duration-200 hover:border-sky-300/45 hover:bg-sky-400/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300 sm:p-5">
              <TeamAvatar key={teams[index]?.logo || team.name} name={team.name} logo={teams[index]?.logo} />
              <span className="min-w-0 flex-1"><span className="block break-words text-sm font-bold leading-snug text-slate-200 sm:text-base">{team.name}</span><span className="mt-1.5 block text-4xl font-black leading-none tracking-tight text-sky-200 tabular-nums transition group-hover:text-white sm:text-[42px]">{team.price.toFixed(2)}</span></span>
              <ExternalArrow className="h-5 w-5 shrink-0 text-slate-600 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-sky-300" />
              <span aria-hidden="true" className="absolute inset-x-6 bottom-0 h-px bg-gradient-to-r from-transparent via-sky-300/30 to-transparent" />
            </a>
          ))}
          <span aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 hidden h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-[#0e1723] text-[9px] font-black tracking-wider text-slate-400 sm:flex">VS</span>
        </div>
      </div>
      <div className="relative flex flex-col gap-4 border-t border-white/[0.06] bg-black/15 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="max-w-lg text-[11px] leading-relaxed text-slate-400">{labels.note}</p>
        <a href={odds.href} target="_blank" rel="sponsored nofollow noopener noreferrer" className="group inline-flex min-h-11 shrink-0 items-center justify-center gap-3 rounded-xl border border-sky-200/30 bg-gradient-to-br from-sky-300 to-sky-400 px-5 py-3 text-sm font-bold text-[#052437] shadow-[0_4px_18px_#38bdf81a] transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300">{labels.open}<ExternalArrow className="h-4 w-4 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></a>
      </div>
    </aside>
  );
}

export default function OneWinMatchOdds({ matchId, teams, active = true }) {
  const [policy, setPolicy] = useState(null);
  useEffect(() => {
    let mounted = true;
    loadAdPolicy().then(result => { if (mounted) setPolicy(result); });
    return () => { mounted = false; };
  }, []);
  if (isAdProviderEnabled(policy, 'onewin')) {
    return active ? <OddsContent key={matchId} matchId={matchId} teams={teams} />
      : <OneWinMarketsAd />;
  }
  if (isAdProviderEnabled(policy, 'pari')) return <TeamNativeAd placement="match_room_native" />;
  return null;
}
