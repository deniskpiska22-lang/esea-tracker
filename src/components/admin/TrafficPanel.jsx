import { useEffect, useState } from 'react';
import { FiActivity, FiArrowUpRight, FiRefreshCw } from 'react-icons/fi';
import { supabase } from '../../lib/supabaseClient.js';
import { tx } from '../../i18n/translate.js';
import { currentLocale } from '../../i18n/languages.js';
import { Panel, Notice, Empty, DateLabel } from './AdminUI.jsx';
import CountryFlag from '../CountryFlag.jsx';
import { countryName } from '../../utils/countries.js';
import Link from '../SiteLink.jsx';

const format = value => Number(value).toLocaleString(currentLocale());
export default function TrafficPanel({ compact = false, onOpen }) {
  const [state, setState] = useState({ data: null, error: false, loading: true });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let stopped = false, timer, request;
    const refresh = async () => {
      clearTimeout(timer);
      if (stopped || document.hidden) return;
      request?.abort();
      const controller = new AbortController();
      request = controller;
      const timeout = setTimeout(() => controller.abort(), 8000);
      try {
        const { data, error } = await supabase.rpc('admin_site_traffic').abortSignal(controller.signal);
        if (error || !data) throw error || new Error('No snapshot');
        if (!stopped && request === controller) setState({ data, error: false, loading: false });
      } catch {
        if (!stopped && request === controller) setState(previous => ({ ...previous, error: true, loading: false }));
      } finally {
        clearTimeout(timeout);
        if (!stopped && request === controller && !document.hidden) timer = setTimeout(refresh, 15_000);
      }
    };
    const visibility = () => { clearTimeout(timer); if (!document.hidden) refresh(); else request?.abort(); };
    refresh();
    document.addEventListener('visibilitychange', visibility);
    return () => { stopped = true; clearTimeout(timer); request?.abort(); document.removeEventListener('visibilitychange', visibility); };
  }, [revision]);
  const { data, error, loading } = state;
  const fresh = data && !error && Date.now() - Date.parse(data.generated_at) < 60_000;
  const metrics = [['Online now', fresh ? data.online : null, 'Active in the last 60 seconds'], ['Visitors today', data?.today, 'Unique browsers today'], ['Visitors yesterday', data?.yesterday, 'Unique browsers yesterday'], ['Visitors in 7 days', data?.week, 'Deduplicated across days']];
  const max = Math.max(1, ...(data?.days || []).map(day => day.visitors));
  return <Panel title="Site traffic" description="One browser counts once, even with several tabs." action={compact ? <button className="admin-btn" onClick={onOpen}>{tx('Open traffic')} <FiArrowUpRight /></button> : <button className="admin-btn" onClick={() => setRevision(value => value + 1)}><FiRefreshCw />{tx('Refresh')}</button>}>
    <div className="admin-stack" data-site-traffic="true">
      <Notice error>{error && tx('Traffic data could not be refreshed. The previous snapshot may be outdated.')}</Notice>
      <div className="admin-metrics admin-traffic-metrics">{metrics.map(([label, value, hint]) => <div key={label} className="admin-metric"><span>{label === 'Online now' && <FiActivity className={fresh ? 'admin-traffic-live' : ''} />}{tx(label)}</span><strong>{value == null ? loading ? '…' : '—' : format(value)}</strong><small>{tx(hint)}</small></div>)}</div>
      {!compact && data && <>
        <div className="admin-traffic-chart"><h3>{tx('Visitors by day')}</h3><div className="admin-traffic-bars" role="list" aria-label={tx('Visitors by day')}>{data.days.map(day => <div key={day.day} role="listitem"><strong>{format(day.visitors)}</strong><div className="admin-traffic-bar-track"><span style={{ height: `${day.visitors / max * 100}%` }} /></div><time dateTime={day.day}>{new Intl.DateTimeFormat(currentLocale(), { day: '2-digit', month: '2-digit', timeZone: 'UTC' }).format(new Date(day.day + 'T12:00:00Z'))}</time></div>)}</div></div>
        <div className="admin-overview-grid"><div><h3 className="admin-traffic-heading">{tx('Active pages')}</h3><p className="admin-traffic-note">{tx('Last active page for each online browser.')}</p>{!data.pages.length ? <Empty>{tx('No active visitors right now.')}</Empty> : <dl className="admin-summary">{data.pages.map(page => <div key={page.path}><dt><Link className="admin-text-link admin-traffic-path" to={page.path}>{page.path}</Link></dt><dd>{format(page.visitors)}</dd></div>)}</dl>}</div><div><h3 className="admin-traffic-heading">{tx('Countries today')}</h3><dl className="admin-summary">{data.countries.map(row => <div key={row.country}><dt>{row.country ? <><CountryFlag country={row.country} /> <span>{countryName(row.country) || row.country}</span></> : tx('Unknown')}</dt><dd>{format(row.visitors)}</dd></div>)}</dl><h3 className="admin-traffic-heading">{tx('Devices today')}</h3><dl className="admin-summary">{data.devices.map(row => <div key={row.device}><dt>{tx({ desktop: 'Desktop', mobile: 'Mobile', tablet: 'Tablet' }[row.device])}</dt><dd>{format(row.visitors)}</dd></div>)}</dl></div></div>
      </>}
      <div className="admin-traffic-note">{data && <><span>{tx('Snapshot updated')}: <DateLabel value={data.generated_at} /></span><span>{tx('Tracking started')}: <DateLabel value={data.started_at} /></span></>}<span>{tx('Daily totals use Moscow time (UTC+3). Updates every 15 seconds.')}</span>{!compact && <span>{tx('Different devices, private browsing or cleared storage can count as separate visitors. Known bots are excluded; this is not an exact count of people.')}</span>}</div>
    </div>
  </Panel>;
}
