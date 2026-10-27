import { createClient } from '@supabase/supabase-js';
import process from 'node:process';
import { faceitEloPatch } from './lib/faceitPlayerProfile.js';
import { retryAfterMs } from './lib/discoveryScan.js';

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
const apiKey = process.env.FACEIT_API_KEY;
if (!url || !key || !apiKey) throw new Error('Supabase server credentials and FACEIT_API_KEY are required');
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const worker = 'player-faceit-elo';
const teamId = process.argv.find(arg => arg.startsWith('--team='))?.slice(7);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function checkpoint(status, detail) {
  const now = new Date().toISOString();
  const { error } = await db.from('worker_status').upsert({ worker_name: worker, status,
    last_ping: now, updated_at: now, detail: JSON.stringify(detail) }, { onConflict: 'worker_name' });
  if (error) throw error;
}

async function main() {
  const { data: previous, error: stateError } = await db.from('worker_status').select('detail').eq('worker_name', worker).maybeSingle();
  if (stateError) throw stateError;
  let state = {};
  try { state = JSON.parse(previous?.detail || '{}'); } catch { /* Old diagnostic text. */ }
  if (Number(state.retryAt) > Date.now()) return;

  let query = db.from('players').select('faceit_id,team_players!inner(is_active,team_id)')
    .eq('team_players.is_active', true).not('faceit_id', 'is', null);
  if (teamId) query = query.eq('team_players.team_id', teamId);
  else query = query.or(`faceit_profile_synced_at.is.null,faceit_profile_synced_at.lt.${new Date(Date.now() - 86400000).toISOString()}`);
  const { data, error } = await query.order('faceit_profile_synced_at', { nullsFirst: true })
    .order('faceit_id').limit(240);
  if (error) throw error;
  const started = Date.now();
  let saved = 0;
  let failed = 0;
  for (const player of data || []) {
    if (Date.now() - started >= 180000) break;
    const response = await fetch(`https://open.faceit.com/data/v4/players/${encodeURIComponent(player.faceit_id)}`, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' }, signal: AbortSignal.timeout(10000),
    });
    if (response.status === 429) {
      await checkpoint('cooldown', { saved, failed, retryAt: Date.now() + Math.max(900000, retryAfterMs(response.headers.get('retry-after'))) });
      return;
    }
    if (response.status === 401 || response.status === 403) throw new Error(`FACEIT credentials rejected (${response.status})`);
    if (!response.ok && response.status !== 404) { failed += 1; await sleep(500); continue; }
    const patch = response.status === 404
      ? { faceit_profile_synced_at: new Date().toISOString() }
      : faceitEloPatch(await response.json(), player.faceit_id);
    const { error: saveError } = await db.from('players').update(patch).eq('faceit_id', player.faceit_id);
    if (saveError) throw saveError;
    saved += 1;
    await sleep(500);
  }
  await checkpoint('online', { saved, failed, retryAt: 0 });
  console.log(JSON.stringify({ worker, saved, failed }));
}
main().catch(error => { console.error('FACEIT ELO refresh failed:', error.message); process.exitCode = 1; });
