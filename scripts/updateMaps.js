import fs from "fs";
import axios from "axios";

const matches = (await import("../src/data/matches.js")).default;

const FACEIT_API_KEY = "1f7e7c47-0d9b-403e-9007-acd463de617b";

async function test() {
  const matchId =
    "1-34d86d96-3493-4cbf-95cc-8f2a2296229a";

  const { data } = await axios.get(
    `https://open.faceit.com/data/v4/matches/${matchId}/stats`,
    {
      headers: {
        Authorization: `Bearer ${FACEIT_API_KEY}`,
      },
    }
  );

  console.log(
    JSON.stringify(data, null, 2)
  );
}

test();