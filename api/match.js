export default async function handler(request, response) {
  const matchId = request.query?.matchId;

  if (!matchId || typeof matchId !== "string") {
    return response.status(400).json({
      error: "matchId is required",
    });
  }

  const apiKey = process.env.FACEIT_API_KEY;

  if (!apiKey) {
    return response.status(500).json({
      error: "FACEIT_API_KEY is not configured",
    });
  }

  try {
    const faceitResponse = await fetch(
      `https://open.faceit.com/data/v4/matches/${encodeURIComponent(
        matchId
      )}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
        },
      }
    );

    if (!faceitResponse.ok) {
      const details = await faceitResponse.text();

      console.error(
        "FACEIT response:",
        faceitResponse.status,
        details
      );

      return response.status(faceitResponse.status).json({
        error: "Failed to load FACEIT match",
      });
    }

    const data = await faceitResponse.json();

    response.setHeader(
      "Cache-Control",
      "s-maxage=5, stale-while-revalidate=5"
    );

    return response.status(200).json(data);
  } catch (error) {
    console.error("Match API error:", error);

    return response.status(500).json({
      error: "Internal server error",
    });
  }
}