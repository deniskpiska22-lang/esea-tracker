import { Link } from "react-router-dom";
import TeamLogo from "./TeamLogo";

function PlayerCard({
  player,
  team,
  slug,
  averageRating,
  avatarPath,
}) {
  const nickname = player?.nickname ?? player?.name ?? "Unknown";

  const ratingClass =
    averageRating >= 1.1
      ? "text-emerald-400"
      : averageRating < 0.95
        ? "text-rose-400"
        : "text-orange-400";

  const topLine =
    averageRating >= 1.1
      ? "via-emerald-400"
      : averageRating < 0.95
        ? "via-rose-400"
        : "via-orange-400";

  return (
    <Link
      to={`/players/${encodeURIComponent(nickname)}`}
      state={{
        from: `/teams/${slug}`,
        label: `← Back to ${team.name}`,
      }}
      className="group relative overflow-hidden rounded-[22px] border border-white/[0.07] bg-[#101722] transition duration-300 hover:-translate-y-1.5 hover:border-orange-500/25 hover:shadow-[0_20px_50px_rgba(0,0,0,0.28)]"
    >
      <div
        className={`absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent ${topLine} to-transparent`}
      />

      <div className="p-5">
        <div className="relative mx-auto h-32 w-full max-w-[150px] overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0a0f16]">
          <TeamLogo
            src={team.logo}
            name={team.name}
            className="absolute inset-0 h-full w-full scale-125 opacity-[0.14]"
          />

          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0f16] via-transparent to-transparent" />

          <img
            src={avatarPath}
            alt={nickname}
            className="absolute bottom-0 left-1/2 z-10 h-[108%] -translate-x-1/2 object-contain transition duration-300 group-hover:scale-[1.03]"
            onError={(event) => {
              event.currentTarget.src = "/player-silhouette.png";
            }}
          />
        </div>

        <div className="mt-5 text-center">
          <div className="truncate text-lg font-black text-white transition group-hover:text-orange-400">
            {nickname}
          </div>

          <div className={`mt-4 text-4xl font-black leading-none ${ratingClass}`}>
            {Number.isFinite(averageRating)
              ? averageRating.toFixed(2)
              : "—"}
          </div>

          <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.24em] text-slate-600">
            Rating
          </div>

          <div className="mx-auto mt-5 h-px w-full bg-white/[0.07]" />

          <div className="mt-4 text-[10px] font-bold uppercase tracking-[0.24em] text-slate-600">
            FACEIT Elo
          </div>

          <div className="mt-1 text-xl font-black text-white">
            {player?.elo ?? "—"}
          </div>
        </div>
      </div>
    </Link>
  );
}

export default PlayerCard;
