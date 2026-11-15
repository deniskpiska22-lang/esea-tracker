import { useEffect, useState } from 'react';
import { useLanguage } from '../context/LanguageContext.jsx';
import { formatOddsDateTime } from '../utils/userTime.js';

const titles = {
  ru: 'Ближайшие матчи CS2', en: 'Upcoming CS2 matches', de: 'Anstehende CS2-Spiele',
  pt: 'Próximas partidas de CS2', es: 'Próximos partidos de CS2',
  fr: 'Prochains matchs CS2', it: 'Prossime partite di CS2',
};

const winner = {
  ru: 'Победитель матча', en: 'Match winner', de: 'Spielsieger',
  pt: 'Vencedor da partida', es: 'Ganador del partido',
  fr: 'Vainqueur du match', it: 'Vincitore della partita',
};

export default function OneWinFeaturedOdds({ matchId, provider = "onewin" }) {
  const { language, locale } = useLanguage();
  const [events, setEvents] = useState([]);
  const pari = provider === 'pari';
  const action = pari ? 'pari-featured' : 'featured';
  const maxAge = pari ? 60_000 : 20_000;
  const refreshEvery = pari ? 45_000 : 8000;
  useEffect(() => {
    if (!matchId) return;
    let stopped = false;
    let controller;
    let poll;
    let expiry;
    const refresh = async () => {
      if (stopped || document.hidden) return;
      controller?.abort();
      const request = new AbortController();
      controller = request;
      const start = performance.now();
      const timeout = setTimeout(() => request.abort(), 22_000);
      let next = 45_000;
      try {
        const res = await fetch(`/api/match-odds?action=${action}&matchId=${encodeURIComponent(matchId)}`, {
          cache: 'no-store', signal: request.signal,
        });
        const data = res.ok ? (await res.json()).featured : null;
        if (stopped || controller !== request || request.signal.aborted) return;
        const elapsed = performance.now() - start;
        const current = (Array.isArray(data) ? data : []).filter(event =>
          event.validForMs > elapsed && event.validForMs <= maxAge);
        clearTimeout(expiry);
        setEvents(current);
        if (current.length) {
          const valid = Math.min(...current.map(event => event.validForMs)) - elapsed;
          expiry = setTimeout(() => setEvents([]), valid);
          next = Math.min(refreshEvery, Math.max(1000, valid - 3000));
        }
      } catch {
        // The existing CS2 banner stays usable while the provider is unavailable.
      } finally {
        clearTimeout(timeout);
        if (!stopped && controller === request && !document.hidden) poll = setTimeout(refresh, next);
      }
    };
    const onVisibility = () => {
      clearTimeout(poll);
      if (!document.hidden) refresh();
      else controller?.abort();
    };
    refresh();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stopped = true;
      controller?.abort();
      clearTimeout(poll);
      clearTimeout(expiry);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [matchId, action, maxAge, refreshEvery]);

  if (!events.length) return null;
  const timeOptions = { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
  const price = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return <section className="onewin-featured">
    <h3>{titles[language] || titles.en}</h3>
    <div className="onewin-featured__grid">
      {events.map(event => {
        const Tag = pari ? 'div' : 'a';
        const link = pari ? {} : { href: event.href, target: '_blank', rel: 'sponsored nofollow noopener noreferrer' };
        return <Tag key={event.eventId} {...link} className="onewin-featured__match">
        <span className="onewin-featured__meta"><time dateTime={new Date(event.startsAt).toISOString()}>{formatOddsDateTime(event.startsAt, timeOptions, { locale, pari })}</time><span>{winner[language] || winner.en} {!pari && <span aria-hidden="true">↗</span>}</span></span>
        {[event.team1, event.team2].map(team => <span key={team.name} className="onewin-featured__team"><strong>{team.name}</strong><b>{price.format(team.price)}</b></span>)}
        </Tag>;
      })}
    </div>
  </section>;
}
