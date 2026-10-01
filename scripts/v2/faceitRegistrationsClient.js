// Registration fallback before FACEIT publishes the regular-season standings.
export async function getRegistrations(seasonId, entity) {
  const rows = [];
  const seen = new Set();
  for (let offset = 0; offset < 10000; offset += 100) {
    const url = new URL(`https://www.faceit.com/api/team-leagues/v2/teams/seasons/${seasonId}/registrations`);
    url.searchParams.set("division_id", entity.divisionId);
    url.searchParams.set("region_id", entity.regionId);
    url.searchParams.set("offset", String(offset));
    url.searchParams.set("limit", "100");
    const response = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`FACEIT registrations: HTTP ${response.status}`);
    const json = await response.json();
    if (!Array.isArray(json.payload)) throw new Error("Malformed FACEIT registrations response");
    for (const row of json.payload) {
      if (!row.premade_team_id) throw new Error("Registration has no premade_team_id");
      if (seen.has(row.premade_team_id)) throw new Error("FACEIT registration pagination repeated a team");
      seen.add(row.premade_team_id);
      rows.push(row);
    }
    if (json.payload.length < 100) return rows;
  }
  throw new Error("FACEIT registration pagination exceeded safety limit");
}
