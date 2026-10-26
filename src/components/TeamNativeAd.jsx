import { useEffect, useState } from 'react';
import { useLanguage } from '../context/LanguageContext.jsx';
import { isAdProviderEnabled, loadAdPolicy } from '../lib/adPolicy.js';

const copy = {
  ru: { ad: 'Реклама', title: 'Киберспорт — ближе к игре', body: 'Линия CS2, коэффициенты и live на сайте букмекера.', open: 'Открыть', note: 'Играйте ответственно.' },
  en: { ad: 'Advertisement', title: 'Esports. Closer to the game.', body: 'CS2 markets, odds and live events at the bookmaker.', open: 'Visit', note: 'Play responsibly.' },
  de: { ad: 'Werbung', title: 'Esport. Näher am Spiel.', body: 'CS2-Wetten, Quoten und Live-Events beim Buchmacher.', open: 'Öffnen', note: 'Verantwortungsvoll spielen.' },
  pt: { ad: 'Publicidade', title: 'Esports. Mais perto do jogo.', body: 'Mercados de CS2, odds e eventos ao vivo na casa de apostas.', open: 'Visitar', note: 'Jogue com responsabilidade.' },
  es: { ad: 'Publicidad', title: 'Esports. Más cerca del juego.', body: 'Mercados de CS2, cuotas y eventos en vivo en la casa de apuestas.', open: 'Visitar', note: 'Juega con responsabilidad.' },
  fr: { ad: 'Publicité', title: 'Esport. Au plus près du jeu.', body: 'Marchés CS2, cotes et événements en direct chez le bookmaker.', open: 'Visiter', note: 'Jouez de façon responsable.' },
  it: { ad: 'Pubblicità', title: 'Esport. Più vicino al gioco.', body: 'Mercati CS2, quote ed eventi live sul sito del bookmaker.', open: 'Visita', note: 'Gioca responsabilmente.' },
};

export default function TeamNativeAd() {
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
  const href = pari
    ? 'https://clicks.af-pb06e2.com/click?offer_id=812&partner_id=34440&landing_id=88&utm_medium=affiliate&utm_source=esea_tracker&utm_campaign=pari_cs2_test&utm_content=team_native_preview'
    : `/api/onewin?kind=click&lang=${language}&placement=team_native_preview`;

  return (
    <aside aria-label={`${labels.ad} · ${brand} · 18+`} data-team-native-ad={provider}
      className="relative mt-6 overflow-hidden rounded-2xl border border-white/[0.09] bg-[#101720]">
      <div aria-hidden="true" className={`absolute inset-y-0 left-0 w-[3px] ${pari ? 'bg-[#28e5cd]' : 'bg-sky-400'}`} />
      <div className="flex flex-wrap items-center gap-x-5 gap-y-4 px-5 py-4 sm:flex-nowrap sm:px-6">
        <div className={`flex h-14 w-20 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-[#080e16] text-[28px] font-black italic tracking-tighter ${pari ? 'text-[#28e5cd]' : 'text-white'}`} aria-hidden="true">{brand}</div>
        <div className="min-w-0 flex-1 basis-[calc(100%-110px)] sm:basis-auto">
          <div className="mb-1.5 flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            <span>{labels.ad}</span><span aria-hidden="true">·</span><span>18+</span><span className="ml-1 border-l border-white/10 pl-3 text-slate-400">CS2</span>
          </div>
          <h2 className="text-sm font-bold tracking-tight text-slate-100 sm:text-base">{labels.title}</h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">{labels.body}</p>
        </div>
        <a href={href} target="_blank" rel="sponsored nofollow noopener noreferrer"
          className={`inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-3 rounded-lg border px-4 py-2.5 text-xs font-bold transition focus-visible:outline-2 focus-visible:outline-offset-4 sm:w-auto ${pari ? 'border-[#28e5cd]/25 bg-[#28e5cd]/10 text-[#8af4e5] hover:bg-[#28e5cd]/20 focus-visible:outline-[#28e5cd]' : 'border-sky-300/25 bg-sky-400/10 text-sky-200 hover:bg-sky-400/20 focus-visible:outline-sky-300'}`}>
          {labels.open} {brand}<svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M5 15 15 5M5 5h10v10" /></svg>
        </a>
      </div>
      <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 border-t border-white/[0.045] px-5 py-2 text-[9px] leading-relaxed text-slate-500 sm:px-6">
        <span>{pari ? 'ООО «БК «ПАРИ» · ИНН 7703365167' : '1win · CS2'}</span>
        <span>18+ · {labels.note}</span>
      </div>
    </aside>
  );
}
