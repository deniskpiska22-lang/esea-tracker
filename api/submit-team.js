const submitTeam = async () => {
  const res = await fetch("/api/submit-team", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      teamName,
      faceitLink,
      contact,
      note,
    }),
  })

  const text = await res.text()

  console.log("STATUS:", res.status)
  console.log("RAW RESPONSE:", text)

  alert(text)
}