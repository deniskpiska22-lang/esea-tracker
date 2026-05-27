export default async function handler(req, res) {
  try {
    // ❌ только POST
    if (req.method !== "POST") {
      return res.status(405).json({
        success: false,
        error: "Method not allowed",
      })
    }

    const { teamName, faceitLink, contact, note } = req.body || {}

    // ❌ валидация
    if (!teamName || !faceitLink || !contact) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
      })
    }

    // 📩 сообщение в Telegram
    const text = `
📥 NEW TEAM SUBMISSION

🏷 Team: ${teamName}
🎯 FACEIT: ${faceitLink}
📞 Contact: ${contact}
📝 Note: ${note || "No note"}
    `.trim()

    // 📡 отправка в Telegram
    const telegramResponse = await fetch(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: process.env.TELEGRAM_CHAT_ID,
          text,
          disable_web_page_preview: true,
        }),
      }
    )

    const telegramData = await telegramResponse.json()

    // ❌ ошибка Telegram
    if (!telegramResponse.ok || !telegramData.ok) {
      console.error("Telegram API error:", telegramData)

      return res.status(500).json({
        success: false,
        error: "Telegram API failed",
        details: telegramData,
      })
    }

    // ✅ успех
    return res.status(200).json({
      success: true,
      message: "Sent to Telegram",
    })

  } catch (error) {
    console.error("API ERROR:", error)

    return res.status(500).json({
      success: false,
      error: error.message,
    })
  }
}