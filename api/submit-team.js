const submitTeam = async () => {
  try {
    console.log("🔥 CLICKED")

    const response = await fetch("/api/submit-team", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        teamName,
        faceitLink,
        contact,
        note,
      }),
    })

    console.log("📡 STATUS:", response.status)

    const text = await response.text()

    console.log("📦 RAW RESPONSE:", text)

    alert(`STATUS: ${response.status}\n\n${text}`)
  } catch (error) {
    console.log("💥 FETCH ERROR:", error)
    alert("FETCH FAILED: " + error.message)
  }
}