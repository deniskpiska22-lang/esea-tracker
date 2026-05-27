const submitTeam = async () => {
  try {
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

    const data = await response.json()

    console.log("SERVER RESPONSE:", data)

    if (!response.ok) {
      alert(data.error || "Server error ❌")
      return
    }

    alert("Application sent ✅")

    setShowModal(false)

    setTeamName("")
    setFaceitLink("")
    setContact("")
    setNote("")

  } catch (error) {
    console.error("FETCH ERROR:", error)

    alert(error.message || "Something went wrong ❌")
  }
}