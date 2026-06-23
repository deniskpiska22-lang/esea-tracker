import playerAliases from "../data/playerAliases.js";

export function normalizeNickname(nickname) {
  if (!nickname) return "";

  const key = String(nickname).trim();

  // Если это основной ник
  if (playerAliases[key]) {
    return key;
  }

  // Ищем среди алиасов
  for (const [mainNick, aliases] of Object.entries(playerAliases)) {
    const aliasList = Array.isArray(aliases)
      ? aliases
      : [aliases];

    if (aliasList.includes(key)) {
      return mainNick;
    }
  }

  return key;
}