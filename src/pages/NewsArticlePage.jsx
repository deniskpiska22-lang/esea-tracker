import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';
import { tx } from '../i18n/translate.js';
import { currentLanguage, localizedPath } from '../i18n/languages.js';
import Link from '../components/SiteLink.jsx';
import { formatUserDateTime } from '../utils/userTime.js';
export default function NewsArticlePage() {
  const { slug } = useParams();
  return <Article key={slug} slug={slug} />;
}
function Article({ slug }) {
  const [state, setState] = useState({ loading: true, article: null, error: false });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    if (!supabase) return;
    supabase.from('news').select('id,title,summary,body,image_url,published_at,category').eq('slug', slug).eq('is_published', true).maybeSingle().then(({ data, error }) => {
      if (active) setState({ loading: false, article: data, error: Boolean(error) });
    }).catch(() => { if (active) setState({ loading: false, article: null, error: true }); });
    return () => { active = false; };
  }, [slug, revision]);
  useEffect(() => {
    const article = state.article;
    if (!article) return;
    const language = currentLanguage();
    const path = localizedPath(`/media/${slug}`, language);
    window.dispatchEvent(new CustomEvent('forum-seo-update', { detail: {
      routePath: path, canonicalPath: path, title: `${article.title} | ESEA Tracker`,
      heading: article.title, description: article.summary || String(article.body || '').slice(0, 180),
      image: article.image_url || undefined, language, alternates: [], robots: 'index,follow,max-image-preview:large',
      schema: { '@context': 'https://schema.org', '@type': 'NewsArticle', headline: article.title, datePublished: article.published_at, url: `https://eseatracker.ru${path}` },
    } }));
  }, [state.article, slug]);
  return <main className="mx-auto min-h-[60vh] max-w-4xl px-5 py-10 text-white"><Link className="text-sm text-orange-300" to="/media">← {tx('News')}</Link>
    {state.loading ? <p className="py-14 text-slate-400">{tx('Loading...')}</p> : state.error ? <div className="py-14"><p className="text-slate-400">{tx('Could not load this section. Please retry.')}</p><button className="mt-5 rounded-lg border border-slate-600 px-5 py-2" onClick={() => setRevision(value => value + 1)}>{tx('Retry')}</button></div> : !state.article ? <p className="py-14 text-slate-400">{tx('Article not found.')}</p> : <article className="mt-7"><p className="text-xs font-bold uppercase tracking-widest text-orange-400">{state.article.category}</p><h1 className="mt-4 text-3xl font-black leading-tight md:text-5xl">{state.article.title}</h1>{state.article.published_at && <p className="mt-5 text-xs text-slate-500">{formatUserDateTime(state.article.published_at)}</p>}{state.article.summary && <p className="mt-8 text-lg leading-8 text-slate-300">{state.article.summary}</p>}{state.article.image_url && <img src={state.article.image_url} alt="" className="mt-8 max-h-[500px] w-full rounded-xl object-cover" />}<div className="mt-8 whitespace-pre-wrap break-words text-base leading-8 text-slate-300">{state.article.body}</div></article>}
  </main>;
}
