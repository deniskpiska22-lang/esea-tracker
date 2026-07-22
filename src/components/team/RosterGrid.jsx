import { Link } from "react-router-dom";
import PlayerCard from "./PlayerCard";

function RosterGrid({
  roster,
  team,
  slug,
  playerAverageRatings,
  normalizeNickname,
}) {
  return (
    <section>
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.22em] text-orange-400">
            Active lineup
          </div>

          <h2 className="mt-1 text-2xl font-black text-white">
            Team roster
          </h2>
        </div>

        <Link
          to={`/teams/${slug}/players`}
          className="text-sm font-bold text-orange-400 transition hover:text-orange-300"
        >
          All players →
        </Link>
      </div>

      {roster.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {roster.slice(0, 5).map((player, index) => {
            const nickname =
              player?.nickname ?? player?.name ?? `Player ${index + 1}`;

            const averageRating = Number(
              playerAverageRatings?.[nickname]
            );

            const avatarPath =
              `/players/${normalizeNickname(nickname)}.png`;

            return (
              <PlayerCard
                key={`${nickname}-${index}`}
                player={player}
                team={team}
                slug={slug}
                averageRating={averageRating}
                avatarPath={avatarPath}
              />
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-5 py-12 text-center text-sm text-slate-500">
          Roster information is not available yet.
        </div>
      )}
    </section>
  );
}

export default RosterGrid;
