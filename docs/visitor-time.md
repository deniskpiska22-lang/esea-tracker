# Visitor time

All browser-visible event times use `formatUserDateTime` from `src/utils/userTime.js`, or `<UserTime value={timestamp} />`. The browser provides the timezone and regional date/clock preferences. UI language, geography and advertising partner never select the clock. Daylight saving is resolved for each event's date.

Components displaying dates call `useUserTimeSettings()`. One shared subscription checks settings every 30 seconds and on focus, visibility and language changes. A minute-level snapshot also updates relative dates and local day boundaries without remounting pages or clearing forms.

Pass original data values to the formatter. ISO timestamps and Unix timestamps represent instants; timezone-less ISO server timestamps are UTC. `YYYY-MM-DD` is a calendar label (birthdays, weekly ranking dates and aggregate day labels), so it keeps its calendar day. Date-only tournament boundaries use local midnight and end of day. Never convert an already formatted string again.

Keep API timestamps, database values and canonical ranking/analytics calculation windows unchanged. A stored daily aggregate cannot be converted to another timezone without the underlying events; its date label and documented calculation zone remain the source's accounting period. Actual timestamps in those panels still follow visitor settings.

ESLint rejects direct Intl date formatting, direct locale date/time methods and fixed timezone/clock options outside the shared module. Run `npm run check:time` before shipping. Tests simulate actual device zones, DST, midnight/New Year, 12/24-hour clocks and setting changes.
