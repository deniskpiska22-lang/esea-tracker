import axios from "axios";

export default async function handler(req, res) {
  const { id } = req.query; // это premade_team_id

  if (!id) return res.status(400).json({ error: "team id required" });

  // Добавляем championship_ids для команды (можно брать из teams.js)
  const championshipIds = [
    "c44e1453-8043-41fe-8b4e-d9f9ac132f40", // Advanced
    "f6d5875a-af46-45f3-9db2-343e3aa974ec", // Advanced playoffs
  ];

  const params = new URLSearchParams();
  for (const chId of championshipIds) params.append("championship_ids", chId);
  params.append("entityId", id);
  params.append("entityType", "PREMADE_TEAM");
  params.append("status", "MATCH_STATUS_FINISHED");
  params.append("offset", 0);
  params.append("limit", 40);

  try {
    const { data } = await axios.get(
      `https://www.faceit.com/api/team-leagues/v2/matches?${params.toString()}`,
      { headers: { "User-Agent": "Mozilla/5.0" } }
    );

    res.status(200).json(
      (data.payload || []).map((m) => ({
        id: m.id,
        score: `${m.team1_score}-${m.team2_score}`,
        opponent: m.team1.premade_team_id === id ? m.team2.name : m.team1.name,
        result: m.winner === id ? "W" : "L",
        date: m.started_at,
      }))
    );
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch team matches" });
  }
}