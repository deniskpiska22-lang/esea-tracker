import { useParams } from "react-router-dom"

const teams = [
  {
    slug: "donstu-esports",
    name: "DONSTU ESPORTS",
    points: 214,
    record: "12-2",
    division: "Advanced",
    players: ["player1", "player2", "player3", "player4", "player5"]
  },
  {
    slug: "quazar",
    name: "QUAZAR",
    points: 210,
    record: "10-4",
    division: "Advanced",
    players: ["q1", "q2", "q3", "q4", "q5"]
  }
]

export default function TeamPage() {
  const { slug } = useParams()

  const team = teams.find(t => t.slug === slug)

  if (!team) {
    return <div style={{ color: "white", padding: 20 }}>Team not found</div>
  }

  return (
    <div style={{ color: "white", padding: 20 }}>

      <h1>{team.name}</h1>

      <p>Points: {team.points}</p>
      <p>Record: {team.record}</p>
      <p>Division: {team.division}</p>

      <h3>Players</h3>

      {team.players.map((p, i) => (
        <div key={i}>{p}</div>
      ))}

    </div>
  )
}