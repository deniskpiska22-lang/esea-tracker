import { Link } from "react-router-dom";

import { findTournamentByName } from "../utils/tournaments";

// Drop-in replacement for rendering a competition/season name as plain
// text: links to the tournament page when that name matches something we
// imported (src/data/tournaments.generated.json), otherwise renders exactly
// the same as before.
export default function TournamentNameLink({ name, className }) {
  if (!name) return null;

  const tournament = findTournamentByName(name);

  if (!tournament) {
    return <>{name}</>;
  }

  return (
    <Link
      to={`/calendar/${tournament.id}`}
      onClick={(event) => event.stopPropagation()}
      className={`transition hover:text-orange-400 ${className || ""}`}
    >
      {name}
    </Link>
  );
}
