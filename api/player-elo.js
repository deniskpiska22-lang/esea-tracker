import { createClient } from '@supabase/supabase-js';
import process from 'node:process';
import { createEloRefresher, createPlayerEloHandler, ELO_COLUMNS } from '../server/playerElo.js';

let handler;
export default async function playerElo(request, response) {
  if (!handler) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
    if (!url || !key) return response.status(503).json({ ok: false });
    const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    handler = createPlayerEloHandler({
      load: async ids => {
        const { data, error } = await db.from('players').select(ELO_COLUMNS).in('faceit_id', ids);
        if (error) throw error;
        return data || [];
      },
      refresh: createEloRefresher({ db, apiKey: process.env.FACEIT_API_KEY }),
    });
  }
  return handler(request, response);
}
