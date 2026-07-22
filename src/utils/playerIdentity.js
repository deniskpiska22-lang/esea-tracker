export const PLAYER_SILHOUETTE =
  "/player-silhouette.png";

export function getPlayerId(player = {}) {
  return (
    player.faceit_id ||
    player.faceitId ||
    player.player_id ||
    player.playerId ||
    player.id ||
    null
  );
}

export function getPlayerNickname(player = {}) {
  return (
    player.nickname ||
    player.player_name ||
    player.playerName ||
    "Unknown"
  );
}

/*
 * Единый источник изображения для всего сайта.
 *
 * Сейчас используем только players.avatar из Supabase.
 * Локальные файлы вида /players/NICK.png намеренно
 * не используются, чтобы TeamPage и PlayerPage
 * никогда не показывали разные изображения.
 */
export function getPlayerAvatar(player = {}) {
  const avatar =
    player.avatar ||
    player.official_photo_url ||
    player.officialPhotoUrl ||
    null;

  return avatar || PLAYER_SILHOUETTE;
}

export function isPlayerSilhouette(player = {}) {
  return (
    getPlayerAvatar(player) ===
    PLAYER_SILHOUETTE
  );
}
