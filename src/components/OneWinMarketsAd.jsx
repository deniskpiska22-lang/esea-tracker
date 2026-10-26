import { useLanguage } from '../context/LanguageContext.jsx';
import './TeamNativeAd.css';

const copy = {
  ru: { ad: 'Реклама', title: 'Больше матчей CS2 на 1win', body: 'Сравни коэффициенты на другие матчи CS2 и посмотри условия бонусов на 1win.', open: 'Перейти на 1win', note: 'Играйте ответственно.' },
  en: { ad: 'Advertisement', title: 'More CS2 matches on 1win', body: 'Compare odds on other CS2 matches and explore bonus terms on 1win.', open: 'Explore 1win', note: 'Play responsibly.' },
  de: { ad: 'Werbung', title: 'Mehr CS2-Spiele bei 1win', body: 'Vergleiche Quoten für weitere CS2-Spiele und sieh dir die Bonusbedingungen bei 1win an.', open: 'Zu 1win', note: 'Verantwortungsvoll spielen.' },
  pt: { ad: 'Publicidade', title: 'Mais jogos de CS2 na 1win', body: 'Compara as odds de outros jogos de CS2 e consulta as condições dos bónus na 1win.', open: 'Ir para a 1win', note: 'Jogue com responsabilidade.' },
  es: { ad: 'Publicidad', title: 'Más partidos de CS2 en 1win', body: 'Compara las cuotas de otros partidos de CS2 y consulta las condiciones de los bonos en 1win.', open: 'Ir a 1win', note: 'Juega con responsabilidad.' },
  fr: { ad: 'Publicité', title: 'Plus de matchs CS2 sur 1win', body: 'Compare les cotes d’autres matchs CS2 et consulte les conditions des bonus sur 1win.', open: 'Découvrir 1win', note: 'Jouez de façon responsable.' },
  it: { ad: 'Pubblicità', title: 'Altre partite di CS2 su 1win', body: 'Confronta le quote di altre partite di CS2 e consulta le condizioni dei bonus su 1win.', open: 'Vai su 1win', note: 'Gioca responsabilmente.' },
};

// Keep the approved native layout as the fallback when this match has no odds.
// Use the user's original affiliate entry link, without polling unrelated questions.
export default function OneWinMarketsAd() {
  const { language } = useLanguage();
  const labels = copy[language] || copy.en;
  const href = `/api/onewin?kind=click&lang=${encodeURIComponent(language)}&placement=match_room_native`;
  return (
    <aside className="team-native-ad team-native-ad--onewin" data-match-native-promo="onewin" aria-label={`${labels.ad} · 1win · 18+`}>
      <div className="team-native-ad__watermark" aria-hidden="true">CS2</div>
      <div className="team-native-ad__main">
        <div className="team-native-ad__brand" aria-hidden="true">
          <img className="team-native-ad__logo" src="/ads/onewin/onewin-logo.jpg" alt="" width="2048" height="1050" decoding="async" />
          <span className="team-native-ad__brand-caption">ESPORTS</span>
        </div>
        <div className="team-native-ad__content">
          <div className="team-native-ad__tags"><span>CS2</span><span>1win</span></div>
          <h2>{labels.title}</h2>
          <p>{labels.body}</p>
        </div>
        <div className="team-native-ad__action">
          <span className="team-native-ad__disclosure">{labels.ad} <span>18+</span></span>
          <a href={href} target="_blank" rel="sponsored nofollow noopener noreferrer">{labels.open}<span className="team-native-ad__arrow" aria-hidden="true">↗</span></a>
        </div>
      </div>
      <div className="team-native-ad__footer">
        <span className="team-native-ad__footer-brand">1win<span aria-hidden="true"> / </span>CS2</span>
        <span className="team-native-ad__responsible">18+ · {labels.note}</span>
      </div>
    </aside>
  );
}
