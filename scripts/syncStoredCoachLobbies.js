import process from 'node:process';
import { setTimeout as pause } from 'node:timers/promises';
import 'dotenv/config';
import { coachClient } from '../server/coachData.js';
import { storedCoachIds, parseStoredCoachLobby } from '../server/storedCoachLobby.js';
import { coachLobbyRejection } from '../server/coachLobby.js';

const db = coachClient();
const workerName = 'coach-stored-lobbies';
const result = async query => { const { data,error } = await query; if (error) throw error; return data; };
const saved = await result(db.from('worker_status').select('detail').eq('worker_name',workerName).maybeSingle());
let state = {};
try { state=JSON.parse(saved?.detail || '{}'); } catch { /* New checkpoint. */ }
if (state.retryAt > Date.now()) { console.log('[coach-stored] source cooldown'); process.exit(0); }
const rows = await result(db.rpc('esea_cached_coach_lobbies_due',{p_limit:1000}));
const ids = [...new Set(rows.flatMap(row=>storedCoachIds(row.payload)))];
const identities = new Map();
for (let offset=0;offset<ids.length;offset+=200) {
  for (const person of await result(db.rpc('esea_known_coach_identities',{p_ids:ids.slice(offset,offset+200)}))) identities.set(person.id,person);
}
const unavailable = new Set();
let retryAt=0, httpStatus=null;
for (const id of ids.filter(id=>!identities.has(id))) {
  if (!process.env.FACEIT_API_KEY) throw new Error('FACEIT_API_KEY required to resolve an unknown coach');
  await pause(500);
  const response = await fetch(`https://open.faceit.com/data/v4/players/${id}`,{
    headers:{accept:'application/json',Authorization:`Bearer ${process.env.FACEIT_API_KEY}`},signal:AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    await response.body?.cancel().catch(()=>{});
    if ([401,403,429].includes(response.status)) {
      const denied=coachLobbyRejection(response);
      retryAt=Math.max(Date.now()+3*3600000,denied.retryAt);httpStatus=response.status;break;
    }
    unavailable.add(id);continue;
  }
  const person=await response.json();
  if (person.player_id!==id || !person.nickname?.trim()) { unavailable.add(id);continue; }
  identities.set(id,{id,nickname:person.nickname,country:person.country?.toUpperCase() || null,avatar:person.avatar});
}
const snapshots=[],rejected=[],deferred=[];
for (const row of rows) {
  if (storedCoachIds(row.payload).some(id=>!identities.has(id))) {deferred.push(row.id);continue;}
  const snapshot=parseStoredCoachLobby(row.payload,row,identities);
  if (snapshot) snapshots.push(snapshot); else rejected.push(row.id);
}
let imported=0;
for(let offset=0;offset<snapshots.length;offset+=200) {
  imported+=await result(db.rpc('record_esea_cached_coach_lobbies', {p_snapshots:snapshots.slice(offset,offset+200),p_rejected:[]}));
}
if(rejected.length)await result(db.rpc('record_esea_cached_coach_lobbies',{p_snapshots:[],p_rejected:rejected}));
for(let offset=0;offset<deferred.length;offset+=100)await result(db.from('esea_coach_match_rosters')
  .update({retry_at:new Date(retryAt || Date.now()+12*3600000).toISOString()}).in('match_id',deferred.slice(offset,offset+100)));
const at=new Date().toISOString();
const totals={checked:rows.length,imported,withCoaches:snapshots.filter(row=>row.coach_ids.length).length,
  rejected:rejected.length,deferred:deferred.length,retryAt,httpStatus};
await result(db.from('worker_status').upsert({worker_name:workerName,status:retryAt?'backoff':'online',last_ping:at,updated_at:at,detail:JSON.stringify(totals)},{onConflict:'worker_name'}));
console.log('[coach-stored]',JSON.stringify(totals));
if(retryAt)process.exitCode=77;
