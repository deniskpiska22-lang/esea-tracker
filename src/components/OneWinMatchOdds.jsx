import { useEffect, useState } from 'react';
import { useLanguage } from '../context/LanguageContext.jsx';
import AdGeoGate from './AdGeoGate.jsx';

const copy = {
  ru: { ad: 'Реклама', winner: 'Победитель матча', updated: 'Обновлено', open: 'Открыть матч в 1win', note: 'Коэффициенты могут измениться на 1win.' },
  en: { ad: 'Advertisement', winner: 'Match winner', updated: 'Updated', open: 'Open match on 1win', note: 'Odds may change on 1win.' },
  de: { ad: 'Werbung', winner: 'Spielsieger', updated: 'Aktualisiert', open: 'Spiel bei 1win öffnen', note: 'Die Quoten bei 1win können sich ändern.' },
  pt: { ad: 'Publicidade', winner: 'Vencedor da partida', updated: 'Atualizado', open: 'Abrir partida na 1win', note: 'As odds podem mudar na 1win.' },
  es: { ad: 'Publicidad', winner: 'Ganador del partido', updated: 'Actualizado', open: 'Abrir partido en 1win', note: 'Las cuotas pueden cambiar en 1win.' },
  fr: { ad: 'Publicité', winner: 'Vainqueur du match', updated: 'Mis à jour', open: 'Ouvrir le match sur 1win', note: 'Les cotes peuvent changer sur 1win.' },
  it: { ad: 'Pubblicità', winner: 'Vincitore della partita', updated: 'Aggiornato', open: 'Apri la partita su 1win', note: 'Le quote possono cambiare su 1win.' },
};

function OddsContent({ matchId }) {
  const { language, locale } = useLanguage();
  const labels = copy[language] || copy.en;
  const [result, setResult] = useState(null);
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
        if (valid) expiry = setTimeout(() => setResult(null), remaining);
      } catch {
        if (!stopped && current === generation) setResult(null);
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
  if (!odds) return null;
  const updated = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(odds.updatedAt));
  return (
    <aside aria-label={`${labels.ad} · 1win · 18+`} className="mt-6 overflow-hidden rounded-2xl border border-sky-400/20 bg-gradient-to-br from-[#111e2c] to-[#101722]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 px-5 py-3">
        <div className="flex items-center gap-3"><span className="text-xl font-black italic tracking-tight text-white">1win</span><span className="text-xs text-slate-400">{labels.ad} · 18+</span></div>
        <span className="text-xs text-slate-400">{labels.updated} <time dateTime={odds.updatedAt}>{updated}</time></span>
      </div>
      <div className="p-5">
        <p className="mb-3 text-sm font-semibold text-slate-300">{labels.winner}</p>
        <div className="grid grid-cols-2 gap-3">
          {[odds.team1, odds.team2].map((team, index) => (
            <a key={index} href={odds.href} target="_blank" rel="sponsored nofollow noopener noreferrer" aria-label={`${team.name}: ${team.price.toFixed(2)} · 1win`}
              className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-xl border border-sky-300/15 bg-white/[0.04] px-4 py-3 transition hover:border-sky-300/50 hover:bg-sky-400/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300">
              <span className="min-w-0 break-words text-sm font-bold text-slate-100">{team.name}</span><span className="text-xl font-black tabular-nums text-sky-300">{team.price.toFixed(2)}</span>
            </a>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-500">{labels.note}</p>
          <a href={odds.href} target="_blank" rel="sponsored nofollow noopener noreferrer" className="rounded-lg bg-sky-400 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-sky-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300">{labels.open} ↗</a>
        </div>
      </div>
    </aside>
  );
}

export default function OneWinMatchOdds({ matchId }) {
  return <AdGeoGate><OddsContent key={matchId} matchId={matchId} /></AdGeoGate>;
}
