import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient.js';
import { tx } from '../../i18n/translate.js';
import { safeWebUrl, cleanSocialLinks } from '../../utils/adminWorkspace.js';
import { Panel, Notice, Empty } from './AdminUI.jsx';
import Link from '../SiteLink.jsx';
export default function TeamEditor({ team }) {
  const teamId = team.faceitTeamId || team.faceit_team_id;
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    if (!teamId) return;
    Promise.all([
      supabase.from('team_profiles').select('description,social_links').eq('team_id', teamId).maybeSingle(),
      supabase.from('team_players').select('player_id,official_photo_url,official_photo_verified,players!team_players_player_id_fkey(nickname,avatar)').eq('team_id', teamId).eq('is_active', true),
    ]).then(([content, roster]) => {
      if (!active) return;
      if (content.error || roster.error) { setError(tx('Could not load team content.')); return; }
      setDraft({ description: content.data?.description || '', links: content.data?.social_links || [], players: (roster.data || []).map(row => ({ id: row.player_id, nickname: (Array.isArray(row.players) ? row.players[0] : row.players)?.nickname || '—', url: row.official_photo_url || '', official: row.official_photo_verified })) });
    }).catch(() => { if (active) setError(tx('Could not load team content.')); });
    return () => { active = false; };
  }, [teamId, revision]);
  async function save(kind, player) {
    setBusy(true); setError(''); setMessage('');
    try {
      let response;
      if (kind === 'description') response = await supabase.rpc('upsert_team_profile', { p_team_id: teamId, p_description: draft.description.trim() || null });
      if (kind === 'links') response = await supabase.rpc('set_team_social_links', { p_team_id: teamId, p_social_links: cleanSocialLinks(draft.links) });
      if (kind === 'photo') {
        const url = safeWebUrl(player.url);
        if (url === null) throw new Error('Use a valid HTTP or HTTPS URL.');
        response = await supabase.rpc('set_official_team_photo', { p_team_id: teamId, p_player_id: player.id, p_photo_url: url || null, p_verified: Boolean(url && player.official) });
      }
      if (response.error) throw response.error;
      setMessage(tx('Changes saved.'));
    } catch (error) { setError(tx(error.message === 'Use a valid HTTP or HTTPS URL.' ? error.message : 'Could not save changes. Please try again.')); }
    finally { setBusy(false); }
  }
  function editPlayer(id, patch) { setDraft(current => ({ ...current, players: current.players.map(row => row.id === id ? { ...row, ...patch } : row) })); }
  return <div className="admin-stack"><Panel title={team.name} description="Team content" action={<Link to={`/teams/${team.slug}`} className="admin-btn">{tx('Open profile')} ↗</Link>}>
    <Notice error>{error}</Notice>{error && !draft && <button className="admin-btn" onClick={() => { setError(''); setRevision(value => value + 1); }}>{tx('Retry')}</button>}<Notice>{message}</Notice>
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
  </Panel></> }</div>;
}
