import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { localizedPath } from '../i18n/languages.js';
export default function LanguageSwitcher() {
  const { language, setLanguage, languages, tr } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = event => { if (!ref.current?.contains(event.target)) setOpen(false); };
    const escape = event => { if (event.key === 'Escape') { setOpen(false); ref.current?.querySelector('button')?.focus(); } };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', escape); };
  }, [open]);
  return <div ref={ref} className="relative shrink-0">
    <button type="button" aria-label={tr('Выбрать язык', 'Choose language')} aria-expanded={open} aria-controls="site-language-menu"
      onClick={() => setOpen(value => !value)} className="flex h-11 items-center gap-1.5 rounded-xl border border-white/10 bg-[#0d131d] px-2.5 text-sm font-bold text-gray-200 hover:border-orange-500/40">
      <span aria-hidden="true">◎</span><span>{language.toUpperCase()}</span><span aria-hidden="true">▾</span>
    </button>
    {open && <nav id="site-language-menu" aria-label={tr('Язык', 'Language')} className="absolute right-0 top-14 w-48 rounded-2xl border border-white/10 bg-[#0d131d] p-2 shadow-2xl">
      {languages.map(item => <a key={item.code} lang={item.code} href={localizedPath(window.location.pathname, item.code) + window.location.search + window.location.hash}
        aria-current={language === item.code ? 'true' : undefined}
        onClick={event => { if (event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) { event.preventDefault(); setLanguage(item.code); setOpen(false); } }}
        className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-sm hover:bg-white/5 ${language === item.code ? 'bg-orange-500/10 text-orange-300' : 'text-gray-200'}`}>
        {item.name}<span aria-hidden="true">{language === item.code ? '✓' : item.code.toUpperCase()}</span>
      </a>)}
    </nav>}
  </div>;
}
