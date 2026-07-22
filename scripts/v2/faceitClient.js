const OPEN_API_BASE_URL = "https://open.faceit.com/data/v4";
const WEB_API_BASE_URL = "https://www.faceit.com/api";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class FaceitClient {
  constructor({
    apiKey =
      process.env.FACEIT_API_KEY ||
      process.env.VITE_FACEIT_API_KEY ||
      process.env.FACEIT_TOKEN ||
      process.env.VITE_FACEIT_TOKEN,
    minDelayMs = 150,
  } = {}) {
    this.apiKey = apiKey;
    this.minDelayMs = minDelayMs;
    this.lastRequestAt = 0;
  }

  async throttle() {
    const elapsed = Date.now() - this.lastRequestAt;
    if (elapsed < this.minDelayMs) {
      await sleep(this.minDelayMs - elapsed);
    }
  }

  async fetchJson(url, { requiresApiKey = false } = {}) {
    if (requiresApiKey && !this.apiKey) {
      throw new Error(
        "FACEIT_API_KEY is missing. Add it to .env.local to load full team/player profiles."
      );
    }

    await this.throttle();

    const headers = {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0 ESEA-Tracker-2.0/diagnostic",
    };

    if (requiresApiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(url, { headers });
    this.lastRequestAt = Date.now();

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `FACEIT ${response.status} ${response.statusText} for ${url}: ${body.slice(0, 300)}`
      );
    }

    return response.json();
  }

  async openApiRequest(path, query = {}) {
    const url = new URL(`${OPEN_API_BASE_URL}${path}`);
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }

    return this.fetchJson(url, { requiresApiKey: true });
  }

  async getTeamLeagueMatches({
    teamId,
    championshipIds,
    status = "MATCH_STATUS_FINISHED",
    maxItems = Infinity,
    limit = 40,
  }) {
    const items = [];
    let offset = 0;

    while (items.length < maxItems) {
      const pageLimit = Math.min(limit, maxItems - items.length);
      const url = new URL(`${WEB_API_BASE_URL}/team-leagues/v2/matches`);

      for (const championshipId of championshipIds) {
        url.searchParams.append("championship_ids", championshipId);
      }

      url.searchParams.set("entityId", teamId);
      url.searchParams.set("entityType", "PREMADE_TEAM");
      url.searchParams.set("status", status);
      url.searchParams.set("offset", String(offset));
      url.searchParams.set("limit", String(pageLimit));

      const data = await this.fetchJson(url);
      const page = Array.isArray(data.payload) ? data.payload : [];
      items.push(...page);

      if (page.length < pageLimit) break;
      offset += page.length;
    }

    return items;
  }

  getTeam(id) {
    return this.openApiRequest(`/teams/${id}`);
  }

  getPlayer(id) {
    return this.openApiRequest(`/players/${id}`);
  }
}
