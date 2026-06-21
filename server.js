// server.js
import express from "express";
import axios from "axios";
import cors from "cors";

const app = express();
app.use(cors());

app.get("/api/teamMatches", async (req, res) => {
  const { id } = req.query; // premade_team_id
  if (!id) return res.status(400).json({ error: "team id required" });

  const championshipIds = ["c44e1453-8043-41fe-8b4e-d9f9ac132f40"]; // Season 57

  const params = new URLSearchParams();
  championshipIds.forEach(ch => params.append("championship_ids", ch));
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

    const matches = (data.payload || []).map(m => ({
      id: m.id,
      opponent: m.team1.premade_team_id === id ? m.team2.name : m.team1.name,
      score: `${m.team1_score}-${m.team2_score}`,
      result: m.winner === id ? "W" : "L",
      date: m.started_at,
    }));

    res.json(matches);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch team matches" });
  }
});

app.listen(5000, () => console.log("API server running on http://localhost:5000"));