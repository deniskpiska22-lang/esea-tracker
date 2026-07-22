import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { Link } from "react-router-dom";
import { useTeamRoster } from "../hooks/useTeamRoster";
import { supabase } from "../lib/supabaseClient";

const SILHOUETTE =
  "/player-silhouette.png";

function getPlayerFaceitId(player) {
  return (
    player?.faceit_id ||
    player?.faceitId ||
    player?.playerId ||
    player?.player_id ||
    null
  );
}

function getPlayerUrl(player) {
  const playerId =
    getPlayerFaceitId(player);

  return playerId
    ? `/player/${encodeURIComponent(
        playerId
      )}`
    : "#";
}

function getTeamLogo(team) {
  return (
    team?.logo ||
    team?.logoUrl ||
    team?.logo_url ||
    null
  );
}

function getRatingStyle(rating) {
  if (!Number.isFinite(rating)) {
    return {
      top: "bg-slate-600",
      text: "text-slate-400",
    };
  }

  if (rating >= 1.1) {
    return {
      top: "bg-emerald-400",
      text: "text-emerald-400",
    };
  }

  if (rating >= 1.0) {
    return {
      top: "bg-orange-500",
      text: "text-orange-500",
    };
  }

  return {
    top: "bg-rose-500",
    text: "text-rose-400",
  };
}

function PlayerPortrait({
  player,
  team,
}) {
  const teamLogo =
    getTeamLogo(team);

  return (
    <div className="relative mx-auto h-[142px] w-[142px] overflow-hidden rounded-[16px]">
      {teamLogo && (
        <img
          src={teamLogo}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-contain scale-[1.08] opacity-[0.16] grayscale blur-[1px]"
        />
      )}

      <img
        src={SILHOUETTE}
        alt={`Player silhouette for ${player.nickname}`}
        className="absolute inset-0 z-10 h-full w-full object-contain object-bottom scale-[1.03]"
      />

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#121b27]/40" />
      <div className="absolute inset-0 rounded-[16px] ring-1 ring-white/5" />

<div className="absolute inset-0 rounded-[16px] shadow-[inset_0_0_40px_rgba(0,0,0,0.35)]" />
    </div>
  );
}

function PlayerCard({
  player,
  team,
  slug,
  rating,
}) {
  const numericRating =
    Number(rating);

  const hasRating =
    Number.isFinite(
      numericRating
    ) &&
    numericRating > 0;

  const style =
    getRatingStyle(
      hasRating
        ? numericRating
        : null
    );

  const playerUrl =
    getPlayerUrl(player);

  return (
    <Link
      to={playerUrl}
      state={{
        from: `/teams/${slug}`,
        label: `← Back to ${team.name}`,
      }}
      onClick={(event) => {
        if (playerUrl === "#") {
          event.preventDefault();
        }
      }}
      className={[
        "group relative min-w-0 overflow-hidden",
        "rounded-[24px] border border-[#2a394c]",
        "bg-[#121b27] px-6 pb-6 pt-8 text-center",
        "transition duration-300",
        "hover:-translate-y-1 hover:border-[#445a74]",
        "hover:bg-[#15202d] hover:shadow-2xl",
      ].join(" ")}
    >
      <div
        className={[
          "absolute inset-x-0 top-0 h-[4px]",
          style.top,
        ].join(" ")}
      />

      <div className="-mt-3 mb-3">
  <PlayerPortrait
    player={player}
    team={team}
  />
</div>

<div
  title={player.nickname}
  className="truncate text-[16px] font-black text-white transition group-hover:text-orange-400"
>
        {player.nickname}
      </div>

      <div
        className={[
          "mt-7 text-[38px] font-black leading-none tracking-[-0.04em]",
          style.text,
        ].join(" ")}
      >
        {hasRating
          ? numericRating.toFixed(2)
          : "—"}
      </div>

      <div className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.24em] text-[#7185a0]">
        Rating
      </div>

      <div className="mx-auto mt-6 h-px w-full bg-[#2c3b4e]" />

      <div className="mt-5 text-[10px] font-semibold uppercase tracking-[0.24em] text-[#7185a0]">
        FACEIT ELO
      </div>

      <div className="mt-2 text-[21px] font-black leading-none text-white">
        {player.faceit_elo ??
          "—"}
      </div>
    </Link>
  );
}

export default function TeamRosterSection({
  team,
  slug,
}) {
  const teamId =
    team?.faceitTeamId ||
    team?.faceit_team_id ||
    team?.teamId ||
    team?.id;

  const roster =
    useTeamRoster(teamId);

  const [ratingsByPlayerId, setRatingsByPlayerId] =
    useState({});

  const [ratingsLoading, setRatingsLoading] =
    useState(false);

  const visiblePlayers =
    useMemo(
      () =>
        Array.isArray(
          roster.starting
        )
          ? roster.starting.slice(
              0,
              5
            )
          : [],
      [roster.starting]
    );

  const faceitIds =
    useMemo(
      () =>
        visiblePlayers
          .map(
            getPlayerFaceitId
          )
          .filter(Boolean),
      [visiblePlayers]
    );

  useEffect(() => {
    let cancelled = false;

    async function loadRatings() {
      if (
        !supabase ||
        faceitIds.length === 0
      ) {
        setRatingsByPlayerId(
          {}
        );
        return;
      }

      setRatingsLoading(true);

      try {
        const {
          data,
          error,
        } = await supabase
          .from(
            "player_ratings"
          )
          .select(
            "player_id,rating,recent_rating"
          )
          .in(
            "player_id",
            faceitIds
          );

        if (error) {
          throw error;
        }

        if (cancelled) {
          return;
        }

        const nextRatings = {};

        for (
          const row of data || []
        ) {
          nextRatings[
            row.player_id
          ] =
            Number(
              row.rating ??
                row.recent_rating
            );
        }

        setRatingsByPlayerId(
          nextRatings
        );
      } catch (error) {
        console.warn(
          "Player ratings unavailable:",
          error.message
        );

        if (!cancelled) {
          setRatingsByPlayerId(
            {}
          );
        }
      } finally {
        if (!cancelled) {
          setRatingsLoading(
            false
          );
        }
      }
    }

    loadRatings();

    return () => {
      cancelled = true;
    };
  }, [
    faceitIds.join("|"),
  ]);

  return (
    <section className="mt-8">
      {roster.loading && (
        <div className="rounded-2xl border border-white/[0.06] bg-[#101720] p-8 text-center text-slate-500">
          Loading current
          lineup…
        </div>
      )}

      {!roster.loading &&
        roster.error && (
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-5 text-sm text-rose-300">
            Could not load the
            lineup: {roster.error}
          </div>
        )}

      {!roster.loading &&
        !roster.error &&
        visiblePlayers.length >
          0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {visiblePlayers.map(
              (player) => {
                const playerId =
                  getPlayerFaceitId(
                    player
                  );

                return (
                  <PlayerCard
                    key={
                      playerId ||
                      player.id ||
                      player.nickname
                    }
                    player={
                      player
                    }
                    team={team}
                    slug={slug}
                    rating={
                      ratingsLoading
                        ? null
                        : ratingsByPlayerId[
                            playerId
                          ]
                    }
                  />
                );
              }
            )}
          </div>
        )}

      {!roster.loading &&
        !roster.error &&
        visiblePlayers.length ===
          0 && (
          <div className="rounded-2xl border border-white/[0.06] bg-[#101720] p-8 text-center text-slate-500">
            No lineup has been
            calculated for this
            team yet.
          </div>
        )}
    </section>
  );
}