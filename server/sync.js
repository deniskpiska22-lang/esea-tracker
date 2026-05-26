import fetch from "node-fetch"
import fs from "fs"
import cron from "node-cron"

// 🔑 сюда потом вставишь ключ FACEIT
const FACEIT_KEY = "YOUR_FACEIT_API_KEY"

// 👇 пример команд (пока вручную)
const TEAMS = [
  {
    slug: "cybershoke-prospects",
    faceitId: "PUT_TEAM_ID_HERE"
  }
]

// 📡 запрос матчей команды
async function getTeamMatches(teamId) {
  const res = await fetch(
    `https://open.faceit.com/data/v4/teams/${teamId}/matches?limit=5`,
    {
      headers: {
        Authorization: `Bearer ${FACEIT_KEY}`
      }
    }
  )

  const data = await res.json()
  return data.items || []
}

// 🔄 sync всех команд
async function syncAllTeams() {
  const result = {}

  for (const team of TEAMS) {
    try {
      const matches = await getTeamMatches(team.faceitId)

      result[team.slug] = matches.map((m) => {
        return {
          matchId: m.match_id,
          competition: m.competition_name,
          status: m.status,
          playedAt: m.started_at
        }
      })

    } catch (err) {
      console.log("Error for team:", team.slug, err.message)
      result[team.slug] = []
    }
  }

  // 💾 сохраняем в файл
  fs.writeFileSync(
    "./server/matches.json",
    JSON.stringify(result, null, 2)
  )

  console.log("SYNC DONE:", new Date().toISOString())
}

// 🚀 первый запуск сразу
syncAllTeams()

// ⏱ авто обновление каждые 10 минут
cron.schedule("*/10 * * * *", () => {
  syncAllTeams()
})