import test from 'node:test';
import assert from 'node:assert/strict';
import { loadHomeMatchFeed } from '../src/utils/homeMatchFeed.js';

const now = new Date('2026-10-19T18:50:00Z');
const options = { columns: 'id,status,scheduled_at', liveStatuses: new Set(['ONGOING','READY']),
  now, end: new Date('2026-10-20T18:50:00Z'), resultsLimit: 12 };
function fakeDatabase(rows, override) {
  return { from(table) {
    assert.equal(table, 'matches');
    const query = { filters: [], orders: [], start: 0, end: 999,
      select() { return this; },
      in(key, values) { this.filters.push(row => values.includes(row[key])); this.statuses = values; return this; },
      gte(key, value) { this.filters.push(row => row[key] >= value); return this; },
      lte(key, value) { this.filters.push(row => row[key] <= value); return this; },
      order(key, { ascending }) { this.orders.push({ key, ascending }); return this; },
      range(start, end) { this.start = start; this.end = end; return this; },
      limit(count) { this.end = count - 1; return this; },
      then(resolve, reject) {
        const intercepted = override?.(this);
        if (intercepted) return Promise.resolve(intercepted).then(resolve, reject);
        const data = rows.filter(row => this.filters.every(filter => filter(row))).sort((a,b) => {
          for (const {key,ascending} of this.orders) {
            const cmp = String(a[key] || '').localeCompare(String(b[key] || ''));
            if(cmp) return ascending ? cmp : -cmp;
          }
          return 0;
        }).slice(this.start, this.end + 1);
        return Promise.resolve({ data, error: null }).then(resolve, reject);
      },
    };
    return query;
  } };
}
const matches = (count, status, scheduled_at, prefix) => Array.from({length:count},(_,i)=>({
  id:`${prefix}-${String(i).padStart(4,'0')}`,status,scheduled_at,
}));
test('243 live matches cannot hide any of the 269 scheduled matches', async () => {
  const rows=[...matches(243,'ONGOING','2026-10-19T18:00:00.000Z','live'),
    ...matches(268,'SCHEDULED','2026-10-19T19:00:00.000Z','next'),
    ...matches(1,'MATCH_STATUS_SCHEDULED','2026-10-20T18:30:00.000Z','legacy')];
  const response=await loadHomeMatchFeed(fakeDatabase(rows),options);
  assert.equal(response.error,null);
  assert.equal(response.data.length,512);
  assert.equal(response.data.filter(row=>row.status.includes('SCHEDULED')).length,269);
});
test('live and scheduled lists paginate independently beyond the database row cap', async () => {
  const rows=[...matches(601,'READY','2026-10-19T18:00:00.000Z','live'),
    ...matches(1201,'SCHEDULED','2026-10-19T19:00:00.000Z','next'),
    ...matches(20,'FINISHED','2026-10-19T17:00:00.000Z','finished')];
  const response=await loadHomeMatchFeed(fakeDatabase(rows),options);
  assert.equal(response.data.length,1814);
  assert.equal(response.data.filter(row=>row.status==='FINISHED').length,12);
});
test('the upcoming window excludes past and distant games, retaining both boundaries', async () => {
  const rows=[{id:'past',status:'SCHEDULED',scheduled_at:'2026-10-19T18:49:59.999Z'},
    {id:'now',status:'SCHEDULED',scheduled_at:options.now.toISOString()},
    {id:'end',status:'SCHEDULED',scheduled_at:options.end.toISOString()},
    {id:'later',status:'SCHEDULED',scheduled_at:'2026-10-20T18:50:00.001Z'}];
  const response=await loadHomeMatchFeed(fakeDatabase(rows),options);
  assert.deepEqual(response.data.map(row=>row.id),['now','end']);
});
test('a later-page error cannot turn a failed refresh into an incomplete success', async () => {
  const failure={message:'temporary database failure'};
  const response=await loadHomeMatchFeed(fakeDatabase(matches(501,'SCHEDULED','2026-10-19T19:00:00.000Z','next'),
    query=>query.start===500 ? {data:null,error:failure} : null),options);
  assert.equal(response.error,failure);
  assert.equal(response.data,null);
});
test('a match moving from scheduled to live renders only its live state', async () => {
  const response=await loadHomeMatchFeed(fakeDatabase([
    {id:'one',status:'SCHEDULED',scheduled_at:'2026-10-19T19:00:00.000Z'},
    {id:'one',status:'ONGOING',scheduled_at:'2026-10-19T18:30:00.000Z'},
  ]),options);
  assert.equal(response.data.length,1);
  assert.equal(response.data[0].status,'ONGOING');
});
