const submitTeam = async () => {
  try {
    const res = await fetch("/api/submit-team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        teamName,
        faceitLink, // ВАЖНО
        contact,
        note,
      }),
    })

    const data = await res.json()

    console.log("STATUS:", res.status)
    console.log("DATA:", data)

    if (!res.ok) {
      alert(data.error || "Server error")
      return
    }

    alert("Application sent ✅")

    setShowModal(false)
    setTeamName("")
    setFaceitLink("")
    setContact("")
    setNote("")
  } catch (err) {
    console.error(err)
    alert("Network error")
  }
}