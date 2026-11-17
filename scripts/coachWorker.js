import process from 'node:process';
import { spawn } from 'node:child_process';
import { setTimeout as pause } from 'node:timers/promises';
import 'dotenv/config';
import { coachClient } from '../server/coachData.js';
import { runCoachJobs } from '../server/coachWorkerJobs.js';

const db=coachClient(), workerName='coach-worker';
const result=async query=>{const {data,error}=await query;if(error)throw error;return data;};
const saved=await result(db.from('worker_status').select('detail').eq('worker_name',workerName).maybeSingle());
let state={jobs:{}};
try{const prior=JSON.parse(saved?.detail||'{}');state={...prior,jobs:prior.jobs||{}};}catch{/* New worker. */}
let stopping=false,child=null;
const readStatus=async name=>await result(db.from('worker_status').select('detail,last_ping').eq('worker_name',name).maybeSingle());
const jobs=[
  {name:'cached',script:'scripts/syncStoredCoachLobbies.js',interval:60000},
  {name:'rosters',script:'scripts/syncCoachRosters.js',args:['--apply'],interval:3*3600000,
    eligibleAt:async()=>{const row=await readStatus('coach-rosters');const at=Date.parse(row?.last_ping);return Number.isFinite(at)?at+30*60000:0;}},
  {name:'lobbies',script:'scripts/syncCoachLobbies.js',interval:3*3600000,
    eligibleAt:async()=>{const row=await readStatus('coach-lobbies');let detail={};try{detail=JSON.parse(row?.detail||'{}');}catch{/* Fresh source. */}
      return detail.paused?Date.now()+3*3600000:Math.max(Number(detail.nextRunAt)||0,Number(detail.retryAt)||0);}},
];
async function heartbeat(){
  const at=new Date().toISOString();
  const statuses=Object.values(state.jobs);
  const status=statuses.some(job=>job.running)?'running':statuses.some(job=>job.result?.code===77)?'backoff'
    :statuses.some(job=>job.result?.code)?'error':'online';
  await result(db.from('worker_status').upsert({worker_name:workerName,status,last_ping:at,updated_at:at,detail:JSON.stringify(state)},{onConflict:'worker_name'}));
}
async function run(job){
  console.log('[coach-worker] starting',job.name);
  return new Promise(resolve=>{
    const task=spawn(process.execPath,[job.script,...(job.args||[])],{stdio:'inherit',env:process.env});
    child=task;
    let settled=false;
    const finish=value=>{if(settled)return;settled=true;clearTimeout(timer);if(child===task)child=null;console.log('[coach-worker] finished',job.name,JSON.stringify(value));resolve(value);};
    const timer=setTimeout(()=>{task.kill('SIGTERM');finish({code:1,error:'20-minute timeout'});},20*60000);
    task.on('error',error=>finish({code:1,error:error.message}));
    task.on('exit',(code,signal)=>finish({code:code??1,...(signal?{error:signal}:{})}));
  });
}
const stop=()=>{stopping=true;child?.kill('SIGTERM');};
process.on('SIGTERM',stop);process.on('SIGINT',stop);
console.log('[coach-worker] cached roles every minute; network collectors every three hours');
const timer=setInterval(()=>heartbeat().catch(error=>console.warn('[coach-worker] heartbeat',error.message)),30000).unref();
try{
 do{
  try{await runCoachJobs({jobs,state,run,save:heartbeat,stopping:()=>stopping});}
  catch(error){console.warn('[coach-worker] cycle',error.message);}
  await heartbeat();
  if(process.argv.includes('--once'))break;
  if(!stopping)await pause(30000);
 }while(!stopping);
}finally{clearInterval(timer);}
