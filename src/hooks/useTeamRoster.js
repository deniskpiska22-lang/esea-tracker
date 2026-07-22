import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const DAY_MS = 24 * 60 * 60 * 1000;

function isoDaysAgo(days) {
  return new Date(
    Date.now() - days * DAY_MS
  ).toISOString();
}

function normalizePlayer(link) {
  const joinedPlayer =
    Array.isArray(link.players)
      ? link.players[0]
      : link.players;

  if (!joinedPlayer) {
    return null;
  }

  return {
    ...joinedPlayer,
    playerId: link.player_id,
    isActive:
      Boolean(link.is_active),
    joinedAt:
      link.joined_at || null,
    leftAt:
      link.left_at || null,
  };
}

function buildRoster(
  links,
  appearances
) {
  const metrics = new Map();
  const matches = new Map();

  for (
    const appearance
    of appearances
  ) {
    if (
      !appearance?.player_id ||
      !appearance?.match_id
    ) {
      continue;
    }

    const playedAt =
      appearance.played_at || "";

    const playedAtMs =
      Date.parse(playedAt);

    if (
      !matches.has(
        appearance.match_id
      )
    ) {
      matches.set(
        appearance.match_id,
        playedAt
      );
    }

    const current =
      metrics.get(
        appearance.player_id
      ) || {
        matches30: new Set(),
        matches90: new Set(),
        matches180: new Set(),
        matchIds: new Set(),
        lastMatchAt: null,
      };

    current.matchIds.add(
      appearance.match_id
    );

    current.matches180.add(
      appearance.match_id
    );

    if (
      Number.isFinite(
        playedAtMs
      ) &&
      playedAtMs >=
        Date.now() -
          90 * DAY_MS
    ) {
      current.matches90.add(
        appearance.match_id
      );
    }

    if (
      Number.isFinite(
        playedAtMs
      ) &&
      playedAtMs >=
        Date.now() -
          30 * DAY_MS
    ) {
      current.matches30.add(
        appearance.match_id
      );
    }

    if (
      playedAt &&
      (
        !current.lastMatchAt ||
        playedAt >
          current.lastMatchAt
      )
    ) {
      current.lastMatchAt =
        playedAt;
    }

    metrics.set(
      appearance.player_id,
      current
    );
  }

  const latestMatchId =
    [...matches.entries()]
      .sort(
        (first, second) =>
          String(second[1] || "")
            .localeCompare(
              String(
                first[1] || ""
              )
            )
      )[0]?.[0] ||
    null;

  const roster = links
    .map((link) => {
      const player =
        normalizePlayer(link);

      if (!player) {
        return null;
      }

      const stat =
        metrics.get(
          link.player_id
        );

      const matches30 =
        stat?.matches30.size || 0;

      const matches90 =
        stat?.matches90.size || 0;

      const matches180 =
        stat?.matches180.size || 0;

      const playedLastMatch =
        Boolean(
          latestMatchId &&
          stat?.matchIds.has(
            latestMatchId
          )
        );

      return {
        ...player,
        matches30,
        matches90,
        matches180,
        lastMatchAt:
          stat?.lastMatchAt ||
          null,
        playedLastMatch,

        /*
         * Последний известный матч —
         * самый сильный сигнал основного
         * состава.
         */
        lineupScore:
          (
            playedLastMatch
              ? 1000
              : 0
          ) +
          matches30 * 10 +
          matches90 * 3 +
          matches180,
      };
    })
    .filter(Boolean);

  roster.sort(
    (first, second) => {
      if (
        first.isActive !==
        second.isActive
      ) {
        return first.isActive
          ? -1
          : 1;
      }

      if (
        second.lineupScore !==
        first.lineupScore
      ) {
        return (
          second.lineupScore -
          first.lineupScore
        );
      }

      const dateDifference =
        String(
          second.lastMatchAt ||
            ""
        ).localeCompare(
          String(
            first.lastMatchAt ||
              ""
          )
        );

      if (dateDifference) {
        return dateDifference;
      }

      return (
        Number(
          second.faceit_elo || 0
        ) -
        Number(
          first.faceit_elo || 0
        )
      );
    }
  );

  const active =
    roster.filter(
      (player) =>
        player.isActive
    );

  /*
   * Основной состав обязателен:
   * всегда показываем до пяти
   * активных игроков.
   *
   * При наличии lineup evidence
   * первые пять — игроки последнего
   * матча, затем самые активные.
   */
  const starting =
    active.slice(0, 5);

  const hasLineupEvidence =
    starting.some(
      (player) =>
        player.matches180 > 0
    );

  return {
    starting:
      starting.map(
        (player) => ({
          ...player,
          lineupStatus:
            "starting",
          lineupSource:
            player.playedLastMatch
              ? "last_match"
              : hasLineupEvidence
                ? "match_history"
                : "current_roster",
        })
      ),

    bench:
      active
        .slice(5)
        .map(
          (player) => ({
            ...player,
            lineupStatus:
              "bench",
          })
        ),

    former:
      roster
        .filter(
          (player) =>
            !player.isActive
        )
        .map(
          (player) => ({
            ...player,
            lineupStatus:
              "former",
          })
        ),

    provisional:
      false,

    lineupSource:
      hasLineupEvidence
        ? "match_history"
        : "current_roster",
  };
}

export function useTeamRoster(
  teamId
) {
  const [state, setState] =
    useState({
      loading:
        Boolean(teamId),
      error: null,
      starting: [],
      bench: [],
      former: [],
      provisional: false,
      lineupSource:
        "current_roster",
    });

  useEffect(() => {
    let cancelled = false;

    async function loadRoster() {
      if (!teamId) {
        setState({
          loading: false,
          error: null,
          starting: [],
          bench: [],
          former: [],
          provisional:
            false,
          lineupSource:
            "current_roster",
        });
        return;
      }

      if (!supabase) {
        setState(
          (current) => ({
            ...current,
            loading: false,
            error:
              "Supabase is not configured.",
          })
        );
        return;
      }

      setState(
        (current) => ({
          ...current,
          loading: true,
          error: null,
        })
      );

      try {
        const {
          data: links,
          error: linksError,
        } = await supabase
          .from("team_players")
          .select(
            "player_id,is_active,joined_at,left_at,players!team_players_player_id_fkey(id,faceit_id,nickname,avatar,country,steam_id,faceit_elo,faceit_level)"
          )
          .eq(
            "team_id",
            teamId
          );

        if (linksError) {
          throw new Error(
            `Unable to load team players: ${linksError.message}`
          );
        }

        const playerIds =
          (links || [])
            .map(
              (link) =>
                link?.players?.faceit_id ||
                (
                  Array.isArray(link?.players)
                    ? link.players[0]?.faceit_id
                    : null
                )
            )
            .filter(Boolean);

        let ratingsByPlayerId =
          new Map();

        if (playerIds.length > 0) {
          const {
            data: ratingRows,
            error: ratingsError,
          } = await supabase
            .from("player_ratings")
            .select(
              "player_id,rating,recent_rating,matches_played,maps_played,kills,deaths,assists,adr,kd,last_match_at"
            )
            .in(
              "player_id",
              playerIds
            );

          if (ratingsError) {
            console.warn(
              "Player ratings unavailable:",
              ratingsError.message
            );
          } else {
            ratingsByPlayerId =
              new Map(
                (ratingRows || []).map(
                  (row) => [
                    String(row.player_id),
                    row,
                  ]
                )
              );
          }
        }

        const linksWithRatings =
          (links || []).map((link) => {
            const joinedPlayer =
              Array.isArray(link.players)
                ? link.players[0]
                : link.players;

            const faceitId =
              joinedPlayer?.faceit_id;

            const rating =
              faceitId
                ? ratingsByPlayerId.get(
                    String(faceitId)
                  )
                : null;

            return {
              ...link,
              players: joinedPlayer
                ? {
                    ...joinedPlayer,
                    rating:
                      rating?.rating ?? null,
                    recent_rating:
                      rating?.recent_rating ?? null,
                    rating_matches:
                      rating?.matches_played ?? 0,
                    rating_maps:
                      rating?.maps_played ?? 0,
                    rating_adr:
                      rating?.adr ?? null,
                    rating_kd:
                      rating?.kd ?? null,
                  }
                : joinedPlayer,
            };
          });

        const {
          data:
            appearanceRows,
          error:
            appearancesError,
        } = await supabase
          .from(
            "team_player_appearances"
          )
          .select(
            "player_id,match_id,played_at"
          )
          .eq(
            "team_id",
            teamId
          )
          .gte(
            "played_at",
            isoDaysAgo(180)
          )
          .order(
            "played_at",
            {
              ascending: false,
            }
          );

        if (
          appearancesError
        ) {
          console.warn(
            "Appearances unavailable:",
            appearancesError.message
          );
        }

        const result =
          buildRoster(
            linksWithRatings,
            appearanceRows ||
              []
          );

        if (!cancelled) {
          setState({
            loading: false,
            error: null,
            ...result,
          });
        }
      } catch (error) {
        if (!cancelled) {
          setState(
            (current) => ({
              ...current,
              loading: false,
              error:
                error?.message ||
                "Roster load failed",
            })
          );
        }
      }
    }

    loadRoster();

    return () => {
      cancelled = true;
    };
  }, [teamId]);

  return state;
}
