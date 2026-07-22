const BASE_URL =
  "https://www.faceit.com/api/team-leagues/v2/standings";

const DEFAULT_HEADERS = {
  Accept: "application/json",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
  Referer: "https://www.faceit.com/",
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class FaceitStandingsClient {
  constructor({
    userId = "",
    limit = 100,
    timeoutMs = 30_000,
    retries = 3,
    retryDelayMs = 1_000,
  } = {}) {
    this.userId = userId.trim();
    this.limit = Math.min(Math.max(Number(limit) || 100, 1), 100);
    this.timeoutMs = timeoutMs;
    this.retries = retries;
    this.retryDelayMs = retryDelayMs;
  }

  buildUrl({ entityId, entityType, offset = 0, limit = this.limit }) {
    if (!entityId) {
      throw new Error("entityId is required");
    }

    if (!["stage", "conference"].includes(entityType)) {
      throw new Error(
        `entityType must be "stage" or "conference", received: ${entityType}`
      );
    }

    const url = new URL(BASE_URL);
    url.searchParams.set("entityId", entityId);
    url.searchParams.set("entityType", entityType);
    url.searchParams.set("offset", String(offset));
    url.searchParams.set("limit", String(Math.min(limit, 100)));

    // userId нужен FACEIT только для user_team_standing.
    // Сам список standings обычно доступен и без него.
    if (this.userId) {
      url.searchParams.set("userId", this.userId);
    }

    return url;
  }

  async requestPage({ entityId, entityType, offset = 0, limit = this.limit }) {
    const url = this.buildUrl({ entityId, entityType, offset, limit });
    let lastError;

    for (let attempt = 1; attempt <= this.retries; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const response = await fetch(url, {
          headers: DEFAULT_HEADERS,
          signal: controller.signal,
        });

        const bodyText = await response.text();

        if (!response.ok) {
          throw new Error(
            `FACEIT standings ${response.status}: ${bodyText.slice(0, 500)}`
          );
        }

        const json = JSON.parse(bodyText);
        const payload = json?.payload ?? json;
        const standings = Array.isArray(payload?.standings)
          ? payload.standings
          : [];

        return {
          url: url.toString(),
          entityId: payload?.entity_id ?? entityId,
          entityType: payload?.entity_type ?? entityType,
          tournamentType: payload?.tournament_type ?? null,
          userTeamStanding: payload?.user_team_standing ?? null,
          standings,
        };
      } catch (error) {
        lastError = error;

        if (attempt < this.retries) {
          await sleep(this.retryDelayMs * attempt);
        }
      } finally {
        clearTimeout(timeout);
      }
    }

    throw lastError;
  }

  async getAll({ entityId, entityType }) {
    const all = [];
    let offset = 0;

    while (true) {
      const page = await this.requestPage({
        entityId,
        entityType,
        offset,
        limit: this.limit,
      });

      all.push(...page.standings);

      // В текущих группах меньше 100 команд, поэтому обычно цикл завершится
      // после первого запроса. Пагинация оставлена на будущее.
      if (page.standings.length < this.limit) {
        return {
          entityId: page.entityId,
          entityType: page.entityType,
          tournamentType: page.tournamentType,
          standings: all,
        };
      }

      offset += this.limit;
    }
  }
}
