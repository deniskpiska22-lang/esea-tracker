import { FiSearch, FiInbox, FiChevronLeft, FiChevronRight, FiAlertCircle, FiCheckCircle } from 'react-icons/fi';
import { tx, tf } from '../../i18n/translate.js';
import { formatUserDateTime } from '../../utils/userTime.js';
export function DateLabel({ value }) {
  return value && Number.isFinite(Date.parse(value)) ? <time dateTime={value}>{formatUserDateTime(value, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</time> : '—';
}
export function Panel({ title, description, action, children, className = '' }) {
  return <section className={`admin-panel ${className}`}><header className="admin-panel-header"><div><h2>{tx(title)}</h2>{description && <p>{tx(description)}</p>}</div>{action}</header><div className="admin-panel-body">{children}</div></section>;
}
export function Notice({ error, children }) {
  if (!children) return null;
  const Icon = error ? FiAlertCircle : FiCheckCircle;
  return <div role={error ? 'alert' : 'status'} className={`admin-notice ${error ? 'is-error' : ''}`}><Icon /><span>{children}</span></div>;
}
export function Empty({ children = tx('Nothing here yet.') }) {
  return <div className="admin-empty"><FiInbox aria-hidden="true" /><span>{children}</span></div>;
}
export function Skeleton({ rows = 4 }) {
  return <div className="admin-skeleton" role="status" aria-label={tx('Loading...')}>{Array.from({ length: rows }, (_, index) => <div key={index}><i /><span /><b /></div>)}</div>;
}
export function Search({ value, onChange, label = 'Search' }) {
  return <label className="admin-search"><FiSearch aria-hidden="true" /><input type="search" aria-label={tx(label)} placeholder={tx(label)} value={value} onChange={event => onChange(event.target.value)} /></label>;
}
export function Pager({ page, total, pageSize, onChange }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return <div className="admin-pager"><span>{tf('Showing {0}–{1} of {2}', total && page * pageSize < total ? page * pageSize + 1 : 0, Math.min(total, (page + 1) * pageSize), total)}</span><div><button type="button" className="admin-btn" disabled={page === 0} onClick={() => onChange(page - 1)} aria-label={tx('Previous page')}><FiChevronLeft /></button><span>{Math.min(page + 1, pages)} / {pages}</span><button type="button" className="admin-btn" disabled={page + 1 >= pages} onClick={() => onChange(page + 1)} aria-label={tx('Next page')}><FiChevronRight /></button></div></div>;
}
