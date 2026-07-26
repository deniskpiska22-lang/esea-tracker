export function formatMapName(value) {
  const rawName = String(value || "Unknown").replace(/^de_/i, "");

  if (!rawName) {
    return "Unknown";
  }

  return rawName.charAt(0).toUpperCase() + rawName.slice(1);
}
