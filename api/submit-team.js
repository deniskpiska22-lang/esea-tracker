export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Only POST" })
    }

    console.log("BODY:", req.body)

    const { teamName, faceitLink, contact, note } = req.body || {}

    console.log("ENV CHECK:", {
      token: process.env.TELEGRAM_BOT_TOKEN ? "OK" : "MISSING",
      chat: process.env.TELEGRAM_CHAT_ID ? "OK" : "MISSING",
    })

    const text = `
NEW TEAM

Team: ${teamName}
FACEIT: ${faceitLink}
Contact: ${contact}
Note: ${note || "-"}
`.trim()

    const r = await fetch(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: process.env.TELEGRAM_CHAT_ID,
          text,
        }),
      }
    )

    const data = await r.json()

    console.log("TELEGRAM RESPONSE:", data)

    return res.status(200).json({ success: true, data })

  } catch (e) {
    console.error("API ERROR:", e)
    return res.status(500).json({ error: e.message })
  }
}