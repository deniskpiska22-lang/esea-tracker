const DEFAULT_BASE = "https://www.faceit.com/api/team-leagues/v2";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class SeasonHierarchyClient {
  constructor({
    baseUrl = process.env.FACEIT_TEAM_LEAGUES_API || DEFAULT_BASE,
    retries = 3,
    timeoutMs = 30_000,
  } = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.retries = retries;
    this.timeoutMs = timeoutMs;
  }

  buildTreeUrl(seasonId) {
    if (!seasonId) throw new Error("seasonId is required");
    const url = new URL(`${this.baseUrl}/seasons/tree`);
    url.searchParams.set("entityType", "season");
    url.searchParams.set("entityId", seasonId);
    return url;
  }

  async getSeason(seasonId, explicitUrl = "") {
    const url = explicitUrl
      ? new URL(explicitUrl.replaceAll("{seasonId}", seasonId))
      : this.buildTreeUrl(seasonId);

    let lastError;
    for (let attempt = 1; attempt <= this.retries; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await fetch(url, {
          headers: {
            accept: "application/json, text/plain, */*",
            "faceit-referer": "web-next",
            "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
            referer: "https://www.faceit.com/",
          },
          signal: controller.signal,
        });
        const body = await response.text();
        if (!response.ok) {
          throw new Error(`${response.status} ${response.statusText}: ${body.slice(0, 500)}`);
        }
        let payload;
        try { payload = JSON.parse(body); }
        catch { throw new Error(`FACEIT returned invalid JSON: ${body.slice(0, 300)}`); }
        return { payload, url: url.toString() };
      } catch (error) {
        lastError = error;
        if (attempt < this.retries) await sleep(attempt * 1000);
      } finally {
        clearTimeout(timeout);
      }
    }
    throw new Error(`Could not load FACEIT season tree from ${url}: ${lastError?.message || "unknown error"}`);
  }
}
