import { favoriteTeamByKey } from '../utils/favoriteTeams.js';
import { useCallback, useMemo, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { FiGrid, FiUsers, FiShield, FiFileText, FiActivity, FiArrowUpRight, FiRefreshCw, FiChevronRight } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext.jsx';
import { supabase } from '../lib/supabaseClient.js';
import { useTeamCatalog } from '../hooks/useTeamCatalog.js';
import { tx } from '../i18n/translate.js';
import { currentLocale } from '../i18n/languages.js';
import { adminSection, filterAdminTeams, workerHealth } from '../utils/adminWorkspace.js';
import { useAdminResource, requireData } from '../components/admin/useAdminResource.js';
import { Panel, Notice, Empty, Search, Pager, DateLabel } from '../components/admin/AdminUI.jsx';
import TeamEditor from '../components/admin/TeamEditor.jsx';
import TrafficPanel from '../components/admin/TrafficPanel.jsx';
import { ForumPanel, NewsPanel } from '../components/admin/CommunityPanels.jsx';
import CountryFlag from '../components/CountryFlag.jsx';
import Link from '../components/SiteLink.jsx';
import '../components/admin/admin.css';
const SECTIONS = [
  { id: 'overview', label: 'Overview', icon: FiGrid, description: 'Your site at a glance.' },
  { id: 'traffic', label: 'Site traffic', icon: FiActivity, description: 'Live visitors and daily audience.' },
  { id: 'users', label: 'Users', icon: FiUsers, description: 'Community accounts and favorite teams.' },
  { id: 'teams', label: 'Teams', icon: FiShield, description: 'Descriptions, social links and player photos.' },
  { id: 'forum', label: 'Forum', icon: FiShield, description: 'Reports, discussions and moderation.' },
  { id: 'news', label: 'News', icon: FiFileText, description: 'Drafts, articles and featured stories.' },
  { id: 'system', label: 'System', icon: FiActivity, description: 'Match updates and background processing.' },
];
const EMPTY = {};
const number = value => value == null ? '—' : Number(value).toLocaleString(currentLocale());
export default function AdminPage() {
  const { profile, loading } = useAuth();
  if (loading) return <main className="admin-workspace"><Empty>{tx('Loading...')}</Empty></main>;
  if (!profile?.is_admin) return <Navigate to="/" replace />;
  return <AdminWorkspace />;
}
function AdminWorkspace() {
  const { teams } = useTeamCatalog();
  const [params, setParams] = useSearchParams();
  const section = adminSection(params.get('section'));
  const current = SECTIONS.find(row => row.id === section);
  const load = useCallback(async () => requireData(await supabase.rpc('admin_overview')), []);
  const { data, error, loading, refresh } = useAdminResource(load);
  const snapshot = data || EMPTY;
  const navigate = id => { const next = new URLSearchParams(params); next.set('section', id); setParams(next); };
  return <main className="admin-workspace"><div className="admin-frame">
    <aside className="admin-sidebar"><Link to="/admin" className="admin-brand"><span>ET<span> / </span>CONTROL</span><small>ESEA TRACKER</small></Link>
      <div className="admin-nav-label">{tx('Workspace')}</div><nav aria-label={tx('Admin navigation')}>{SECTIONS.map(({ id, label, icon: Icon }) => <button key={id} aria-current={id === section ? 'page' : undefined} onClick={() => navigate(id)}><Icon /><span>{tx(label)}</span>{id === 'forum' && snapshot.reports > 0 && <b>{snapshot.reports}</b>}{id === section && <FiChevronRight className="admin-nav-arrow" />}</button>)}</nav>
      <div className="admin-sidebar-bottom"><span className="admin-badge good">{tx('Administrator')}</span><p>{tx('Manage content and keep the community running.')}</p><Link to="/">{tx('Open site')} <FiArrowUpRight /></Link></div>
    </aside>
    <div className="admin-main"><header className="admin-header"><div><div className="admin-eyebrow">ESEA TRACKER <span>/ {tx('Administration')}</span></div><h1>{tx(current.label)}</h1><p>{tx(current.description)}</p></div><div className="admin-header-actions"><div className="admin-updated">{tx('Snapshot updated')}<small><DateLabel value={snapshot.generated_at} /></small></div><button className="admin-btn" disabled={loading} onClick={refresh}><FiRefreshCw className={loading ? 'admin-spin' : ''} />{tx('Refresh overview')}</button></div></header>
      <nav className="admin-mobile-nav" aria-label={tx('Admin navigation')}>{SECTIONS.map(({ id, label }) => <button key={id} aria-current={id === section ? 'page' : undefined} onClick={() => navigate(id)}>{tx(label)}</button>)}</nav>
      <div className="admin-content"><Notice error>{error && tx('Could not load overview. Other sections remain available.')}</Notice>
        {section === 'overview' && <Overview snapshot={snapshot} loading={loading} navigate={navigate} />}
        {section === 'traffic' && <TrafficPanel />}
        {section === 'users' && <Users teams={teams} />}
        {section === 'teams' && <Teams teams={teams} />}
        {section === 'forum' && <ForumPanel />}
        {section === 'news' && <NewsPanel />}
        {section === 'system' && <System snapshot={snapshot} loading={loading} />}
      </div><footer className="admin-footer">ESEA Tracker <span>•</span> {tx('Admin workspace')}</footer>
    </div>
  </div></main>;
}
function Overview({ snapshot, loading, navigate }) {
  const metrics = [['Users', snapshot.users, 'users', 'Registered accounts'], ['Favorite teams', snapshot.favorites, 'users', 'Users supporting a team'], ['Upcoming matches', snapshot.upcoming, 'system', 'Scheduled and ready matches'], ['Open reports', snapshot.reports, 'forum', 'Waiting for moderation']];
  return <div className="admin-stack"><section className="admin-welcome"><div><div className="admin-eyebrow">{tx('Control room')}</div><h2>{tx('Everything in one place.')}</h2><p>{tx('Review activity, update team pages and manage the community.')}</p></div><div className="admin-welcome-mark" aria-hidden="true"><FiActivity /></div></section>
    <TrafficPanel compact onOpen={() => navigate('traffic')} />
    <div className="admin-metrics">{metrics.map(([label, value, section, hint]) => <button key={label} className="admin-metric" onClick={() => navigate(section)}><span>{tx(label)} <FiArrowUpRight /></span><strong>{loading && value == null ? '…' : number(value)}</strong><small>{tx(hint)}</small></button>)}</div>
    <div className="admin-overview-grid"><Panel title="Quick actions" description="Go directly to the tools you need."><div className="admin-quick-grid">{SECTIONS.slice(1).map(({ id, icon: Icon, label, description }) => <button key={id} onClick={() => navigate(id)}><Icon /><strong>{tx(label)}</strong><small>{tx(description)}</small><FiArrowUpRight /></button>)}</div></Panel><Panel title="Community pulse"><dl className="admin-summary">{[['New users this week', snapshot.new_users], ['Forum topics', snapshot.topics], ['Published articles', snapshot.published_news], ['Live matches', snapshot.live], ['Teams in catalog', snapshot.teams]].map(([label, value]) => <div key={label}><dt>{tx(label)}</dt><dd>{number(value)}</dd></div>)}</dl><div className="admin-info">{tx('Everyone can choose a favorite team in profile settings. Player verification is no longer used.')}</div></Panel></div>
    <Workers workers={snapshot.workers} loading={loading} compact />
  </div>;
}
function Users({ teams }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [committed, setCommitted] = useState('');
  return <Panel title="Community accounts" description="Profiles, registration dates and favorite teams.">
    <form className="admin-toolbar" onSubmit={event => { event.preventDefault(); setCommitted(search); setPage(0); }}><Search value={search} onChange={setSearch} label="Search username or display name" /><button className="admin-btn" type="submit">{tx('Search')}</button><select aria-label={tx('Filter users')} value={filter} onChange={event => { setFilter(event.target.value); setPage(0); }}>{[['all', 'All users'], ['favorites', 'With favorite team'], ['none', 'No favorite team'], ['admins', 'Administrators']].map(([value, label]) => <option key={value} value={value}>{tx(label)}</option>)}</select></form>
    <UserRows key={`${page}:${filter}:${committed}`} page={page} setPage={setPage} filter={filter} search={committed} teams={teams} />
  </Panel>;
}
function UserRows({ page, setPage, filter, search, teams }) {
  const loader = useCallback(async () => {
    let query = supabase.from('profiles').select('id,username,display_name,avatar_url,country_code,favorite_team_slug,is_admin,created_at', { count: 'exact' }).order('created_at', { ascending: false }).order('id');
    const value = search.replace(/[^\p{L}\p{N}_ -]/gu, '').trim().slice(0, 100).replaceAll('_', '\\_');
    if (value) query = query.or(`username.ilike.%${value}%,display_name.ilike.%${value}%`);
    if (filter === 'favorites') query = query.not('favorite_team_slug', 'is', null).neq('favorite_team_slug', '');
    if (filter === 'none') query = query.or('favorite_team_slug.is.null,favorite_team_slug.eq.');
    if (filter === 'admins') query = query.eq('is_admin', true);
    const response = await query.range(page * 25, page * 25 + 24);
    requireData(response); return { rows: response.data, count: response.count };
  }, [page, filter, search]);
  const { data, loading, error, refresh } = useAdminResource(loader);
  if (error) return <><Notice error>{tx('Could not load this section. Please retry.')}</Notice><button className="admin-btn" onClick={refresh}>{tx('Retry')}</button></>;
  return <>{loading ? <Empty>{tx('Loading...')}</Empty> : !data?.rows.length ? <Empty>{tx('No users match these filters.')}</Empty> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr>{['User', 'Country', 'Favorite team', 'Access', 'Registered'].map(label => <th key={label}>{tx(label)}</th>)}</tr></thead><tbody>{data.rows.map(row => {
    const favorite = favoriteTeamByKey(teams, row.favorite_team_slug);
    return <tr key={row.id}><td><Link to={`/profile/${encodeURIComponent(row.username)}`} className="admin-user"><span className="admin-avatar">{row.avatar_url ? <img src={row.avatar_url} alt="" loading="lazy" /> : (row.display_name || row.username).slice(0, 2).toUpperCase()}</span><span><strong>{row.display_name || row.username}</strong><small>@{row.username}</small></span></Link></td><td>{row.country_code ? <CountryFlag country={row.country_code} /> : '—'}</td><td>{favorite ? <Link className="admin-text-link" to={`/teams/${favorite.slug}`}>{favorite.name}</Link> : row.favorite_team_slug || '—'}</td><td><span className={`admin-badge ${row.is_admin ? 'accent' : ''}`}>{tx(row.is_admin ? 'Administrator' : 'Member')}</span></td><td><DateLabel value={row.created_at} /></td></tr>;
  })}</tbody></table></div>}{data && <Pager page={page} total={data.count} pageSize={25} onChange={setPage} />}</>;
}
function Teams({ teams }) {
  const sortedTeams = useMemo(() => [...teams].sort((a, b) => a.name.localeCompare(b.name)), [teams]);
  const [query, setQuery] = useState('');
  const [division, setDivision] = useState('all');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState(null);
  const filtered = useMemo(() => filterAdminTeams(sortedTeams, query, division), [sortedTeams, query, division]);
  const divisions = useMemo(() => [...new Set(teams.map(team => team.division).filter(Boolean))].sort(), [teams]);
  return <div className="admin-team-layout"><Panel title="Team directory" description="Select a team to edit its page."><div className="admin-stack"><Search value={query} onChange={value => { setQuery(value); setPage(0); }} label="Search teams" /><select aria-label={tx('Division')} value={division} onChange={event => { setDivision(event.target.value); setPage(0); }}><option value="all">{tx('All divisions')}</option>{divisions.map(value => <option key={value}>{value}</option>)}</select><div className="admin-team-list">{filtered.slice(page * 15, page * 15 + 15).map(team => <button key={team.slug} aria-pressed={selected?.slug === team.slug} onClick={() => setSelected(team)}><span className="admin-team-logo">{team.logo ? <img src={team.logo} alt="" loading="lazy" /> : <FiShield />}</span><span><strong>{team.name}</strong><small>{team.division || '—'}</small></span><FiChevronRight /></button>)}{!filtered.length && <Empty>{tx('No teams found.')}</Empty>}</div></div><Pager page={page} total={filtered.length} pageSize={15} onChange={setPage} /></Panel><div>{selected ? <TeamEditor key={selected.slug} team={selected} /> : <Panel title="Team editor"><Empty>{tx('Choose a team from the directory to start editing.')}</Empty></Panel>}</div></div>;
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
