const SITE_ORIGIN = "https://eseatracker.ru";

export function isFaceitPlayerId(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    String(value || "").trim()
  );
}

function finiteNumber(value) {
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
  const nickname = String(player?.nickname || "Игрок").trim();
  const teamName = String(player?.teamName || player?.team_name || "").trim();
  const rating = compactNumber(player?.rating);
  const mapsPlayed = finiteNumber(player?.mapsPlayed ?? player?.maps_played);
  const kd = compactNumber(player?.kd);
  const adr = compactNumber(player?.adr, 1);
  const aliases = getPlayerAliases(player, aliasesByNickname);
  const canonicalPath = isFaceitPlayerId(playerId)
    ? `/players/${playerId}`
    : "/players";
  const facts = [
    teamName ? `команда ${teamName}` : null,
    rating ? `рейтинг ${rating}` : null,
    mapsPlayed !== null ? `${mapsPlayed} карт` : null,
    kd ? `K/D ${kd}` : null,
    adr ? `ADR ${adr}` : null,
  ].filter(Boolean);
  const description = `${nickname} — профиль игрока ESEA CS2${
    facts.length ? `: ${facts.join(", ")}` : ""
  }. Матчи, команда и индивидуальная статистика на ESEA Tracker.`;

  return {
    title: `${nickname} — статистика игрока ESEA CS2 | ESEA Tracker`,
    description,
    canonicalPath,
    canonicalUrl: `${SITE_ORIGIN}${canonicalPath}`,
    image: player?.avatar || `${SITE_ORIGIN}/logo.png`,
    aliases,
  };
}

export { SITE_ORIGIN };
