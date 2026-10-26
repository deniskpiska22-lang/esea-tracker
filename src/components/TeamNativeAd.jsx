import { useEffect, useState } from 'react';
import { useLanguage } from '../context/LanguageContext.jsx';
import { isAdProviderEnabled, loadAdPolicy } from '../lib/adPolicy.js';
import './TeamNativeAd.css';

const copy = {
  ru: { ad: 'Реклама', title: 'Сравни свой прогноз', body: 'Узнай, какие коэффициенты даёт {brand} на матчи CS2.', open: 'Посмотреть коэффициенты', prematch: 'Прематч', note: 'Играйте ответственно.' },
  en: { ad: 'Advertisement', title: 'How does your prediction compare?', body: 'See the odds {brand} offers on CS2 matches.', open: 'See CS2 odds', prematch: 'Pre-match', note: 'Play responsibly.' },
  de: { ad: 'Werbung', title: 'Vergleiche deine Prognose', body: 'Entdecke die Quoten von {brand} für CS2-Spiele.', open: 'Quoten ansehen', prematch: 'Vor dem Spiel', note: 'Verantwortungsvoll spielen.' },
  pt: { ad: 'Publicidade', title: 'Compara o teu palpite', body: 'Descobre as odds da {brand} para os jogos de CS2.', open: 'Ver odds de CS2', prematch: 'Pré-jogo', note: 'Jogue com responsabilidade.' },
  es: { ad: 'Publicidad', title: 'Compara tu pronóstico', body: 'Descubre las cuotas de {brand} para los partidos de CS2.', open: 'Ver cuotas de CS2', prematch: 'Prepartido', note: 'Juega con responsabilidad.' },
  fr: { ad: 'Publicité', title: 'Compare ton pronostic', body: 'Découvre les cotes de {brand} pour les matchs CS2.', open: 'Voir les cotes CS2', prematch: 'Avant-match', note: 'Jouez de façon responsable.' },
  it: { ad: 'Pubblicità', title: 'Confronta il tuo pronostico', body: 'Scopri le quote di {brand} per le partite di CS2.', open: 'Vedi le quote CS2', prematch: 'Pre-partita', note: 'Gioca responsabilmente.' },
};

const pariOpen = { ru: 'Перейти в PARI', en: 'Visit PARI', de: 'Zu PARI', pt: 'Ir para a PARI', es: 'Ir a PARI', fr: 'Découvrir PARI', it: 'Vai su PARI' };

export default function TeamNativeAd({ placement = 'team_profile_native' }) {
  const { language } = useLanguage();
  const [policy, setPolicy] = useState(null);
  useEffect(() => {
    let active = true;
    loadAdPolicy().then(result => { if (active) setPolicy(result); });
    return () => { active = false; };
  }, []);

  const provider = isAdProviderEnabled(policy, 'pari') ? 'pari'
    : isAdProviderEnabled(policy, 'onewin') ? 'onewin' : null;
  if (!provider) return null;

  const labels = copy[language] || copy.en;
  const pari = provider === 'pari';
  const brand = pari ? 'PARI' : '1win';
  const open = pari ? (pariOpen[language] || pariOpen.en) : labels.open;
  const href = pari
    ? `/api/pari?placement=${encodeURIComponent(placement)}`
    : `/api/onewin?kind=click&lang=${language}&placement=${encodeURIComponent(placement)}`;

  return (
    <aside aria-label={`${labels.ad} · ${brand} · 18+`} data-team-native-ad={provider}
      className={`team-native-ad team-native-ad--${provider}`}>
      <div className="team-native-ad__watermark" aria-hidden="true">CS2</div>
      <div className="team-native-ad__main">
        <div className="team-native-ad__brand" aria-hidden="true">
          {pari ? <span className="team-native-ad__wordmark">{brand}</span>
            : <img className="team-native-ad__logo" src="/ads/onewin/onewin-logo.jpg" alt="" width="2048" height="1050" decoding="async" />}
          <span className="team-native-ad__brand-caption">ESPORTS</span>
        </div>
        <div className="team-native-ad__content">
          <div className="team-native-ad__tags"><span>CS2</span><span>{labels.prematch}</span><span>LIVE</span></div>
          <h2>{labels.title}</h2>
          <p>{labels.body.replace('{brand}', brand)}</p>
        </div>
        <div className="team-native-ad__action">
          <span className="team-native-ad__disclosure">{labels.ad} <span>18+</span></span>
          <a href={href} target="_blank" rel="sponsored nofollow noopener noreferrer" aria-label={`${open} · ${brand}`}>
            {open}<span className="team-native-ad__arrow"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M4 10h12m-5-5 5 5-5 5" /></svg></span>
          </a>
        </div>
      </div>
      <div className="team-native-ad__footer">
        <span className="team-native-ad__footer-brand">{brand}<span aria-hidden="true"> / </span>CS2</span>
        {pari && <span>ООО «БК «ПАРИ» · ИНН 7703365167</span>}
        <span className="team-native-ad__responsible">18+ · {labels.note}</span>
      </div>
    </aside>
  );
}
