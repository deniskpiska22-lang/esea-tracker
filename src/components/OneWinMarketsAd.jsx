import { useEffect, useState } from 'react';
import { useLanguage } from '../context/LanguageContext.jsx';
import './TeamNativeAd.css';
import { MARKET_TTL_MS } from '../utils/onewinMarkets.js';
import './OneWinMarketsAd.css';

const copy = {
  ru: { ad: 'Реклама', yes: 'Да', no: 'Нет', open: 'Открыть вопрос', source: 'Оценка рынка', updated: 'Обновлено', note: 'Играйте ответственно.' },
  en: { ad: 'Advertisement', yes: 'Yes', no: 'No', open: 'Explore question', source: 'Market estimate', updated: 'Updated', note: 'Play responsibly.' },
  de: { ad: 'Werbung', yes: 'Ja', no: 'Nein', open: 'Frage ansehen', source: 'Markteinschätzung', updated: 'Aktualisiert', note: 'Verantwortungsvoll spielen.' },
  pt: { ad: 'Publicidade', yes: 'Sim', no: 'Não', open: 'Ver pergunta', source: 'Estimativa do mercado', updated: 'Atualizado', note: 'Jogue com responsabilidade.' },
  es: { ad: 'Publicidad', yes: 'Sí', no: 'No', open: 'Ver pregunta', source: 'Estimación del mercado', updated: 'Actualizado', note: 'Juega con responsabilidad.' },
  fr: { ad: 'Publicité', yes: 'Oui', no: 'Non', open: 'Voir la question', source: 'Estimation du marché', updated: 'Mis à jour', note: 'Jouez de façon responsable.' },
  it: { ad: 'Pubblicità', yes: 'Sì', no: 'No', open: 'Vedi la domanda', source: 'Stima del mercato', updated: 'Aggiornato', note: 'Gioca responsabilmente.' },
};

const browseCopy = {
  ru: { title: 'Что будет дальше в CS2?', body: 'Открой вопросы и прогнозы на 1win Markets.', open: 'Открыть Markets' },
  en: { title: 'What happens next in CS2?', body: 'Explore questions and predictions on 1win Markets.', open: 'Explore Markets' },
  de: { title: 'Was passiert als Nächstes in CS2?', body: 'Entdecke Fragen und Prognosen bei 1win Markets.', open: 'Markets ansehen' },
  pt: { title: 'O que vem a seguir no CS2?', body: 'Explora perguntas e previsões na 1win Markets.', open: 'Explorar Markets' },
  es: { title: '¿Qué pasará ahora en CS2?', body: 'Descubre preguntas y pronósticos en 1win Markets.', open: 'Explorar Markets' },
  fr: { title: 'Que va-t-il se passer dans CS2 ?', body: 'Découvre les questions et les pronostics sur 1win Markets.', open: 'Explorer Markets' },
  it: { title: 'Cosa succederà in CS2?', body: 'Scopri domande e pronostici su 1win Markets.', open: 'Esplora Markets' },
};

export default function OneWinMarketsAd() {
  const { language, locale } = useLanguage();
  const [result, setResult] = useState(null);
  useEffect(() => {
    let stopped = false;
    let generation = 0;
    let controller;
    let poll;
    let expiry;
    const refresh = async () => {
      if (stopped || document.hidden) return;
      const current = ++generation;
      controller?.abort();
      const request = new AbortController();
      controller = request;
      const started = performance.now();
      const timeout = setTimeout(() => request.abort(), 25_000);
      let delay = 60_000;
      try {
        const response = await fetch(`/api/onewin-markets?lang=${language}`, { credentials: 'same-origin', cache: 'no-store', signal: request.signal });
        const data = response.ok ? (await response.json()).market : null;
        if (stopped || current !== generation) return;
        clearTimeout(expiry);
        const remaining = Number(data?.validForMs) - (performance.now() - started);
        const valid = data?.language === language && remaining > 0 && remaining <= MARKET_TTL_MS
          && Number.isSafeInteger(data?.eventId) && data.eventId > 0
          && typeof data.title === 'string' && Number.isFinite(Date.parse(data.updatedAt))
          && [data.yes, data.no].every(value => Number.isFinite(value) && value >= 0 && value <= 100);
        setResult(valid ? { language, data } : null);
        if (valid) {
          delay = 15_000;
          expiry = setTimeout(() => setResult(null), remaining);
        }
      } catch {
        if (!stopped && current === generation) setResult(null);
      } finally {
        clearTimeout(timeout);
        if (!stopped && current === generation) poll = setTimeout(refresh, delay);
      }
    };
    const onVisibility = () => {
      clearTimeout(poll);
      if (!document.hidden) refresh();
      else { generation += 1; controller?.abort(); }
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
  }, [language]);

  const market = result?.language === language ? result.data : null;
  const labels = copy[language] || copy.en;
  const browse = browseCopy[language] || browseCopy.en;
  const href = market ? `/api/onewin-markets?lang=${language}&action=visit&eventId=${market.eventId}`
    : `/api/onewin-markets?lang=${language}&action=browse`;
  const updated = market ? new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(new Date(market.updatedAt)) : null;
  const open = market ? labels.open : browse.open;
  return (
    <aside className="team-native-ad team-native-ad--onewin onewin-markets-ad" data-onewin-markets={market?.eventId || 'browse'} aria-label={`${labels.ad} · 1win Markets · 18+`}>
      <div className="team-native-ad__watermark" aria-hidden="true">CS2</div>
      <div className="team-native-ad__main">
        <div className="team-native-ad__brand" aria-hidden="true">
          <img className="team-native-ad__logo" src="/ads/onewin/onewin-logo.jpg" alt="" width="2048" height="1050" decoding="async" />
          <span className="team-native-ad__brand-caption">MARKETS</span>
        </div>
        <div className="team-native-ad__content">
          <div className="team-native-ad__tags"><span>CS2</span><span>1win Markets</span></div>
          <h2>{market?.title || browse.title}</h2>
          {!market && <p>{browse.body}</p>}
        </div>
        <div className="team-native-ad__action">
          <span className="team-native-ad__disclosure">{labels.ad} <span>18+</span></span>
          <a href={href} target="_blank" rel="sponsored nofollow noopener noreferrer">{open}<span className="team-native-ad__arrow" aria-hidden="true">↗</span></a>
        </div>
      </div>
      {market && <div className="onewin-markets-ad__answers">
        {[['yes', labels.yes], ['no', labels.no]].map(([side, label]) => (
          <a key={side} className={`onewin-markets-ad__answer onewin-markets-ad__answer--${side}`} href={href} target="_blank" rel="sponsored nofollow noopener noreferrer" aria-label={`${label}: ${market[side]}% · ${labels.open} · 1win Markets`}>
            <span>{label}</span><strong>{market[side]}%</strong>
          </a>
        ))}
      </div>}
      <div className="team-native-ad__footer">
        <span>1win Markets{market ? ` · ${labels.source}` : ''}</span>
        {market && <span>{labels.updated} <time dateTime={market.updatedAt}>{updated}</time></span>}
        <span className="team-native-ad__responsible">18+ · {labels.note}</span>
      </div>
    </aside>
  );
}
