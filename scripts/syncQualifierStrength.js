import process from 'node:process';
import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import { parseRanking, parseFaceitIdentity, rankingUrl, previousMonday } from './lib/hltvRankings.js';
import { isQualifierCompetition } from '../src/utils/qualifierStrength.js';

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession:false, autoRefreshToken:false } });
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g,'');
const wait = ms => new Promise(resolve => setTimeout(resolve,ms));
async function rows(table, select, configure = q => q) {
  const out=[];
  for(let from=0;;from+=500) {
    const {data,error}=await configure(db.from(table).select(select)).order(table==='matches'?'id':table==='team_catalog'?'team_id':table==='hltv_ranking_snapshots'?'ranking_date':'hltv_id').range(from,from+499);
    if(error)throw error; out.push(...data); if(data.length<500)return out;
  }
}
let sourceBlocked = false;
let consecutiveNetworkFailures = 0;
let requestAttempts = 0;
async function html(url) {
  if(sourceBlocked)throw new Error('HLTV temporarily unavailable; requests paused');
  await wait(300);
  if(++requestAttempts>240)throw new Error('HLTV request budget reached');
  let response;
  try { response=await fetch(url,{signal:AbortSignal.timeout(20000),headers:{'User-Agent':'ESEA-Tracker/1.0 (+https://eseatracker.ru)'}});consecutiveNetworkFailures=0; }
  catch(error) { if(++consecutiveNetworkFailures>=2)sourceBlocked=true;throw error; }
  if([403,429].includes(response.status))sourceBlocked=true;
  if(!response.ok)throw new Error(`HLTV HTTP ${response.status}`);
  const text=await response.text(); if(text.length>4_000_000)throw new Error('Oversized HLTV response'); return text;
}
async function main() {
  const {data:settings,error}=await db.from('rating_season_settings').select('active_season').single(); if(error)throw error;
  const {data:season,error:seasonError}=await db.from('rating_seasons').select('rating_from').eq('season',settings.active_season).single(); if(seasonError)throw seasonError;
  const [matches,catalog,saved,identities]=await Promise.all([
    rows('matches','id,competition_name,scheduled_at,finished_at,rating_teams:raw_data->teams',q=>q.gte('scheduled_at',season.rating_from || '2026-01-01').or('competition_name.ilike.%qual%,competition_name.ilike.%karsinta%,competition_name.ilike.%квалиф%')),
    rows('team_catalog','team_id,players:team->players'), rows('hltv_ranking_snapshots','*'), rows('hltv_player_identities','*'),
  ]);
  const sides=[]; const dates=new Set([previousMonday(Date.now()-86400000)]);
  for(const match of matches) {
    if(!isQualifierCompetition(match.competition_name))continue;
    for(const side of Object.values(match.rating_teams||{})) if(side?.roster?.length) sides.push(side.roster.map(p=>norm(p.nickname)));
    const at=Date.parse(match.finished_at||match.scheduled_at);
    if(!Number.isFinite(at)||at>Date.now())continue;
    // Previous Monday's list, with next-day activation; also covers Monday games.
    dates.add(previousMonday(at-86400000));
  }
  for(const row of catalog) if(Array.isArray(row.players))sides.push(row.players.map(norm));
  const cache=new Map(identities.map(i=>[i.hltv_id,i]));
  const curated=JSON.parse(await readFile(new URL('./config/hltvPlayerLinks.json',import.meta.url),'utf8'));
  for(const link of curated) {
    if(cache.get(link.hltvId)?.faceit_id)continue;
    const identity={hltv_id:link.hltvId,faceit_id:link.faceitId,source_url:link.sourceUrl,checked_at:new Date().toISOString()};
    const {error}=await db.from('hltv_player_identities').upsert(identity);if(error)throw error;
    cache.set(link.hltvId,identity);
  }
  const snapshots=new Map(saved.map(s=>[s.ranking_date,s])); let requests=0,updated=0,failed=0;
  const attempted = new Set();
  for(const date of [...dates].sort()) {
    let snapshot=snapshots.get(date);
    if(!snapshot) {
      try {snapshot=parseRanking(await html(rankingUrl(date)),date,rankingUrl(date));requests++;}
      catch(e){console.warn(`${date}: ${e.message}; preserving previous evidence`);failed++;continue;}
    }
    for(const team of snapshot.teams) {
      const nicks=new Set(team.players.map(p=>norm(p.nickname)));
      // Nicknames only select which public profiles to fetch. They NEVER award points.
      if(!sides.some(side=>new Set(side.filter(n=>nicks.has(n))).size>=2))continue;
      for(const player of team.players) {
        let identity=cache.get(player.id);
        if(!identity || (!identity.faceit_id && Date.now()-Date.parse(identity.checked_at)>7*86400000)) {
          if(attempted.has(player.id))continue; attempted.add(player.id);
          if(requests>=240){console.warn('Bounded request budget reached; remaining identities deferred');break;}
          try {
            const page=await html(player.url); requests++;
            // Block pages / changed markup must never erase a verified link.
            if(!page.includes('playerProfile'))throw new Error('Invalid player page');
            identity={hltv_id:player.id,faceit_id:parseFaceitIdentity(page),source_url:player.url,checked_at:new Date().toISOString()};
            const {error}=await db.from('hltv_player_identities').upsert(identity); if(error)throw error;
            cache.set(player.id,identity);
          } catch(e){console.warn(`Player ${player.id}: ${e.message}`);failed++;}
        }
        if(identity?.faceit_id)player.faceitId=identity.faceit_id;
      }
    }
    // Populate cached stable links in every snapshot, including older rosters.
    for(const team of snapshot.teams) for(const player of team.players)if(cache.get(player.id)?.faceit_id)player.faceitId=cache.get(player.id).faceit_id;
    const {error}=await db.from('hltv_ranking_snapshots').upsert({ranking_date:date,source_url:snapshot.source_url,teams:snapshot.teams,checked_at:new Date().toISOString()});
    if(error)throw error; updated++;
    console.log(`HLTV ${date}: ${snapshot.teams.length} teams, ${snapshot.teams.filter(t=>t.players.filter(p=>p.faceitId).length>=3).length} verified cores`);
  }
  const now=new Date().toISOString();
  await db.from('worker_status').upsert({worker_name:'hltv-strength-source',status:sourceBlocked?'error':'online',detail:JSON.stringify({updated,failed,requests:requestAttempts,sourceBlocked}),last_ping:now,updated_at:now},{onConflict:'worker_name'});
  console.log(JSON.stringify({updated,failed,requests,identityLinks:[...cache.values()].filter(i=>i.faceit_id).length}));
  if(!updated)throw new Error('No usable HLTV snapshots; existing ratings preserved');
}
main().catch(async e=>{console.error(e);process.exitCode=1;const now=new Date().toISOString();await db.from('worker_status').upsert({worker_name:'hltv-strength-source',status:'error',detail:String(e.stack||e.message).slice(0,12000),last_ping:now,updated_at:now},{onConflict:'worker_name'});});
