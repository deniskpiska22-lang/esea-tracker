import { createClient } from '@supabase/supabase-js';
import { mkdtemp, open, writeFile, rm } from 'node:fs/promises';
import process from 'node:process';
import { Buffer } from 'node:buffer';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { buildDemoContext, downloadDemo, resolveDemoUrls, resolveDownloadUrl, saveDemoResponse } from './source.js';

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(20_000) }) } });
let stopped = false;
let accessBlockedUntil = 0;
let providerFailures = 0;
let blockedReason = '';
let lastPausedHeartbeat = 0;
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
    const child = spawn(process.execPath, ['--max-old-space-size=512', fileURLToPath(new URL('./parse.js', import.meta.url)), path, contextFile], {
      stdio: ['ignore', 'pipe', 'pipe'], env: { PATH: process.env.PATH, LANG: 'C.UTF-8', RAYON_NUM_THREADS: '1' },
    });
    let output = '', errors = '';
    const timer = setTimeout(() => child.kill('SIGKILL'), 90_000);
    child.stdout.on('data', chunk => { if (output.length < 100_000) output += chunk; else child.kill('SIGKILL'); });
    child.stderr.on('data', chunk => { if (errors.length < 1000) errors += chunk; });
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('exit', code => { clearTimeout(timer); if (code !== 0) return reject(new Error(`Demo parse failed: ${errors.trim().slice(0, 250) || 'timeout or native error'}`));
      try { resolve(JSON.parse(output)); } catch { reject(new Error('Invalid parser output')); } });
  });
}

async function processUpload(job) {
  const directory = await mkdtemp(join(tmpdir(), 'esea-upload-'));
  let parsed = null, error = null, retry = false;
  try {
    const match = await result(db.from('matches').select('id,team1_id,team2_id,map_scores,raw_data').eq('id', job.match_id).single());
    const context = buildDemoContext(match);
    const contextFile = join(directory, 'context.json'), path = join(directory, 'map.dem');
    await writeFile(contextFile, JSON.stringify(context), { mode: 0o600 });
    if (!job.object_path.startsWith(`${match.id}/${job.id}.dem`) || !/\.dem(?:\.gz|\.zst)?$/.test(job.object_path)) throw new Error('Invalid upload path');
    const signed = await result(db.storage.from('match-demo-inbox').createSignedUrl(job.object_path, 180));
    const url = new URL(signed.signedUrl);
    if (url.origin !== new URL(process.env.SUPABASE_URL).origin) throw new Error('Unexpected storage origin');
    const signal = AbortSignal.timeout(120000);
    const response = await fetch(url, { signal, redirect: 'manual' });
    if (!response.ok) throw Object.assign(new Error(`Storage download HTTP ${response.status}`), { retryable: response.status >= 500 });
    await saveDemoResponse(response, path, job.object_path, signal);
    const handle = await open(path, 'r');
    const header = await handle.read({ buffer: Buffer.alloc(8), position: 0, length: 8 }).then(r => r.buffer.toString()).finally(() => handle.close());
    if (header !== 'PBDEMS2\0') throw new Error('Uploaded file is not a CS2 demo');
    parsed = await parse(path, contextFile);
    parsed.source = 'admin_upload';
  } catch (failure) {
    error = failure.message.slice(0, 350);
    retry = Boolean(failure.retryable || failure.name === 'TimeoutError' || failure.message === 'fetch failed');
  } finally { await rm(directory, { recursive: true, force: true }); }
  const saved = await result(db.rpc('finish_match_demo_upload', {
    p_id: job.id, p_lease_token: job.lease_token, p_result: parsed, p_error: error, p_retry: retry,
  }));
  if (saved !== true) throw new Error('Upload analysis lease expired before saving');
  const receipt = await result(db.from('match_demo_uploads').select('status,last_error').eq('id', job.id).single());
  if (receipt.status !== 'retry') {
    const { error: deleteError } = await db.storage.from('match-demo-inbox').remove([job.object_path]);
    if (deleteError) console.warn('Temporary demo cleanup failed:', deleteError.message);
    else await result(db.from('match_demo_uploads').update({ storage_deleted_at: new Date().toISOString() }).eq('id', job.id));
  }
  console.log(JSON.stringify({ upload: job.id, matchId: job.match_id, status: receipt.status, error: receipt.last_error }));
  await heartbeat(receipt.status === 'done' ? 'online' : receipt.status, `${job.match_id}: administrator upload ${receipt.status}`);
}

let lastUploadCleanup = 0;
async function cleanupUploads() {
  if (Date.now() - lastUploadCleanup < 3600000) return;
  lastUploadCleanup = Date.now();
  const rows = await result(db.from('match_demo_uploads').select('id,object_path,status')
    .is('storage_deleted_at', null).in('status', ['uploading','done','rejected'])
    .lt('created_at', new Date(Date.now() - 86400000).toISOString()).order('created_at').limit(50));
  if (!rows?.length) return;
  const expired = rows.filter(row => row.status === 'uploading').map(row => row.id);
  if (expired.length) await result(db.from('match_demo_uploads').update({ status: 'rejected', last_error: 'Upload expired before completion' })
    .in('id', expired).eq('status', 'uploading'));
  const terminal = await result(db.from('match_demo_uploads').select('id,object_path').in('id', rows.map(row=>row.id)).in('status',['done','rejected']));
  if (!terminal.length) return;
  const { error } = await db.storage.from('match-demo-inbox').remove(terminal.map(row => row.object_path));
  if (error) throw error;
  await result(db.from('match_demo_uploads').update({ storage_deleted_at: new Date().toISOString() }).in('id', terminal.map(row=>row.id)));
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
      const signedUrl = await resolveDownloadUrl(urls[index], match.id, process.env.FACEIT_DOWNLOADS_TOKEN);
      await downloadDemo(signedUrl, match.id, path);
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
    failure = error.accessRequired ? `FACEIT Downloads access is required (${error.message})` : `${error.message}${error.cause?.code ? ` [${error.cause.code}]` : ''}`.slice(0, 350);
    if (error.accessRequired) status = 'access_required';
    else if (job.attempts >= 8) status = 'unavailable';
  } finally { await rm(directory, { recursive: true, force: true }); }
  const delay = status === 'access_required' ? 6 * 3600_000 : Math.min(4 * 3600_000, 60_000 * 2 ** Math.min(job.attempts, 8));
  const saved = await result(db.rpc('finish_match_demo_analysis', { p_match_id: job.match_id, p_lease_token: job.lease_token, p_results: results,
    p_status: status, p_error: failure || null, p_next_attempt_at: new Date(Date.now() + delay).toISOString() }));
  if (saved !== true) throw new Error('Demo analysis lease expired before saving');
  if (status === 'access_required') {
    accessBlockedUntil = Date.now() + 6 * 3600_000;
    blockedReason = 'Waiting for FACEIT Downloads permission; retrying in six hours or after credentials change';
  } else if (/FACEIT Downloads HTTP 5\d\d/.test(failure)) {
    providerFailures++;
    if (providerFailures >= 3) {
      accessBlockedUntil = Date.now() + 15 * 60_000;
      blockedReason = 'FACEIT Downloads service failed three times; cooling down for 15 minutes';
      providerFailures = 0;
    }
  } else if (status === 'done') providerFailures = 0;
  console.log(JSON.stringify({ matchId: job.match_id, status, maps: results.length, error: failure || null }));
  await heartbeat(status === 'done' ? 'online' : status, `${job.match_id}: ${results.length} verified maps${failure ? `; ${failure}` : ''}`);
}

console.log('Demo statistics worker starting; concurrency=1; recent window=30 days');
while (!stopped) {
  try {
    await cleanupUploads();
    const uploads = await result(db.rpc('claim_match_demo_upload'));
    if (uploads?.length) await processUpload(uploads[0]);
    else if (!process.env.FACEIT_DOWNLOADS_TOKEN || Date.now() < accessBlockedUntil) {
      if (Date.now() - lastPausedHeartbeat >= 300_000) {
        await heartbeat('paused', process.env.FACEIT_DOWNLOADS_TOKEN ? blockedReason : 'Automatic downloads need FACEIT_DOWNLOADS_TOKEN; administrator demo uploads are accepted');
        lastPausedHeartbeat = Date.now();
      }
    }
    else {
      const jobs = await result(db.rpc('claim_match_demo_analysis'));
      if (jobs?.length) await processJob(jobs[0]);
      else await heartbeat('online', 'No due demo analysis jobs');
    }
  } catch (error) { console.error('Demo worker:', error.message?.slice(0, 350)); }
  if (!stopped) await pause(30_000);
}
