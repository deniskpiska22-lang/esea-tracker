// src/utils/normalizeNickname.js
import playerAliases from "../data/playerAliases.js";

export function normalizeNickname(nickname) {
  if (!nickname) return "";
  const key = String(nickname).trim();
  return playerAliases[key] || key;
}