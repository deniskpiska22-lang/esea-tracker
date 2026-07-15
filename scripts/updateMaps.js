import axios from "axios";

const FACEIT_API_KEY = process.env.FACEIT_API_KEY;
const matchId = process.argv[2];

if (!FACEIT_API_KEY) throw new Error("FACEIT_API_KEY is required");
if (!matchId) throw new Error("Usage: node --env-file=.env.local scripts/updateMaps.js <matchId>");

const { data } = await axios.get(`https://open.faceit.com/data/v4/matches/${matchId}/stats`, {
  headers: { Authorization: `Bearer ${FACEIT_API_KEY}` },
});

console.log(JSON.stringify(data, null, 2));
