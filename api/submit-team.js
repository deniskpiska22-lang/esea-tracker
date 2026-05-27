const submitTeam = async () => {
  try {
    console.log("🔥 CLICKED")

    const res = await fetch("/api/submit-team", {
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

    console.log("📡 STATUS:", res.status)

    const text = await res.text()
    console.log("📦 RAW:", text)

    // НЕ парсим JSON — чтобы не падало
    alert("STATUS: " + res.status + "\n\n" + text)

  } catch (err) {
    console.log("💥 ERROR:", err)
    alert("FETCH FAILED: " + err.message)
  }
}