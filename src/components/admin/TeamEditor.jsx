import { useEffect, useState } from 'react';
import { useAdminData } from './adminDataContext.js';
import { useUnsavedChanges } from './useUnsavedChanges.js';
import { tx } from '../../i18n/translate.js';
import { safeWebUrl } from '../../utils/adminWorkspace.js';
import { Panel, Notice, Empty } from './AdminUI.jsx';
import Link from '../SiteLink.jsx';
export default function TeamEditor({ team }) {
  const api = useAdminData();
  const [baseline, setBaseline] = useState(null);
  const teamId = team.faceitTeamId || team.faceit_team_id;
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    if (!teamId) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    api.loadTeam({ teamId, signal: controller.signal }).then(content => {
      if (active) { setDraft(content); setBaseline(content); }
    }).catch(() => { if (active) setError(tx('Could not load team content.')); }).finally(() => clearTimeout(timeout));
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [api, teamId, revision]);
  async function save(kind, player) {
    setBusy(true); setError(''); setMessage('');
    try {
      if (api.preview) { setMessage(tx('Preview only. Nothing was saved.')); return; }
      await api.saveTeam({ kind, teamId, draft, player });
      setBaseline(current => kind === 'description' ? { ...current, description: draft.description } : kind === 'links' ? { ...current, links: draft.links } : { ...current, players: current.players.map(row => row.id === player.id ? { ...player } : row) });
      setMessage(tx('Changes saved.'));
    } catch (error) { setError(tx(error.message === 'Use a valid HTTP or HTTPS URL.' ? error.message : 'Could not save changes. Please try again.')); }
    finally { setBusy(false); }
  }
  function editPlayer(id, patch) { setDraft(current => ({ ...current, players: current.players.map(row => row.id === id ? { ...row, ...patch } : row) })); }
  const dirty = Boolean(draft && baseline && JSON.stringify(draft) !== JSON.stringify(baseline));
  useUnsavedChanges(dirty);
  return <fieldset disabled={busy} className="admin-stack admin-editor" data-admin-dirty={dirty ? 'true' : undefined}><Panel title={team.name} description="Team content" action={<Link to={`/teams/${team.slug}`} target="_blank" rel="noopener noreferrer" className="admin-btn">{tx('Open profile')} ↗</Link>}>
    {dirty && <div className="admin-draft-indicator">● {tx('Unsaved changes')}</div>}<Notice error>{error}</Notice>{error && !draft && <button className="admin-btn" onClick={() => { setError(''); setRevision(value => value + 1); }}>{tx('Retry')}</button>}<Notice>{message}</Notice>
    {!draft ? <Empty>{error ? tx('Select another team or retry.') : tx('Loading...')}</Empty> : <div className="admin-stack">
      <label className="admin-field">{tx('Description')}<textarea rows={5} maxLength={20000} value={draft.description} onChange={event => setDraft({ ...draft, description: event.target.value })} /></label>
      <button disabled={busy} className="admin-btn primary" onClick={() => save('description')}>{tx('Save description')}</button>
    </div>}
  </Panel>{draft && <><Panel title="Social links" action={<button disabled={busy || draft.links.length >= 20} className="admin-btn" onClick={() => setDraft({ ...draft, links: [...draft.links, { platform: 'Website', url: '' }] })}>+ {tx('Add link')}</button>}>
    <div className="admin-stack">{!draft.links.length && <Empty>{tx('No social links added.')}</Empty>}{draft.links.map((link, index) => <div className="admin-social-row" key={index}>
      <input aria-label={tx('Platform')} value={link.platform} maxLength={50} onChange={event => setDraft({ ...draft, links: draft.links.map((row, i) => i === index ? { ...row, platform: event.target.value } : row) })} />
      <input aria-label={tx('URL')} type="url" placeholder="https://" value={link.url} onChange={event => setDraft({ ...draft, links: draft.links.map((row, i) => i === index ? { ...row, url: event.target.value } : row) })} />
      <button className="admin-btn" aria-label={tx('Remove link')} onClick={() => setDraft({ ...draft, links: draft.links.filter((_, i) => i !== index) })}>×</button>
    </div>)}<button disabled={busy} className="admin-btn primary" onClick={() => save('links')}>{tx('Save links')}</button></div>
  </Panel><Panel title="Player photos" description="Editorial photos for the active roster. This does not change user accounts.">
    <div className="admin-stack">{!draft.players.length && <Empty>{tx('No active players found.')}</Empty>}{draft.players.map(player => <div className="admin-photo-row" key={player.id}>
      <div className="admin-player-image">{safeWebUrl(player.url) ? <img src={safeWebUrl(player.url)} alt="" loading="lazy" /> : <span>◎</span>}</div>
      <label className="admin-field"><strong>{player.nickname}</strong><input aria-label={`${tx('Photo URL')}: ${player.nickname}`} type="url" placeholder="https://" value={player.url} onChange={event => editPlayer(player.id, { url: event.target.value })} /></label>
      <label className="admin-check"><input type="checkbox" checked={Boolean(player.official)} onChange={event => editPlayer(player.id, { official: event.target.checked })} />{tx('Official photo')}</label>
      <button disabled={busy} className="admin-btn" onClick={() => save('photo', player)}>{tx('Save')}</button>
    </div>)}</div>
  </Panel></> }</fieldset>;
}
