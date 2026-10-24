import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import Link from './SiteLink.jsx';
import { tx } from '../i18n/translate.js';
import { formatUserDateTime } from '../utils/userTime.js';
export default function PublishedNews() {
  const [articles, setArticles] = useState([]);
  useEffect(() => {
    let active = true;
    if (!supabase) return;
    supabase.from('news').select('id,slug,title,summary,image_url,published_at,is_featured').eq('is_published', true).order('is_featured', { ascending: false }).order('published_at', { ascending: false }).limit(12).then(({ data, error }) => {
      if (active && !error) setArticles(data || []);
    }).catch(() => {});
    return () => { active = false; };
  }, []);
  if (!articles.length) return null;
  return <section className="mb-8 space-y-5" aria-label={tx('News')}><h1 className="text-2xl font-black">{tx('News')}</h1>{articles.map(article => <Link key={article.id} to={`/media/${article.slug}`} className="flex flex-col gap-5 overflow-hidden rounded-xl border border-white/10 bg-[#0b0f14] p-5 transition hover:border-orange-500/30 sm:flex-row">
    {article.image_url && <img src={article.image_url} alt="" width="192" height="120" loading="lazy" className="h-32 w-full rounded-lg object-cover sm:w-48" />}
    <div><h2 className="text-lg font-black text-white">{article.title}</h2>{article.published_at && <p className="mt-2 text-xs text-slate-500">{formatUserDateTime(article.published_at)}</p>}{article.summary && <p className="mt-3 line-clamp-3 text-sm leading-7 text-slate-400">{article.summary}</p>}</div>
  </Link>)}</section>;
}
