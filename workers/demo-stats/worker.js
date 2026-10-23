import { createClient } from '@supabase/supabase-js';
import { mkdtemp, open, writeFile, rm } from 'node:fs/promises';
import process from 'node:process';
import { Buffer } from 'node:buffer';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { buildDemoContext, downloadDemo, resolveDemoUrls } from './source.js';

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(20_000) }) } });
let stopped = false;
process.on('SIGTERM', () => { stopped = true; });
process.on('SIGINT', () => { stopped = true; });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function result(query) { const { data, error } = await query; if (error) throw error; return data; }

async function heartbeat(status, detail) {
  await db.from('worker_status').upsert({ worker_name: 'demo-stats-worker', last_ping: new Date().toISOString(), status, detail, updated_at: new Date().toISOString() }, { onConflict: 'worker_name' });
}
function parse(path, contextFile) {
  return new Promise((resolve, reject) => {
    // Native parsing is isolated so a corrupt demo cannot crash the worker.
    const child = spawn(process.execPath, ['--max-old-space-size=512', fileURLToPath(new URL('./parse.js', import.meta.url)), path, contextFile], { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, RAYON_NUM_THREADS: '1' } });
    let output = '', errors = '';
    const timer = setTimeout(() => child.kill('SIGKILL'), 90_000);
    child.stdout.on('data', chunk => { if (output.length < 100_000) output += chunk; else child.kill('SIGKILL'); });
    child.stderr.on('data', chunk => { if (errors.length < 1000) errors += chunk; });
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('exit', code => { clearTimeout(timer); if (code !== 0) return reject(new Error(`Demo parse failed: ${errors.trim().slice(0, 250) || 'timeout or native error'}`));
      try { resolve(JSON.parse(output)); } catch { reject(new Error('Invalid parser output')); } });
  });
}

async function signedResource(resource) {
  const token = process.env.FACEIT_DOWNLOADS_TOKEN;
  if (!token) return resource;
  const response = await fetch('https://api.faceit.com/download/v2/demos/download', {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ resource_url: resource }), signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw Object.assign(new Error(`Signed download HTTP ${response.status}`), { accessRequired: [401, 403].includes(response.status) });
  const data = await response.json();
  if (typeof data.payload?.download_url !== 'string') throw new Error('Signed download URL unavailable');
  return data.payload.download_url;
}

async function processJob(job) {
  const match = await result(db.from('matches').select('id,status,finished_at,championship_id,team1_id,team2_id,map_scores,raw_data,demo_urls').eq('id', job.match_id).single());
  const directory = await mkdtemp(join(tmpdir(), 'esea-demo-'));
  let results = [], status = 'retry', failure = '';
  try {
    let context;
    try { context = buildDemoContext(match); } catch (error) { status = 'unavailable'; throw error; }
    const contextFile = join(directory, 'context.json');
    await writeFile(contextFile, JSON.stringify(context), { mode: 0o600 });
    const urls = await resolveDemoUrls(match, process.env.FACEIT_API_KEY);
    if (!urls.length) throw new Error('Demo is not available yet');
    for (let index = 0; index < urls.length; index++) {
      const path = join(directory, `map-${index}.dem`);
      try {
        await downloadDemo(urls[index], match.id, path);
      } catch (error) {
        if (!error.accessRequired || !process.env.FACEIT_DOWNLOADS_TOKEN) throw error;
        await downloadDemo(await signedResource(urls[index]), match.id, path);
      }
      const handle = await open(path, 'r');
      const header = await handle.read({ buffer: Buffer.alloc(8), position: 0, length: 8 }).then(result => result.buffer.toString()).finally(() => handle.close());
      if (header !== 'PBDEMS2\0') throw new Error('Downloaded file is not a CS2 demo');
      const parsed = await parse(path, contextFile);
      const existing = results.find(result => result.map === parsed.map);
      if (existing && JSON.stringify(existing.teams) !== JSON.stringify(parsed.teams)) throw new Error('Conflicting demos for one map');
      if (!existing) results.push(parsed);
      await rm(path);
    }
    status = results.length === context.maps.length ? 'done' : 'retry';
    if (status !== 'done') failure = 'Some map demos are still unavailable';
  } catch (error) {
    failure = error.accessRequired ? 'FACEIT Downloads access is required' : error.message.slice(0, 350);
    if (error.accessRequired) status = 'access_required';
    else if (job.attempts >= 8) status = 'unavailable';
  } finally { await rm(directory, { recursive: true, force: true }); }
  const delay = status === 'access_required' ? 6 * 3600_000 : Math.min(4 * 3600_000, 60_000 * 2 ** Math.min(job.attempts, 8));
  const saved = await result(db.rpc('finish_match_demo_analysis', { p_match_id: job.match_id, p_lease_token: job.lease_token, p_results: results,
    p_status: status, p_error: failure || null, p_next_attempt_at: new Date(Date.now() + delay).toISOString() }));
  if (saved !== true) throw new Error('Demo analysis lease expired before saving');
  console.log(JSON.stringify({ matchId: job.match_id, status, maps: results.length, error: failure || null }));
  await heartbeat(status === 'done' ? 'online' : status, `${job.match_id}: ${results.length} verified maps${failure ? `; ${failure}` : ''}`);
}

console.log('Demo statistics worker starting; concurrency=1; recent window=30 days');
while (!stopped) {
  try {
    const jobs = await result(db.rpc('claim_match_demo_analysis'));
    if (jobs?.length) await processJob(jobs[0]);
    else await heartbeat('online', 'No due demo analysis jobs');
  } catch (error) { console.error('Demo worker:', error.message?.slice(0, 350)); }
  if (!stopped) await pause(30_000);
}
