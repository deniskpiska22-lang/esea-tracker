export default async function handler(req, res) {
  // Только POST запросы
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
    })
  }

  const {
    teamName,
    eseaLink,
    contact,
    note,
  } = req.body

  // Сообщение в Telegram
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

  try {
    const response = await fetch(
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

    const data = await response.json()

    return res.status(200).json({
      success: true,
      telegram: data,
    })

  } catch (error) {
    return res.status(500).json({
      error: "Failed to send message",
    })
  }
}