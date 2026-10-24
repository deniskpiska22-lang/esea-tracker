import { useCallback, useState } from 'react';
import { supabase } from '../../lib/supabaseClient.js';
import { tx } from '../../i18n/translate.js';
import { forumTopicPath } from '../../utils/forum.js';
import { safeWebUrl } from '../../utils/adminWorkspace.js';
import { useAdminResource, requireData } from './useAdminResource.js';
import { Panel, Notice, Empty, DateLabel, Pager } from './AdminUI.jsx';
import Link from '../SiteLink.jsx';
export function ForumPanel() {
  const [filter, setFilter] = useState('reports');
  return <div className="admin-stack"><div className="admin-toolbar"><div className="admin-segment">{['reports', 'topics'].map(value => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{tx(value === 'reports' ? 'Reports' : 'Topics')}</button>)}</div><Link to="/forum/moderation" className="admin-btn">{tx('Full moderation queue')} ↗</Link></div><ForumRows key={filter} filter={filter} /></div>;
}
function ForumRows({ filter }) {
  const [page, setPage] = useState(0);
  return <ForumPageRows key={`${filter}:${page}`} filter={filter} page={page} setPage={setPage} />;
}
function ForumPageRows({ filter, page, setPage }) {
  const loader = useCallback(async () => {
    const query = filter === 'reports' ? supabase.from('forum_reports').select('id,topic_id,post_id,reason,created_at,topic:forum_topics(id,title,hidden),post:forum_posts(id,body,hidden)', { count: 'exact' }).eq('resolved', false) : supabase.from('forum_topics').select('id,title,category,language,pinned,locked,hidden,created_at,reply_count', { count: 'exact' });
    const response = await query.order('created_at', { ascending: false }).order('id').range(page * 20, page * 20 + 19);
    requireData(response); return { rows: response.data, count: response.count };
  }, [filter, page]);
  const { data, loading, error, refresh } = useAdminResource(loader);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  async function act(action, payload) {
    setBusy(true); setActionError('');
    try { requireData(await supabase.rpc('forum_write', { p_action: action, p_payload: payload })); refresh(); }
    catch { setActionError(tx('Could not save changes. Please try again.')); }
    finally { setBusy(false); }
  }
  return <Panel title={filter === 'reports' ? 'Reports awaiting review' : 'Forum topics'} action={<button className="admin-btn" disabled={loading || busy} onClick={refresh}>↻ {tx('Refresh')}</button>}>
    <Notice error>{error ? tx('Could not load this section. Please retry.') : actionError}</Notice>
    {loading ? <Empty>{tx('Loading...')}</Empty> : !data?.rows.length ? <Empty>{tx(filter === 'reports' ? 'No unresolved reports.' : 'Nothing here yet.')}</Empty> : <div className="admin-stack">{data.rows.map(row => {
      const topic = filter === 'reports' ? row.topic : row;
      return <article className="admin-topic" key={row.id}><div className="admin-row-between"><Link className="admin-text-link" to={forumTopicPath(topic || { id: row.topic_id })}>{topic?.title || tx('Topic unavailable')}</Link><small><DateLabel value={row.created_at} /></small></div>
        {filter === 'reports' ? <><p className="admin-report-reason">{row.reason}</p>{row.post && <blockquote>{row.post.body}</blockquote>}<div className="admin-actions"><button disabled={busy || Boolean(row.post ? row.post.hidden : topic?.hidden)} className="admin-btn" onClick={() => act(row.post ? 'hide_post' : 'moderate_topic', { topic_id: row.topic_id, post_id: row.post_id, hidden: true })}>{tx(row.post ? 'Hide reply' : 'Hide topic')}</button><button disabled={busy} className="admin-btn primary" onClick={() => act('resolve_report', { id: row.id })}>{tx('Resolve report')}</button></div></> : <><div className="admin-tags"><span>{tx(row.category)}</span><span>{row.language.toUpperCase()}</span><span>{row.reply_count} {tx('replies')}</span>{row.hidden && <span>{tx('Hidden')}</span>}</div><div className="admin-actions">{[['pinned', 'Pin topic', 'Unpin topic'], ['locked', 'Close topic', 'Reopen topic'], ['hidden', 'Hide topic', 'Restore topic']].map(([field, off, on]) => <button key={field} disabled={busy} className="admin-btn" onClick={() => act('moderate_topic', { topic_id: row.id, [field]: !row[field] })}>{tx(row[field] ? on : off)}</button>)}</div></>}
      </article>;
    })}</div>}
    {data && <Pager page={page} total={data.count} pageSize={20} onChange={setPage} />}
  </Panel>;
}
const EMPTY_NEWS = { title: '', slug: '', summary: '', body: '', category: 'general', image_url: '', is_featured: false, is_published: false };
export function NewsPanel() {
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState(null);
  const [revision, setRevision] = useState(0);
  return <div className="admin-stack"><NewsRows key={`${page}:${revision}`} page={page} setPage={setPage} onSelect={setSelected} />{selected && <NewsEditor key={selected.id || 'new'} item={selected} onSaved={row => { setSelected(row); setRevision(value => value + 1); }} onClose={() => setSelected(null)} />}</div>;
}
function NewsRows({ page, setPage, onSelect }) {
  const loader = useCallback(async () => {
    const response = await supabase.from('news').select('id,title,slug,is_published,is_featured,published_at,updated_at', { count: 'exact' }).order('created_at', { ascending: false }).order('id').range(page * 20, page * 20 + 19);
    requireData(response); return { rows: response.data, count: response.count };
  }, [page]);
  const { data, loading, error, refresh } = useAdminResource(loader);
  return <Panel title="Newsroom" description="Write drafts and manage published articles." action={<div className="admin-actions"><button className="admin-btn" disabled={loading} onClick={refresh}>↻</button><button className="admin-btn primary" onClick={() => onSelect({ ...EMPTY_NEWS })}>+ {tx('New article')}</button></div>}>
    <Notice error>{error && tx('Could not load this section. Please retry.')}</Notice>{loading ? <Empty>{tx('Loading...')}</Empty> : !data?.rows.length ? <Empty /> : data.rows.map(row => <div className="admin-list-row" key={row.id}><div><strong>{row.title}</strong><small><DateLabel value={row.updated_at} /></small></div><span className={`admin-badge ${row.is_published ? 'good' : ''}`}>{tx(row.is_published ? 'Published' : 'Draft')}</span><button className="admin-btn" onClick={() => onSelect(row)}>{tx('Edit')}</button></div>)}{data && <Pager page={page} total={data.count} pageSize={20} onChange={setPage} />}
  </Panel>;
}
function NewsEditor({ item, onSaved, onClose }) {
  const loader = useCallback(async () => item.id ? requireData(await supabase.from('news').select('id,title,slug,summary,body,category,image_url,is_featured,is_published,published_at,updated_at').eq('id', item.id).single()) : item, [item]);
  const resource = useAdminResource(loader);
  return <Panel title={item.id ? 'Edit article' : 'New article'} action={<button className="admin-btn" onClick={onClose}>{tx('Close')}</button>}><Notice error>{resource.error && tx('Could not load this section. Please retry.')}</Notice>{resource.data ? <NewsForm key={resource.data.updated_at || 'new'} item={resource.data} onSaved={onSaved} /> : <Empty>{tx('Loading...')}</Empty>}</Panel>;
}
function NewsForm({ item, onSaved }) {
  const [draft, setDraft] = useState(item);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  async function save(event) {
    event.preventDefault(); setBusy(true); setError(''); setSaved(false);
    try {
      const image = safeWebUrl(draft.image_url);
      if (image === null) throw new Error('Use a valid HTTP or HTTPS URL.');
      const patch = { title: draft.title.trim(), slug: draft.slug.trim(), summary: draft.summary?.trim() || null, body: String(draft.body || '').trim(), category: draft.category || 'general', image_url: image || null, is_featured: draft.is_featured, is_published: draft.is_published, published_at: draft.is_published ? draft.published_at || new Date().toISOString() : draft.published_at || null, updated_at: new Date().toISOString() };
      const query = item.id ? supabase.from('news').update(patch).eq('id', item.id).eq('updated_at', item.updated_at) : supabase.from('news').insert(patch);
      const response = await query.select().maybeSingle();
      if (response.error) throw response.error;
      if (!response.data) throw new Error('This article changed. Close and reopen it before saving.');
      setSaved(true); onSaved(response.data);
    } catch (error) { setError(tx(['Use a valid HTTP or HTTPS URL.', 'This article changed. Close and reopen it before saving.'].includes(error.message) ? error.message : 'Could not save changes. Please try again.')); }
    finally { setBusy(false); }
  }
  return <form className="admin-stack" onSubmit={save}>
    <Notice error>{error}</Notice><Notice>{saved && tx('Changes saved.')}</Notice>
    {['title', 'slug', 'summary', 'category', 'image_url'].map(field => <label className="admin-field" key={field}>{tx({ title: 'Title', slug: 'URL slug', summary: 'Summary', category: 'Category', image_url: 'Image URL' }[field])}<input required={['title', 'slug'].includes(field)} type={field === 'image_url' ? 'url' : 'text'} pattern={field === 'slug' ? '[a-z0-9]+(-[a-z0-9]+)*' : undefined} maxLength={field === 'summary' ? 2000 : 500} value={draft[field] || ''} onChange={event => setDraft({ ...draft, [field]: event.target.value })} /></label>)}
    <label className="admin-field">{tx('Article text')}<textarea required rows={12} maxLength={100000} value={draft.body || ''} onChange={event => setDraft({ ...draft, body: event.target.value })} /></label>
    <div className="admin-actions"><label className="admin-check"><input type="checkbox" checked={draft.is_featured} onChange={event => setDraft({ ...draft, is_featured: event.target.checked })} />{tx('Featured article')}</label><label className="admin-check"><input type="checkbox" checked={draft.is_published} onChange={event => setDraft({ ...draft, is_published: event.target.checked })} />{tx('Publish on site')}</label></div>
    <button disabled={busy} className="admin-btn primary">{tx(busy ? 'Saving...' : 'Save article')}</button>
  </form>;
}
