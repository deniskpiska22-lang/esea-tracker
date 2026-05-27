const submitTeam = async () => {
  console.log("🔥 submitTeam triggered")

  try {
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
    console.log("📦 RAW RESPONSE:", text)

    alert("STATUS: " + res.status + "\n" + text)
  } catch (err) {
    console.log("💥 FETCH ERROR:", err)
    alert("FETCH ERROR: " + err.message)
  }
}