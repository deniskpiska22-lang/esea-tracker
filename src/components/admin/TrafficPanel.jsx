import { useCallback } from 'react';
import { FiActivity, FiArrowUpRight, FiRefreshCw, FiUsers, FiCalendar, FiBarChart2, FiMonitor, FiSmartphone } from 'react-icons/fi';
import { tx } from '../../i18n/translate.js';
import { currentLocale } from '../../i18n/languages.js';
import { formatUserDateTime } from '../../utils/userTime.js';
import { Panel, Notice, Empty, DateLabel, Skeleton } from './AdminUI.jsx';
import CountryFlag from '../CountryFlag.jsx';
import { countryName } from '../../utils/countries.js';
import Link from '../SiteLink.jsx';
import { useAdminData } from './adminDataContext.js';
import { useAdminResource } from './useAdminResource.js';
import { useAdminQuery } from './useAdminQuery.js';
import { TRAFFIC_PERIODS, trafficPeriod, trafficPeriodSummary, COUNTRY_PERIODS, countryPeriod, trafficCountries } from '../../utils/siteTraffic.js';
const format = value => Number(value).toLocaleString(currentLocale());
export default function TrafficPanel({ compact = false, onOpen }) {
  const api = useAdminData();
  const [params, updateParams] = useAdminQuery();
  const period = compact ? 7 : trafficPeriod(params.get('trafficDays'));
  const countryDays = countryPeriod(params.get('countryDays'));
  const load = useCallback(options => api.loadTraffic(options), [api]);
  const { data, error, loading, refreshing, refresh, checkedAt } = useAdminResource(load, { pollMs: 15_000 });
  const fresh = data && !error && checkedAt - Date.parse(data.generated_at) < 60_000;
  const summary = trafficPeriodSummary(data, period);
  const metrics = [['Online now', fresh ? data.online : null, 'Active in the last 3 minutes', FiActivity], ['Visitors today', data?.today, 'Unique browsers today', FiUsers], ['Visitors yesterday', data?.yesterday, 'Unique browsers yesterday', FiCalendar], ['Visitors in 7 days', data?.week, 'Deduplicated across days', FiBarChart2], ['Visitors in 30 days', data?.month, 'Deduplicated across days', FiCalendar]];
  const days = summary.days, pages = data?.pages || [], countries = trafficCountries(data, countryDays), devices = data?.devices || [];
  const max = Math.max(1, ...days.map(day => day.visitors));
  const geographyMax = Math.max(1, ...countries.map(row => row.visitors));
  return <section className="admin-traffic-module"><div className="admin-section-heading"><div><h2>{tx('Site traffic')} <span className={`admin-live-indicator ${fresh ? 'is-live' : ''}`}>{tx(fresh ? 'Online' : 'Status unavailable')}</span></h2><p>{tx('One browser counts once, even with several tabs.')}</p></div>{compact ? <button className="admin-text-action" onClick={onOpen}>{tx('Open traffic')} <FiArrowUpRight /></button> : <button className="admin-btn" disabled={refreshing} onClick={refresh}><FiRefreshCw className={refreshing ? 'admin-spin' : ''} />{tx('Refresh')}</button>}</div>
    <Notice error>{error && tx('Traffic data could not be refreshed. The previous snapshot may be outdated.')}</Notice>
    <div className="admin-metrics admin-traffic-metrics" data-site-traffic="true">{metrics.map(([label, value, hint, Icon], index) => <div key={label} className={`admin-metric ${index === 0 ? 'admin-metric-live' : ''}`}><span>{tx(label)}<Icon /></span><strong>{value == null ? loading ? <i className="admin-number-skeleton" /> : '—' : format(value)}{index === 0 && fresh && <span className="admin-pulse-dot" />}</strong><small>{tx(hint)}</small></div>)}</div>
    {!compact && <p className="admin-traffic-explanation">{tx('Daily totals cannot be added: the same browser counts once in the selected period.')} {tx('Admin pages and hidden tabs do not send activity.')} {tx('History starts when tracking was enabled; today is still in progress.')}</p>}
    <div className="admin-traffic-grid"><Panel title="Visitors by day" description="Daily totals use Moscow time (UTC+3). Updates every 15 seconds." action={compact ? <span className="admin-badge">{tx('Last 7 days')}</span> : <select className="admin-input admin-traffic-period" aria-label={tx('Traffic period')} value={period} onChange={event => updateParams({ trafficDays: trafficPeriod(event.target.value) })}>{TRAFFIC_PERIODS.map(days => <option key={days} value={days}>{tx({ 7: 'Last 7 days', 14: 'Last 14 days', 30: 'Last 30 days' }[days])}</option>)}</select>}>
      {loading ? <Skeleton rows={4} /> : !days.length ? <Empty /> : <div className="admin-traffic-chart"><div className="admin-chart-scale"><span>{format(max)}</span><span>{format(Math.round(max / 2))}</span><span>0</span></div><div className="admin-traffic-bars" style={{ minWidth: `${days.length * 34}px` }} role="list" aria-label={tx('Visitors by day')}>{days.map((day, index) => <div key={day.day} role="listitem"><strong>{format(day.visitors)}</strong><div className="admin-traffic-bar-track"><span className={index === days.length - 1 ? 'is-today' : ''} style={{ height: `${day.visitors / max * 100}%` }} title={`${day.day}: ${day.visitors}`} /></div><time dateTime={day.day}>{formatUserDateTime(day.day + 'T12:00:00Z', { day: '2-digit', month: '2-digit' }, { timeZone: 'UTC' })}</time></div>)}</div></div>}
    </Panel><Panel title="Active pages" description="Last active page for each online browser." action={<span className="admin-badge good">{fresh ? format(data.online) : '—'}</span>}>
      {!fresh ? <Empty>{tx(loading ? 'Loading...' : 'Status unavailable')}</Empty> : !pages.length ? <Empty>{tx('No active visitors right now.')}</Empty> : <div className="admin-page-list">{pages.slice(0, compact ? 5 : 12).map(page => <div key={page.path}><span className="admin-status-dot online" /><Link to={page.path} target="_blank" rel="noopener noreferrer" title={page.path}>{page.path}</Link><b>{format(page.visitors)}</b></div>)}</div>}
    </Panel></div>
    {!compact && data && <div className="admin-overview-grid"><Panel title="Countries" description="Unique browsers by their latest IP country in the selected period." action={<select className="admin-input admin-traffic-period" aria-label={tx('Country statistics period')} value={countryDays} onChange={event => updateParams({ countryDays: countryPeriod(event.target.value) })}>{COUNTRY_PERIODS.map(days => <option key={days} value={days}>{tx({ 1: 'Today', 7: 'Last 7 days', 30: 'Last 30 days' }[days])}</option>)}</select>}><div className="admin-geography">{countries.length ? countries.map(row => <div key={row.country || 'unknown'}><div><span>{row.country ? <><CountryFlag country={row.country} /> {countryName(row.country) || row.country}</> : tx('Unknown')}</span><b>{format(row.visitors)}</b></div><i><span style={{ width: `${row.visitors / geographyMax * 100}%` }} /></i></div>) : <Empty />}</div></Panel><Panel title="Devices today"><div className="admin-devices">{devices.map(row => { const Icon = row.device === 'desktop' ? FiMonitor : FiSmartphone; return <div key={row.device}><Icon /><span>{tx({ desktop: 'Desktop', mobile: 'Mobile', tablet: 'Tablet' }[row.device] || 'Unknown')}</span><strong>{format(row.visitors)}</strong></div>; })}</div></Panel></div>}
    <div className="admin-traffic-note">{data && <><span>{tx('Snapshot updated')}: <DateLabel value={data.generated_at} /></span>{!compact && <span>{tx('Tracking started')}: <DateLabel value={data.started_at} /></span>}</>}{!compact && <span>{tx('Different devices, private browsing or cleared storage can count as separate visitors. Known bots are excluded; this is not an exact count of people.')}</span>}</div>
  </section>;
}
