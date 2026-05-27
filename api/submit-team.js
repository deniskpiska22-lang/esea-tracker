export const config = {
  api: {
    bodyParser: true,
  },
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({
        success: false,
        error: "Only POST allowed",
      })
    }

    const {
      teamName,
      faceitLink,
      contact,
      note,
    } = req.body || {}

    if (!teamName || !faceitLink || !contact) {
      return res.status(400).json({
        success: false,
        error: "Missing fields",
      })
    }

    const text = `
📥 NEW TEAM SUBMISSION

🏷 Team: ${teamName}
🎯 FACEIT: ${faceitLink}
📞 Contact: ${contact}
📝 Note: ${note || "No note"}
`.trim()

    const telegramRes = await fetch(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: process.env.TELEGRAM_CHAT_ID,
          text,
        }),
      }
    )

    const telegramData = await telegramRes.json()

    if (!telegramRes.ok || !telegramData.ok) {
      console.log("TELEGRAM ERROR:", telegramData)

      return res.status(500).json({
        success: false,
        error: "Telegram failed",
        details: telegramData,
      })
    }

    return res.status(200).json({
      success: true,
      message: "Sent successfully",
    })

  } catch (error) {
    console.error("API ERROR:", error)

    return res.status(500).json({
      success: false,
      error: error.message,
    })
  }
}