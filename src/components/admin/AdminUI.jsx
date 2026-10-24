import { tx } from '../../i18n/translate.js';
import { formatUserDateTime } from '../../utils/userTime.js';
export function DateLabel({ value }) {
  return value && Number.isFinite(Date.parse(value)) ? formatUserDateTime(value, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
}
export function Panel({ title, description, action, children, className = '' }) {
  return <section className={`admin-panel ${className}`}><header className="admin-panel-header"><div><h2>{tx(title)}</h2>{description && <p>{tx(description)}</p>}</div>{action}</header><div className="admin-panel-body">{children}</div></section>;
}
export function Notice({ error, children }) {
  if (!children) return null;
  return <div role={error ? 'alert' : 'status'} className={`admin-notice ${error ? 'is-error' : ''}`}>{children}</div>;
}
export function Empty({ children = tx('Nothing here yet.') }) {
  return <div className="admin-empty">{children}</div>;
}
export function Search({ value, onChange, label = 'Search' }) {
  return <label className="admin-search"><span aria-hidden="true">⌕</span><input type="search" aria-label={tx(label)} placeholder={tx(label)} value={value} onChange={event => onChange(event.target.value)} /></label>;
}
export function Pager({ page, total, pageSize, onChange }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return <div className="admin-pager"><span>{tx('Total')}: {total}</span><div><button className="admin-btn" disabled={page === 0} onClick={() => onChange(page - 1)} aria-label={tx('Previous page')}>←</button><span>{page + 1} / {pages}</span><button className="admin-btn" disabled={page + 1 >= pages} onClick={() => onChange(page + 1)} aria-label={tx('Next page')}>→</button></div></div>;
}
