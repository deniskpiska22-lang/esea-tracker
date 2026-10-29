import { useState } from 'react';
import { tx } from '../../i18n/translate.js';
import { currentLocale } from '../../i18n/languages.js';
import { Panel, Empty, DateLabel } from './AdminUI.jsx';
import Link from '../SiteLink.jsx';
const number = n => Number(n).toLocaleString(currentLocale());
function trafficChange(current, previous) {
  if (previous == null || previous === 0) return null;
  return Math.round((current - previous) / previous * 100);
}
export default function TrafficDetails({ data }) {
  const [period, setPeriod] = useState(1);
  const [search, setSearch] = useState('');
  const details = data?.details?.[period];
  return <section className="admin-traffic-details">
    <div className="admin-section-heading"><div><h2>{tx('Traffic analytics')}</h2><p>{tx('Page openings are counted separately from online heartbeats.')}</p></div><select className="admin-input admin-traffic-period" aria-label={tx('Analytics period')} value={period} onChange={event => setPeriod(Number(event.target.value))}>{[1,7,30].map(n => <option key={n} value={n}>{tx({1:'Today',7:'Last 7 days',30:'Last 30 days'}[n])}</option>)}</select></div>
    {!details ? <Empty /> : <>
      <p className="admin-traffic-explanation">{tx('Detailed tracking started')}: <DateLabel value={data.details_started_at} />. {tx('Sources and entry pages use each browser’s first observed visit in the selected period.')} {tx('Today is incomplete; comparisons use the previous full calendar period.')}</p>
      {details.partial && <p className="admin-notice">{tx('This period includes days before detailed tracking started.')}</p>}
      <div className="admin-metrics">{[['Unique visitors',details.visitors,details.previous_visitors],['Page views',details.views,details.previous_views]].map(([label,current,previous]) => { const change = trafficChange(current,previous); return <div className="admin-metric" key={label}><span>{tx(label)}</span><strong>{number(current)}</strong><small>{tx('Previous period')}: {previous == null ? tx('Not enough history') : number(previous)}{change != null && ` · ${change > 0 ? '+' : ''}${change}%`}</small><small>{details.from} — {details.to} / {details.previous_from} — {details.previous_to}</small></div>; })}</div>
      <Panel title="Page views" description="A reload or a new page opening counts as a view; background activity does not." action={<input className="admin-input" type="search" aria-label={tx('Search page views')} placeholder={tx('Search pages')} value={search} onChange={event => setSearch(event.target.value)} />}><div className="admin-page-list" style={{maxHeight:400,overflowY:'auto'}}><div><span style={{flex:1}}>{tx('Page')}</span><span>{tx('Unique visitors')}</span><span>{tx('Views')}</span></div>{details.pages.filter(row=>row.path.toLowerCase().includes(search.toLowerCase())).map(row=><div key={row.path}><Link to={row.path} target="_blank" rel="noopener noreferrer" title={row.path}>{row.path}</Link><b title={tx('Unique visitors')}>{number(row.visitors)}</b><b title={tx('Views')}>{number(row.views)}</b></div>)}</div></Panel>
      <div className="admin-overview-grid">{[['Sources','sources'],['Entry pages','entries'],['Browsers','browsers'],['Operating systems','systems']].map(([title,key])=><Panel title={title} key={key}><div className="admin-page-list" style={{maxHeight:320,overflowY:'auto'}}>{details[key].length ? details[key].map(row=><div key={row.label}><span style={{flex:1,overflowWrap:'anywhere'}}>{row.label || tx('Direct / unknown')}</span><b>{number(row.visitors)}</b></div>) : <Empty />}</div></Panel>)}</div>
    </>}
  </section>;
}
