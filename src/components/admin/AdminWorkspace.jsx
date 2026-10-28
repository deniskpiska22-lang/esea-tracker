import { favoriteTeamByKey } from '../../utils/favoriteTeams.js';
import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FiCommand, FiExternalLink, FiMessageSquare, FiCheckCircle, FiAlertCircle, FiGrid, FiUsers, FiShield, FiFileText, FiActivity, FiArrowUpRight, FiRefreshCw, FiChevronRight } from 'react-icons/fi';
import { tx, tf } from '../../i18n/translate.js';
import { currentLocale } from '../../i18n/languages.js';
import { adminSection, filterAdminTeams, workerHealth } from '../../utils/adminWorkspace.js';
import { useAdminResource } from './useAdminResource.js';
import { Panel, Notice, Empty, Search, Pager, DateLabel, Skeleton } from './AdminUI.jsx';
import TeamEditor from './TeamEditor.jsx';
import TrafficPanel from './TrafficPanel.jsx';
import DemoUploadsPanel from './DemoUploadsPanel.jsx';
import { ForumPanel, NewsPanel } from './CommunityPanels.jsx';
import CountryFlag from '../CountryFlag.jsx';
import Link from '../SiteLink.jsx';
import './admin.css';
import { useAdminData } from './adminDataContext.js';
import { useAdminQuery, pageIndex } from './useAdminQuery.js';
const SECTIONS = [
  { id: 'overview', label: 'Overview', icon: FiGrid, description: 'Your site at a glance.' },
  { id: 'traffic', label: 'Site traffic', icon: FiActivity, description: 'Live visitors and daily audience.' },
  { id: 'users', label: 'Users', icon: FiUsers, description: 'Community accounts and favorite teams.' },
  { id: 'teams', label: 'Teams', icon: FiShield, description: 'Descriptions, social links and player photos.' },
  { id: 'forum', label: 'Forum', icon: FiMessageSquare, description: 'Reports, discussions and moderation.' },
  { id: 'news', label: 'News', icon: FiFileText, description: 'Drafts, articles and featured stories.' },
  { id: 'demos', label: 'Demos', icon: FiFileText, description: 'Pistol rounds and CT/T statistics from match demos.' },
  { id: 'system', label: 'System', icon: FiActivity, description: 'Match updates and background processing.' },
];
const EMPTY = {};
const number = value => value == null ? '—' : Number(value).toLocaleString(currentLocale());
export default function AdminWorkspace({ teams, profile, preview = false }) {
  const [params, setParams] = useSearchParams();
  const section = adminSection(params.get('section'));
  const current = SECTIONS.find(row => row.id === section);
  const api = useAdminData();
  const load = useCallback(options => api.loadOverview(options), [api]);
  const { data, error, loading, refreshing, refresh } = useAdminResource(load, { pollMs: section === 'overview' || section === 'system' ? 60_000 : 0 });
  const snapshot = data || EMPTY;
  const navigate = id => { if (document.querySelector('[data-admin-dirty="true"]') && !window.confirm(tx('Discard unsaved changes?'))) return; const next = new URLSearchParams(params); next.set('section', id); setParams(next); };
  const groups = [['Analytics', ['overview', 'traffic']], ['Management', ['users', 'teams', 'forum', 'news']], ['Operations', ['demos', 'system']]];
  const unhealthy = (snapshot.workers || []).filter(worker => ['stale', 'error'].includes(workerHealth(worker))).length;
  return <main className="admin-workspace"><div className="admin-frame">
    <aside className="admin-sidebar"><Link to={preview ? '/admin/preview' : '/admin'} className="admin-brand"><span className="admin-brand-icon">ET<span>↗</span></span><span>ESEA Tracker<small>{tx('Admin workspace')}</small></span></Link>
      {groups.map(([label, ids]) => <div className="admin-nav-group" key={label}><div className="admin-nav-label">{tx(label)}</div><nav aria-label={tx(label)}>{SECTIONS.filter(item => ids.includes(item.id)).map(({ id, label, icon: Icon }) => <button key={id} aria-current={id === section ? 'page' : undefined} onClick={() => navigate(id)}><Icon /><span>{tx(label)}</span>{id === 'forum' && snapshot.reports > 0 && <b>{number(snapshot.reports)}</b>}{id === 'system' && unhealthy > 0 && <b>{unhealthy}</b>}</button>)}</nav></div>)}
      <div className="admin-sidebar-bottom"><Link to="/" target="_blank" rel="noopener noreferrer"><FiExternalLink />{tx('Open site')}<span>↗</span></Link><div className="admin-identity"><span className="admin-avatar">{(profile?.display_name || profile?.username || 'ET').slice(0, 2).toUpperCase()}</span><span><strong>{profile?.display_name || profile?.username || 'ESEA Tracker'}</strong><small>{tx(preview ? 'Preview' : 'Administrator')}</small></span><FiCheckCircle /></div></div>
    </aside>
    <div className="admin-main"><div className="admin-topbar"><span>{tx('Workspace')} <span>/</span> <b>{tx(current.label)}</b></span><div><span className="admin-badge"><span className="admin-status-dot online" />{tx(preview ? 'Sample data' : 'Administrator')}</span><Link to={preview ? '/admin' : '/admin/preview'}>{tx(preview ? 'Open admin' : 'Preview')}<FiExternalLink /></Link></div></div>
      {preview && <div className="admin-preview-notice"><FiCommand /><strong>{tx('Preview')}</strong><span>{tx('Sample data. Changes are not saved and no live admin requests are made.')}</span></div>}
      <header className="admin-header"><div><div className="admin-eyebrow">{tx('Administration')}</div><h1>{tx(current.label)}</h1><p>{tx(current.description)}</p></div><div className="admin-header-actions"><div className="admin-updated">{tx('Snapshot updated')}<small><DateLabel value={snapshot.generated_at} /></small></div><button className="admin-btn" disabled={refreshing} onClick={refresh}><FiRefreshCw className={refreshing ? 'admin-spin' : ''} />{tx('Refresh overview')}</button></div></header>
      <nav className="admin-mobile-nav" aria-label={tx('Admin navigation')}>{SECTIONS.map(({ id, label }) => <button key={id} aria-current={id === section ? 'page' : undefined} onClick={() => navigate(id)}>{tx(label)}</button>)}</nav>
      <div className="admin-content"><Notice error>{error && tx('Could not load overview. Other sections remain available.')}</Notice>
        {section === 'overview' && <Overview snapshot={snapshot} loading={loading} navigate={navigate} />}
        {section === 'traffic' && <TrafficPanel />}
        {section === 'users' && <Users teams={teams} />}
        {section === 'teams' && <Teams teams={teams} />}
        {section === 'forum' && <ForumPanel />}
        {section === 'news' && <NewsPanel />}
        {section === 'demos' && <DemoUploadsPanel />}
        {section === 'system' && <System snapshot={snapshot} loading={loading} />}
      </div><footer className="admin-footer"><span>ESEA Tracker <span> / </span> {tx('Admin workspace')}</span><span>{tx(preview ? 'Sample data' : 'Administrator')}</span></footer>
    </div>
  </div></main>;
}
function Overview({ snapshot, loading, navigate }) {
  const metrics = [['Users', snapshot.users, 'users', 'Registered accounts'], ['Favorite teams', snapshot.favorites, 'users', 'Users supporting a team'], ['Upcoming matches', snapshot.upcoming, 'system', 'Scheduled and ready matches'], ['Open reports', snapshot.reports, 'forum', 'Waiting for moderation']];
  const attention = (snapshot.workers || []).filter(worker => ['stale', 'error'].includes(workerHealth(worker))).length;
  return <div className="admin-stack">{(snapshot.reports > 0 || attention > 0) && <div className="admin-attention"><FiAlertCircle /><div><strong>{tx('Needs attention')}</strong><span>{tf('{0} open reports · {1} workers to review', snapshot.reports || 0, attention)}</span></div><button className="admin-btn" onClick={() => navigate(snapshot.reports > 0 ? 'forum' : 'system')}>{tx('Review')} ↗</button></div>}
    <TrafficPanel compact onOpen={() => navigate('traffic')} />
    <div className="admin-section-heading"><h2>{tx('Community pulse')}</h2></div><div className="admin-metrics">{metrics.map(([label, value, section, hint]) => <button key={label} className="admin-metric" onClick={() => navigate(section)}><span>{tx(label)} <FiArrowUpRight /></span><strong>{loading && value == null ? '…' : number(value)}</strong><small>{tx(hint)}</small></button>)}</div>
    <div className="admin-overview-grid"><Panel title="Quick actions" description="Go directly to the tools you need."><div className="admin-quick-grid">{SECTIONS.slice(1).map(({ id, icon: Icon, label, description }) => <button key={id} onClick={() => navigate(id)}><Icon /><strong>{tx(label)}</strong><small>{tx(description)}</small><FiArrowUpRight /></button>)}</div></Panel><Panel title="Community pulse"><dl className="admin-summary">{[['New users this week', snapshot.new_users], ['Forum topics', snapshot.topics], ['Published articles', snapshot.published_news], ['Live matches', snapshot.live], ['Teams in catalog', snapshot.teams]].map(([label, value]) => <div key={label}><dt>{tx(label)}</dt><dd>{number(value)}</dd></div>)}</dl></Panel></div>
    <Workers workers={snapshot.workers} loading={loading} compact />
  </div>;
}
function Users({ teams }) {
  const [params, update] = useAdminQuery();
  const committed = params.get('u_q') || '';
  const [search, setSearch] = useState(committed);
  const filter = ['all', 'favorites', 'none', 'admins'].includes(params.get('u_filter')) ? params.get('u_filter') : 'all';
  const page = pageIndex(params.get('u_page'));
  const setPage = value => update({ u_page: value });
  return <Panel title="Community accounts" description="Profiles, registration dates and favorite teams.">
    <form className="admin-toolbar" onSubmit={event => { event.preventDefault(); update({ u_q: search.trim(), u_page: 0 }); }}><Search value={search} onChange={setSearch} label="Search username or display name" /><button className="admin-btn" type="submit">{tx('Search')}</button><select aria-label={tx('Filter users')} value={filter} onChange={event => { update({ u_filter: event.target.value, u_page: 0 }); }}>{[['all', 'All users'], ['favorites', 'With favorite team'], ['none', 'No favorite team'], ['admins', 'Administrators']].map(([value, label]) => <option key={value} value={value}>{tx(label)}</option>)}</select></form>
    <UserRows key={`${page}:${filter}:${committed}`} page={page} setPage={setPage} filter={filter} search={committed} teams={teams} />
  </Panel>;
}
function UserRows({ page, setPage, filter, search, teams }) {
  const api = useAdminData();
  const loader = useCallback(options => api.loadUsers({ page, filter, search, ...options }), [api, page, filter, search]);
  const { data, loading, error, refresh } = useAdminResource(loader);
  if (error) return <><Notice error>{tx('Could not load this section. Please retry.')}</Notice><button className="admin-btn" onClick={refresh}>{tx('Retry')}</button></>;
  return <>{loading ? <Skeleton rows={6} /> : !data?.rows.length ? <Empty>{tx('No users match these filters.')}</Empty> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr>{['User', 'Country', 'Favorite team', 'Access', 'Registered'].map(label => <th key={label}>{tx(label)}</th>)}</tr></thead><tbody>{data.rows.map(row => {
    const favorite = favoriteTeamByKey(teams, row.favorite_team_slug);
    return <tr key={row.id}><td><Link to={`/profile/${encodeURIComponent(row.username)}`} className="admin-user"><span className="admin-avatar">{row.avatar_url ? <img src={row.avatar_url} alt="" loading="lazy" /> : (row.display_name || row.username).slice(0, 2).toUpperCase()}</span><span><strong>{row.display_name || row.username}</strong><small>@{row.username}</small></span></Link></td><td>{row.country_code ? <CountryFlag country={row.country_code} /> : '—'}</td><td>{favorite ? <Link className="admin-text-link" to={`/teams/${favorite.slug}`}>{favorite.name}</Link> : row.favorite_team_slug || '—'}</td><td><span className={`admin-badge ${row.is_admin ? 'accent' : ''}`}>{tx(row.is_admin ? 'Administrator' : 'Member')}</span></td><td><DateLabel value={row.created_at} /></td></tr>;
  })}</tbody></table></div>}{data && <Pager page={page} total={data.count} pageSize={25} onChange={setPage} />}</>;
}
function Teams({ teams }) {
  const sortedTeams = useMemo(() => [...teams].sort((a, b) => a.name.localeCompare(b.name)), [teams]);
  const [params, update] = useAdminQuery();
  const query = params.get('t_q') || '', division = params.get('t_division') || 'all';
  const page = pageIndex(params.get('t_page'));
  const selected = teams.find(team => (team.faceitTeamId || team.slug) === params.get('t_team')) || null;
  const setPage = value => update({ t_page: value });
  const filtered = useMemo(() => filterAdminTeams(sortedTeams, query, division), [sortedTeams, query, division]);
  const divisions = useMemo(() => [...new Set(teams.map(team => team.division).filter(Boolean))].sort(), [teams]);
  return <div className="admin-team-layout"><Panel title="Team directory" description="Select a team to edit its page."><div className="admin-stack"><Search value={query} onChange={value => { update({ t_q: value, t_page: 0 }); }} label="Search teams" /><select aria-label={tx('Division')} value={division} onChange={event => { update({ t_division: event.target.value, t_page: 0 }); }}><option value="all">{tx('All divisions')}</option>{divisions.map(value => <option key={value}>{value}</option>)}</select><div className="admin-team-list">{filtered.slice(page * 15, page * 15 + 15).map(team => <button key={team.slug} aria-pressed={selected?.slug === team.slug} onClick={() => { if (!document.querySelector('[data-admin-dirty="true"]') || window.confirm(tx('Discard unsaved changes?'))) update({ t_team: team.faceitTeamId || team.slug }); }}><span className="admin-team-logo">{team.logo ? <img src={team.logo} alt="" loading="lazy" /> : <FiShield />}</span><span><strong>{team.name}</strong><small>{team.division || '—'}</small></span><FiChevronRight /></button>)}{!filtered.length && <Empty>{tx('No teams found.')}</Empty>}</div></div><Pager page={page} total={filtered.length} pageSize={15} onChange={setPage} /></Panel><div>{selected ? <TeamEditor key={selected.slug} team={selected} /> : <Panel title="Team editor"><Empty>{tx('Choose a team from the directory to start editing.')}</Empty></Panel>}</div></div>;
}
function Workers({ workers, loading, compact = false }) {
  return <Panel title="Background updates" description="Heartbeat status from the update workers.">{!workers ? <Empty>{tx(loading ? 'Loading...' : 'Status unavailable')}</Empty> : !workers.length ? <Empty>{tx('No worker heartbeats received yet.')}</Empty> : <div className="admin-worker-list">{workers.map(worker => {
    const health = workerHealth(worker);
    return <div className="admin-worker" key={worker.worker_name}><div className={`admin-status-dot ${health}`} /><div><strong>{worker.worker_name}</strong><small>{tx('Last heartbeat')}: <DateLabel value={worker.last_ping} /></small>{!compact && <p>{worker.detail || '—'}</p>}</div><span className={`admin-badge ${health === 'online' ? 'good' : health === 'stale' || health === 'error' ? 'warning' : ''}`}>{tx({ online: 'Online', stale: 'Heartbeat overdue', paused: 'Paused', error: 'Error', unknown: 'Unknown' }[health])}</span></div>;
  })}</div>}</Panel>;
}
function System({ snapshot, loading }) {
  return <div className="admin-stack"><Workers workers={snapshot.workers} loading={loading} /><div className="admin-overview-grid"><Panel title="Statistics queue" description="Counts are refreshed with the overview."><dl className="admin-summary">{(snapshot.stat_jobs || []).map(row => <div key={row.status}><dt>{tx(row.status)}</dt><dd>{number(row.count)}</dd></div>)}</dl>{!snapshot.stat_jobs?.length && <Empty>{tx('No queue data available.')}</Empty>}</Panel><Panel title="Demo analysis"><dl className="admin-summary">{(snapshot.demo_jobs || []).map(row => <div key={row.status}><dt>{tx(row.status)}</dt><dd>{number(row.count)}</dd></div>)}</dl>{!snapshot.demo_jobs?.length && <Empty>{tx('No queue data available.')}</Empty>}<div className="admin-info">{tx('Demo processing needs download access from FACEIT. A paused worker does not mean match updates are stopped.')}</div></Panel></div><Panel title="Latest match data"><dl className="admin-summary"><div><dt>{tx('Latest stored match update')}</dt><dd><DateLabel value={snapshot.latest_match_update} /></dd></div><div><dt>{tx('Tracked matches')}</dt><dd>{number(snapshot.matches)}</dd></div><div><dt>{tx('Upcoming matches')}</dt><dd>{number(snapshot.upcoming)}</dd></div><div><dt>{tx('Live matches')}</dt><dd>{number(snapshot.live)}</dd></div></dl><Link to="/matches" className="admin-btn">{tx('Open upcoming matches')} ↗</Link></Panel></div>;
}
