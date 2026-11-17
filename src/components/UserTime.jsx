import { useUserTimeSettings } from '../hooks/useUserTimeSettings.js';
import { formatUserDateTime, getTimeZoneLabel, getUserTimeZone, parseUserDate } from '../utils/userTime.js';

export default function UserTime({ value }) {
  useUserTimeSettings();
  const date = parseUserDate(value);
  if (!date) return <time>—</time>;
  const timeZone = getUserTimeZone();
  return <time dateTime={date.toISOString()} title={timeZone}>
    {formatUserDateTime(date, { hour: '2-digit', minute: '2-digit' }, {showTimeZone: false})}
    <span className="ml-2 inline-block align-middle text-xs font-medium tracking-normal text-slate-400 sm:text-sm">{getTimeZoneLabel(date, timeZone)}</span>
  </time>;
}
