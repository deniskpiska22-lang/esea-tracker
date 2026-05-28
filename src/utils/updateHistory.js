import history from "../data/teamHistory.json"

export function getTeamHistory(slug) {
  return history[slug] || []
}