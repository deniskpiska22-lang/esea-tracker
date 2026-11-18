import {createClient} from "@supabase/supabase-js";
import {readFile,writeFile} from 'node:fs/promises';
import process from 'node:process';
const [beforePath,afterPath]=process.argv.slice(2);
const before=JSON.parse(await readFile(beforePath,'utf8'));
const after=JSON.parse(await readFile(afterPath,'utf8'));
if(before.season!==after.season || before.ratings.length!==after.ratings.length)throw new Error('Season/team set changed during comparison');
const byId=new Map(before.ratings.map(r=>[r.team_id,r]));
const changes=after.ratings.map(r=>{
 const old=byId.get(r.team_id);
 if(!old || !Number.isInteger(r.points) || r.points<0 || r.points>1000)throw new Error(`Invalid rating ${r.team_id}`);
 return {id:r.team_id,name:r.team_name,before:old.points,after:r.points,delta:r.points-old.points};
}).sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta));
const games=after.qualifierAudit || [];
const verified=games.filter(g=>[g.detail.team1Strength,g.detail.team2Strength].some(s=>s.source==='hltv'));
const summary={season:after.season,teams:after.ratings.length,processed:after.processed,qualifiers:games.length,
 verifiedHltvMatches:verified.length,changed:changes.filter(c=>c.delta!==0).length,maxDelta:Math.max(...changes.map(c=>Math.abs(c.delta))),largestChanges:changes.slice(0,20),
 verifiedExamples:verified.slice(-8).map(g=>g.detail)};
console.log(JSON.stringify(summary,null,2));
await writeFile('qualifier-rating-comparison.json',JSON.stringify({summary,changes},null,2));
if(process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)) {
 const db=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const now=new Date().toISOString();
 const {error}=await db.from('worker_status').upsert({worker_name:'qualifier-rating-review',status:(!games.length || verified.length)?'online':'error',detail:JSON.stringify(summary),last_ping:now,updated_at:now},{onConflict:'worker_name'});
 if(error)throw error;
}
if(games.length && !verified.length)throw new Error('No verified HLTV opponents: refusing to apply an unverified crosswalk');

if(!games.length && changes.some(c=>c.delta!==0))throw new Error('Legacy history changed before any approved new qualifier: publication must remain paused');
