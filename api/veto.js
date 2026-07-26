export default async function handler(request, response) {
  const matchId = request.query?.matchId;

  if (!matchId || typeof matchId !== "string") {
    return response.status(400).json({
      error: "matchId is required",
    });
  }

  try {
    const vetoResponse = await fetch(
      `https://www.faceit.com/api/democracy/v1/match/${encodeURIComponent(
        matchId
      )}/history`,
      {
        headers: {
          Accept: "application/json",
        },
      }
    );

    if (!vetoResponse.ok) {
      return response.status(vetoResponse.status).json({
        error: "Failed to load veto history",
      });
    }

    const data = await vetoResponse.json();

    response.setHeader(
      "Cache-Control",
      "s-maxage=60, stale-while-revalidate=300"
    );

    return response.status(200).json(data);
  } catch (error) {
    console.error("Veto API error:", error);

    return response.status(500).json({
      error: "Internal server error",
    });
  }
}
