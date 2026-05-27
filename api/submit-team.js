export default async function handler(req, res) {
  try {
    // Проверяем метод
    if (req.method !== "POST") {
      return res.status(405).json({
        error: "Method not allowed",
      })
    }

    const body = req.body || {}

    const {
      teamName,
      eseaLink,
      contact,
      note,
    } = body

    const text = `
📥 New Team Submission

🏷 Team: ${teamName}

🔗 ESEA:
${eseaLink}

📞 Contact:
${contact}

📝 Note:
${note || "No note"}
`

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
        }),
      }
    )

    const telegramData =
      await telegramResponse.json()

    return res.status(200).json({
      success: true,
      telegramData,
    })

  } catch (error) {
    console.error(error)

    return res.status(500).json({
      error: error.message,
    })
  }
}