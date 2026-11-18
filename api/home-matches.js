import process from 'node:process';
import { loadHomeMatchFeed } from '../src/utils/homeMatchFeed.js';
import { MATCH_CARD_COLUMNS } from '../src/utils/homeMatchColumns.js';
const feedCache = new Map();
const feedPending = new Map();
const LIVE_STATUSES = new Set(['LIVE', 'READY', 'STARTED', 'ONGOING', 'IN_PROGRESS', 'RUNNING', 'VOTING', 'CONFIGURING', 'PAUSED', 'MATCH_STATUS_READY', 'MATCH_STATUS_LIVE', 'MATCH_STATUS_STARTED', 'MATCH_STATUS_ONGOING', 'MATCH_STATUS_VOTING', 'MATCH_STATUS_CONFIGURING', 'MATCH_STATUS_PAUSED']);
export async function loadCards(client, now = new Date()) {
  return loadHomeMatchFeed(client, { columns: MATCH_CARD_COLUMNS, liveStatuses: LIVE_STATUSES,
    now, end: new Date(now.getTime() + 86400000), resultsLimit: 12 });
}
import { createClient } from "@supabase/supabase-js";

export default async function handler(request, response) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseSecretKey =
      process.env.SUPABASE_SECRET_KEY;

    if (!supabaseUrl || !supabaseSecretKey) {
      return response.status(500).json({
        ok: false,
        error: "Supabase environment variables are missing",
      });
    }

    const supabase = createClient(
      supabaseUrl,
      supabaseSecretKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    if (['cards','directory'].includes(request.query?.view)) {
      const view = request.query.view;
      let cached = feedCache.get(view);
      if (!cached || Date.now() - cached.at >= 15000) {
        if (!feedPending.has(view)) {
          const request = view === 'cards' ? loadCards(supabase) : loadHomeMatchFeed(supabase, {
            columns: MATCH_CARD_COLUMNS, liveStatuses: LIVE_STATUSES, now: new Date(), end: null, resultsLimit: 250,
          });
          feedPending.set(view, request.then(result => {
            if (result.error) throw result.error;
            feedCache.set(view, {at: Date.now(), rows: result.data});
          }).finally(() => feedPending.delete(view)));
        }
        await feedPending.get(view);
        cached = feedCache.get(view);
      }
      response.setHeader('Cache-Control', 'public, max-age=0, s-maxage=15, stale-while-revalidate=30');
      return response.status(200).json({ ok: true, rows: cached.rows });
    }

    const now = new Date().toISOString();

    const { data: live, error: liveError } =
      await supabase
        .from("matches")
        .select("*")
        .in("status", [
          "LIVE",
          "ONGOING",
          "MATCH_STATUS_ONGOING",
        ])
        .order("scheduled_at", {
          ascending: true,
        });

    if (liveError) {
      throw liveError;
    }

    const { data: upcoming, error: upcomingError } =
      await supabase
        .from("matches")
        .select("*")
        .in("status", [
          "SCHEDULED",
          "READY",
          "MATCH_STATUS_SCHEDULED",
          "MATCH_STATUS_READY",
        ])
        .gte("scheduled_at", now)
        .order("scheduled_at", {
          ascending: true,
        });

    if (upcomingError) {
      throw upcomingError;
    }

    const { data: recent, error: recentError } =
      await supabase
        .from("matches")
        .select("*")
        .in("status", [
          "FINISHED",
          "MATCH_STATUS_FINISHED",
        ])
        .order("finished_at", {
          ascending: false,
          nullsFirst: false,
        })
        .limit(20);

    if (recentError) {
      throw recentError;
    }

    response.setHeader(
      "Cache-Control",
      "s-maxage=15, stale-while-revalidate=30"
    );

    return response.status(200).json({
      ok: true,
      live,
      upcoming,
      recent,
    });
  } catch (error) {
    console.error("home-matches error:", error);

    return response.status(500).json({
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : String(error),
    });
  }
}