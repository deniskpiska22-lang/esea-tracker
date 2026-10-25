import { seoClient } from '../server/seoData.js';

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  try {
    const { data, error } = await seoClient()
      .from("matches")
      .select('id')
      .limit(1);

    if (error) {
      throw error;
    }

    return response.status(200).json({
      ok: true,
      reachable: true,
      hasMatches: Boolean(data?.length),
    });
  } catch (error) {
    console.error('[database-health]', error.message);

    return response.status(503).json({
      ok: false,
      reachable: false,
    });
  }
}
