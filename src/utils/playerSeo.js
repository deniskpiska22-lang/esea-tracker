const SITE_ORIGIN = "https://eseatracker.ru";

export function isFaceitPlayerId(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    String(value || "").trim()
  );
}

function finiteNumber(value) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function compactNumber(value, digits = 2) {
  const number = finiteNumber(value);
  return number === null ? null : number.toFixed(digits).replace(/\.00$/, "");
}

export function getPlayerAliases(player, aliasesByNickname = {}) {
  const nickname = String(player?.nickname || "").trim();
  const aliases = aliasesByNickname[nickname] || [];
  const seen = new Set([nickname.toLowerCase()]);

  return aliases
    .map((alias) => String(alias || "").trim())
    .filter((alias) => {
      const normalized = alias.toLowerCase();
      if (!normalized || seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });
}

export function getPlayerSeoMetadata(player, aliasesByNickname = {}) {
  const playerId = String(player?.playerId || player?.player_id || "").trim();
  const rawNickname = String(player?.nickname || "").trim();
  // UUID is an internal FACEIT identifier, not a searchable player name.
  // Never expose it as a title/description fallback while identity data loads.
  const nickname =
    rawNickname && !isFaceitPlayerId(rawNickname) ? rawNickname : "Player";
  const teamName = String(player?.teamName || player?.team_name || "").trim();
  const rating = compactNumber(player?.rating);
  const mapsPlayed = finiteNumber(player?.mapsPlayed ?? player?.maps_played);
  const kd = compactNumber(player?.kd);
  const adr = compactNumber(player?.adr, 1);
  const aliases = getPlayerAliases(player, aliasesByNickname);
  const canonicalPath = rawNickname && !isFaceitPlayerId(rawNickname)
    ? `/players/${encodeURIComponent(rawNickname)}`
    : isFaceitPlayerId(playerId) ? `/players/${playerId}` : "/players";
  const facts = [
    teamName ? `team ${teamName}` : null,
    rating ? `rating ${rating}` : null,
    mapsPlayed !== null ? `${mapsPlayed} maps` : null,
    kd ? `K/D ${kd}` : null,
    adr ? `ADR ${adr}` : null,
  ].filter(Boolean);
  const description = `${nickname} — ESEA CS2 player profile${
    facts.length ? `: ${facts.join(", ")}` : ""
  }. Match results, team and individual statistics on ESEA Tracker.`;

  return {
    title: `${nickname} CS2 — Stats, Team & Results | ESEA Tracker`,
    description,
    canonicalPath,
    canonicalUrl: `${SITE_ORIGIN}${canonicalPath}`,
    image: player?.avatar || `${SITE_ORIGIN}/logo.png`,
    aliases,
    language: "en",
  };
}

export { SITE_ORIGIN };
