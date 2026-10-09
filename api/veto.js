import process from "node:process";
import { createClient } from "@supabase/supabase-js";
import { parseVetoSteps } from "../scripts/lib/veto.js";

function storedPayload(steps) {
  return { payload: { tickets: [{ entity_type: "map", entities: steps.map((step) => ({
    guid: step.map, round: step.round,
    status: step.action === "Banned" ? "ban" : "pick",
    selected_by: step.selectedBy,
  })) }] } };
}

export default async function handler(request, response) {
  const matchId = request.query?.matchId;
  if (!matchId || typeof matchId !== "string" || !/^[-a-zA-Z0-9]{1,100}$/.test(matchId)) {
    return response.status(400).json({ error: "Valid matchId is required" });
  }
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  const rawUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const url = rawUrl ? new URL(rawUrl.trim()).origin : null;
  const db = url && key ? createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10000) }) },
  }) : null;
  try {
    const { data: match, error: readError } = db ? await db.from("matches")
      .select("status,veto_steps").eq("id", matchId).maybeSingle() : { data: null };
    if (readError) console.warn("Veto cache read failed:", readError.message);
    const finished = ["FINISHED", "MATCH_STATUS_FINISHED"].includes(match?.status);
    if (finished && Array.isArray(match.veto_steps) && match.veto_steps.length) {
      response.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
      return response.status(200).json(storedPayload(match.veto_steps));
    }
    const upstream = await fetch(`https://www.faceit.com/api/democracy/v1/match/${encodeURIComponent(matchId)}/history`, {
      headers: { Accept: "application/json" }, signal: AbortSignal.timeout(10000),
    });
    if (!upstream.ok) return response.status(upstream.status).json({ error: "Failed to load veto history" });
    const data = await upstream.json();
    const steps = parseVetoSteps(data);
    if (db && finished && steps) {
      const { error } = await db.from("matches").update({ veto_steps: steps,
        veto_synced: true, veto_unavailable: false, veto_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString() }).eq("id", matchId);
      if (error) console.warn("Veto cache write failed:", error.message);
    }
    response.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
    return response.status(200).json(data);
  } catch (error) {
    console.warn("Veto API error:", error.message);
    return response.status(502).json({ error: "Veto provider temporarily unavailable" });
  }
}
