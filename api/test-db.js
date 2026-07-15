import { supabase } from "../lib/supabase.js";

export default async function handler(request, response) {
  try {
    const { data, error } = await supabase
      .from("matches")
      .select("*")
      .limit(5);

    if (error) {
      console.error("Supabase error:", error);

      return response.status(500).json({
        ok: false,
        error: error.message,
        details: error,
      });
    }

    return response.status(200).json({
      ok: true,
      matches: data,
    });
  } catch (error) {
    console.error("API error:", error);

    return response.status(500).json({
      ok: false,
      error: error.message,
    });
  }
}