import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { loadTeamMatchFeed, matchKind, compareUpcomingMatches, teamIsFirstInMatch, teamMatchFilter } from '../src/utils/teamMatchFeed.js';

const team = { faceitTeamId: 'stable-team-id', slug: 'old-name', name: 'Same Name' };
const now = new Date('2026-10-20T12:00:00.000Z');
function database(rows, override) {
  return createClient('https://team-matches.example', 'test-public-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async input => {
      const url = new URL(input);
      const params = url.searchParams;
      const statuses = params.get('status').slice(4, -1).split(',');
      const filter = params.get('or');
      assert.ok(filter.includes('team1_id.eq."stable-team-id",team2_id.eq."stable-team-id"'));
      assert.ok(!filter.includes('old-name'));
      const upcoming = statuses.includes('SCHEDULED');
      if (upcoming) assert.equal(filter, `(and(or(${teamMatchFilter(team)}),or(scheduled_at.gte.${now.toISOString()},scheduled_at.is.null)))`);
      const failure = override?.(params, statuses);
      if (failure) return failure;
      const result = rows.filter(row => statuses.includes(row.status)
        && [row.team1_id,row.team2_id].includes(team.faceitTeamId)
        && (!upcoming || !row.scheduled_at || row.scheduled_at >= now.toISOString()));
      result.sort((a,b) => {
        const key = statuses.includes('FINISHED') ? 'finished_at' : 'scheduled_at';
        if (!a[key]) return 1;
        if (!b[key]) return -1;
        const cmp = a[key].localeCompare(b[key]) || a.id.localeCompare(b.id);
        return key === 'finished_at' ? -cmp : cmp;
      });
      const offset = Number(params.get('offset') || 0);
      const limit = Number(params.get('limit') || 1000);
      return new Response(JSON.stringify(result.slice(offset, offset + limit)), { headers: { 'Content-Type':'application/json' } });
    } },
  });
}
const row = (id,status,scheduled_at,other={}) => ({id,status,scheduled_at,team1_id:team.faceitTeamId,team2_id:'opponent',...other});

test('a long results history cannot hide upcoming fixtures, including an unknown start time', async () => {
  const rows = Array.from({length:800},(_,i)=>row(`history-${i}`,'FINISHED','2026-10-18T10:00:00Z',{finished_at:'2026-10-18T12:00:00Z'}));
  rows.push(row('next','SCHEDULED','2026-10-21T10:00:00Z'),row('tbd','MATCH_STATUS_SCHEDULED',null),
    row('obsolete','SCHEDULED','2026-09-01T10:00:00Z'),row('cancelled','CANCELLED','2026-10-21T10:00:00Z'),
    row('namesake','SCHEDULED','2026-10-21T10:00:00Z',{team1_id:'different-team',team1_name:team.name}));
  const result = await loadTeamMatchFeed(database(rows),team,now);
  assert.equal(result.error,null);
  assert.equal(result.data.filter(m=>matchKind(m)==='finished').length,250);
  assert.deepEqual(result.data.filter(m=>matchKind(m)==='upcoming').map(m=>m.id),['next','tbd']);
});

test('active fixtures paginate independently and delayed live rooms are retained', async () => {
  const rows = Array.from({length:503},(_,i)=>row(`next-${i}`,'SCHEDULED','2026-10-21T10:00:00Z'));
  rows.push(row('live','MATCH_STATUS_ONGOING','2026-10-19T10:00:00Z'),row('ready','READY',null));
  const result = await loadTeamMatchFeed(database(rows),team,now);
  assert.equal(result.data.length,505);
  const sorted=result.data.sort(compareUpcomingMatches);
  assert.equal(sorted[0].id,'live');
  assert.equal(sorted[1].id,'ready');
});

test('status transitions render each room once in its newest lifecycle stage', async () => {
  const result=await loadTeamMatchFeed(database([
    row('promoted','SCHEDULED','2026-10-21T10:00:00Z'),row('promoted','ONGOING','2026-10-21T10:00:00Z'),
    row('completed','ONGOING','2026-10-20T10:00:00Z'),row('completed','FINISHED','2026-10-20T10:00:00Z',{finished_at:'2026-10-20T11:00:00Z'}),
  ]),team,now);
  assert.equal(result.data.length,2);
  assert.equal(result.data.find(m=>m.id==='promoted').status,'ONGOING');
  assert.equal(result.data.find(m=>m.id==='completed').status,'FINISHED');
});

test('a failed schedule request reports failure instead of claiming there are no fixtures', async () => {
  const result=await loadTeamMatchFeed(database([],(_,statuses)=>statuses.includes('SCHEDULED')
    ? new Response(JSON.stringify({message:'Schedule unavailable'}),{status:503,headers:{'Content-Type':'application/json'}}) : null),team,now);
  assert.equal(result.data,null);
  assert.equal(result.error.message,'Schedule unavailable');
});

test('opponent and score orientation use FACEIT identity even when names or slugs match the other side', () => {
  assert.equal(teamIsFirstInMatch({team1_id:'namesake',team1_name:team.name,team1_slug:team.slug,team2_id:team.faceitTeamId},team),false);
  assert.equal(teamIsFirstInMatch({team1_id:team.faceitTeamId,team2_id:'opponent'},team),true);
  assert.equal(matchKind({status:'MATCH_STATUS_CANCELLED'}),null);
  assert.equal(matchKind({status:'MATCH_STATUS_VOTING'}),'live');
});
