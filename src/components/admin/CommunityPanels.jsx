import { useCallback, useMemo, useState } from 'react';
import { useAdminData } from './adminDataContext.js';
import { useAdminQuery, pageIndex } from './useAdminQuery.js';
import { useUnsavedChanges } from './useUnsavedChanges.js';
import { tx } from '../../i18n/translate.js';
import { forumTopicPath, forumCategory } from '../../utils/forum.js';
import { safeWebUrl } from '../../utils/adminWorkspace.js';
import { useAdminResource } from './useAdminResource.js';
import { Panel, Notice, Empty, DateLabel, Pager, Skeleton } from './AdminUI.jsx';
import Link from '../SiteLink.jsx';
export function ForumPanel() {
  const [params, update] = useAdminQuery();
  const filter = params.get('f_view') === 'topics' ? 'topics' : 'reports';
  const setFilter = value => update({ f_view: value, f_page: 0 });
  return <div className="admin-stack"><div className="admin-toolbar"><div className="admin-segment">{['reports', 'topics'].map(value => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{tx(value === 'reports' ? 'Reports' : 'Topics')}</button>)}</div><Link to="/forum/moderation" className="admin-btn">{tx('Full moderation queue')} ↗</Link></div><ForumRows key={filter} filter={filter} /></div>;
}
function ForumRows({ filter }) {
  const [params, update] = useAdminQuery();
  const page = pageIndex(params.get('f_page'));
  const setPage = value => update({ f_page: value });
  return <ForumPageRows key={`${filter}:${page}`} filter={filter} page={page} setPage={setPage} />;
}
function ForumPageRows({ filter, page, setPage }) {
  const api = useAdminData();
  const loader = useCallback(options => api.loadForum({ filter, page, ...options }), [api, filter, page]);
  const { data, loading, error, refresh } = useAdminResource(loader);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  async function act(action, payload) {
    setBusy(true); setActionError('');
    try { if (api.preview) { setActionError(tx('Preview only. Nothing was saved.')); return; } await api.writeForum(action, payload); refresh(); }
    catch { setActionError(tx('Could not save changes. Please try again.')); }
    finally { setBusy(false); }
  }
  return <Panel title={filter === 'reports' ? 'Reports awaiting review' : 'Forum topics'} action={<button className="admin-btn" disabled={loading || busy} onClick={refresh}>↻ {tx('Refresh')}</button>}>
    <Notice error>{error ? tx('Could not load this section. Please retry.') : actionError}</Notice>
    {loading ? <Skeleton /> : error && !data ? <button className="admin-btn" onClick={refresh}>{tx('Retry')}</button> : !data?.rows.length ? <Empty>{tx(filter === 'reports' ? 'No unresolved reports.' : 'Nothing here yet.')}</Empty> : <div className="admin-stack">{data.rows.map(row => {
      const topic = filter === 'reports' ? row.topic : row;
      return <article className="admin-topic" key={row.id}><div className="admin-row-between"><Link className="admin-text-link" to={forumTopicPath(topic || { id: row.topic_id })}>{topic?.title || tx('Topic unavailable')}</Link><small><DateLabel value={row.created_at} /></small></div>
        {filter === 'reports' ? <><p className="admin-report-reason">{row.reason}</p>{row.post && <blockquote>{row.post.body}</blockquote>}<div className="admin-actions"><button disabled={busy || Boolean(row.post ? row.post.hidden : topic?.hidden)} className="admin-btn" onClick={() => act(row.post ? 'hide_post' : 'moderate_topic', { topic_id: row.topic_id, post_id: row.post_id, hidden: true })}>{tx(row.post ? 'Hide reply' : 'Hide topic')}</button><button disabled={busy} className="admin-btn primary" onClick={() => act('resolve_report', { id: row.id })}>{tx('Resolve report')}</button></div></> : <><div className="admin-tags"><span>{tx(forumCategory(row.category).label)}</span><span>{String(row.language || 'en').toUpperCase()}</span><span>{row.reply_count} {tx('replies')}</span>{row.hidden && <span>{tx('Hidden')}</span>}</div><div className="admin-actions">{[['pinned', 'Pin topic', 'Unpin topic'], ['locked', 'Close topic', 'Reopen topic'], ['hidden', 'Hide topic', 'Restore topic']].map(([field, off, on]) => <button key={field} disabled={busy} className="admin-btn" onClick={() => act('moderate_topic', { topic_id: row.id, [field]: !row[field] })}>{tx(row[field] ? on : off)}</button>)}</div></>}
      </article>;
    })}</div>}
    {data && <Pager page={page} total={data.count} pageSize={20} onChange={setPage} />}
  </Panel>;
}
const EMPTY_NEWS = { title: '', slug: '', summary: '', body: '', category: 'general', image_url: '', is_featured: false, is_published: false };
export function NewsPanel() {
  const [params, update] = useAdminQuery();
  const page = pageIndex(params.get('n_page'));
  const setPage = value => update({ n_page: value });
  const selectedKey = params.get('n_edit');
  const [savedItem, setSavedItem] = useState(null);
  const [editorVersion, setEditorVersion] = useState(0);
  const selected = useMemo(() => savedItem && String(savedItem.id || 'new') === selectedKey ? savedItem : selectedKey === 'new' ? { ...EMPTY_NEWS } : selectedKey ? { id: selectedKey } : null, [savedItem, selectedKey]);
  const setSelected = row => { setEditorVersion(version => version + 1); setSavedItem(row); update({ n_edit: row ? row.id || 'new' : null }); };
  const [revision, setRevision] = useState(0);
  return <div className="admin-stack"><NewsRows key={`${page}:${revision}`} page={page} setPage={setPage} onSelect={row => { if (!document.querySelector('[data-admin-dirty="true"]') || window.confirm(tx('Discard unsaved changes?'))) setSelected(row); }} />{selected && <NewsEditor key={`${selected.id || 'new'}:${editorVersion}`} item={selected} onSaved={row => { setSelected(row); setRevision(value => value + 1); }} onClose={() => setSelected(null)} />}</div>;
}
function NewsRows({ page, setPage, onSelect }) {
  const api = useAdminData();
  const loader = useCallback(options => api.loadNews({ page, ...options }), [api, page]);
  const { data, loading, error, refresh } = useAdminResource(loader);
  return <Panel title="Newsroom" description="Write drafts and manage published articles." action={<div className="admin-actions"><button className="admin-btn" aria-label={tx('Refresh')} disabled={loading} onClick={refresh}>↻</button><button className="admin-btn primary" onClick={() => onSelect({ ...EMPTY_NEWS })}>+ {tx('New article')}</button></div>}>
    <Notice error>{error && tx('Could not load this section. Please retry.')}</Notice>{loading ? <Skeleton /> : error && !data ? <button className="admin-btn" onClick={refresh}>{tx('Retry')}</button> : !data?.rows.length ? <Empty /> : data.rows.map(row => <div className="admin-list-row" key={row.id}><div><strong>{row.title}</strong><small><DateLabel value={row.updated_at} /></small></div><span className={`admin-badge ${row.is_published ? 'good' : ''}`}>{tx(row.is_published ? 'Published' : 'Draft')}</span><button className="admin-btn" onClick={() => onSelect(row)}>{tx('Edit')}</button></div>)}{data && <Pager page={page} total={data.count} pageSize={20} onChange={setPage} />}
  </Panel>;
}
function NewsEditor({ item, onSaved, onClose }) {
  const api = useAdminData();
  const loader = useCallback(options => item.id ? api.loadArticle({ id: item.id, ...options }) : Promise.resolve(item), [api, item]);
  const resource = useAdminResource(loader);
  return <Panel title={item.id ? 'Edit article' : 'New article'} action={<button className="admin-btn" onClick={() => { if (!document.querySelector('[data-admin-dirty="true"]') || window.confirm(tx('Discard unsaved changes?'))) onClose(); }}>{tx('Close')}</button>}><Notice error>{resource.error && tx('Could not load this section. Please retry.')}</Notice>{resource.error && !resource.data ? <button className="admin-btn" onClick={resource.refresh}>{tx('Retry')}</button> : resource.data ? <NewsForm key={resource.data.updated_at || 'new'} item={resource.data} onSaved={onSaved} /> : <Empty>{tx('Loading...')}</Empty>}</Panel>;
}
function NewsForm({ item, onSaved }) {
  const api = useAdminData();
  const [draft, setDraft] = useState(item);
  const dirty = JSON.stringify(draft) !== JSON.stringify(item);
  useUnsavedChanges(dirty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  async function save(event) {
    event.preventDefault(); setBusy(true); setError(''); setSaved(false);
    try {
      if (api.preview) { setError(tx('Preview only. Nothing was saved.')); return; }
      const data = await api.saveArticle(item, draft);
      setSaved(true); onSaved(data);
    } catch (error) { setError(tx(['Use a valid HTTP or HTTPS URL.', 'This article changed. Close and reopen it before saving.'].includes(error.message) ? error.message : 'Could not save changes. Please try again.')); }
    finally { setBusy(false); }
  }
  return <div className="admin-news-layout"><form className="admin-stack" onSubmit={save} data-admin-dirty={dirty ? 'true' : undefined}>
    {dirty && <div className="admin-draft-indicator">● {tx('Unsaved changes')}</div>}<fieldset disabled={busy} className="admin-stack admin-editor">
    <Notice error>{error}</Notice><Notice>{saved && tx('Changes saved.')}</Notice>
    {['title', 'slug', 'summary', 'category', 'image_url'].map(field => <label className="admin-field" key={field}>{tx({ title: 'Title', slug: 'URL slug', summary: 'Summary', category: 'Category', image_url: 'Image URL' }[field])}<input required={['title', 'slug'].includes(field)} type={field === 'image_url' ? 'url' : 'text'} pattern={field === 'slug' ? '[a-z0-9]+(-[a-z0-9]+)*' : undefined} maxLength={field === 'summary' ? 2000 : 500} value={draft[field] || ''} onChange={event => setDraft({ ...draft, [field]: event.target.value })} /></label>)}
    <label className="admin-field">{tx('Article text')}<textarea required rows={12} maxLength={100000} value={draft.body || ''} onChange={event => setDraft({ ...draft, body: event.target.value })} /></label>
    <div className="admin-actions"><label className="admin-check"><input type="checkbox" checked={draft.is_featured} onChange={event => setDraft({ ...draft, is_featured: event.target.checked })} />{tx('Featured article')}</label><label className="admin-check"><input type="checkbox" checked={draft.is_published} onChange={event => setDraft({ ...draft, is_published: event.target.checked })} />{tx('Publish on site')}</label></div>
    <button disabled={busy} className="admin-btn primary">{tx(busy ? 'Saving...' : 'Save article')}</button>
    </fieldset></form><aside className="admin-article-preview"><div className="admin-eyebrow">{tx('Article preview')}</div><span className="admin-badge">{tx(draft.is_published ? 'Published' : 'Draft')}</span>{safeWebUrl(draft.image_url) && <img src={safeWebUrl(draft.image_url)} alt="" />}<h2>{draft.title || tx('Title')}</h2>{draft.summary && <p className="admin-article-summary">{draft.summary}</p>}<div>{draft.body || tx('Article text')}</div></aside></div>;
}
