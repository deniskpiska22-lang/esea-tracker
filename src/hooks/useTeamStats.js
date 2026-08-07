import {
  useEffect,
  useMemo,
  useState,
} from "react";

import teams from "../data/teams";
import { supabase } from "../lib/supabaseClient";

const FINISHED_STATUSES = [
  "FINISHED",
  "MATCH_STATUS_FINISHED",
];

function normalizeName(value = "") {
  return String(value || "")
    .replace(/[^a-zа-яё0-9]/gi, "")
    .toLowerCase();
}

function toNumber(value, fallback = 0) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
}

function parseJsonValue(value, fallback) {
  if (
    value === null ||
    value === undefined
  ) {
    return fallback;
  }

  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function cleanMapName(value) {
  const raw = String(value || "")
    .replace(/^de_/i, "")
    .trim();

  if (!raw) {
    return null;
  }

  return raw
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map(
      (part) =>
        part.charAt(0).toUpperCase() +
        part.slice(1).toLowerCase()
    )
    .join("");
}

// Faction-relative veto_steps ({ map, action, selectedBy, round }, written
// by scripts/backfillMatchVeto.js) resolved to this team's perspective —
// faction1 = team1 by the same convention parseVetoSteps() in
// MatchMapResults.jsx already relies on for the single-match veto card.
function resolveVetoSteps(row, matchTeamIsFirst) {
  const rawSteps = parseJsonValue(row.veto_steps, []);

  if (!Array.isArray(rawSteps)) {
    return [];
  }

  return rawSteps
    .map((step) => {
      const mapName = cleanMapName(step?.map);

      if (!mapName) {
        return null;
      }

      let side = null;

      if (step.selectedBy === "faction1") {
        side = matchTeamIsFirst ? "team" : "opponent";
      } else if (step.selectedBy === "faction2") {
        side = matchTeamIsFirst ? "opponent" : "team";
      }

      return {
        map: mapName,
        action: step.action,
        side,
      };
    })
    .filter(Boolean);
}

// "Picked"/"Decider" veto steps keyed by lowercased map name, so a played
// map can be tagged with who chose it — "team"/"opponent" for a pick,
// "decider" for the leftover map. Mirrors buildPickedTeamByMap() in
// MatchMapResults.jsx.
function buildPickedBySideByMap(vetoSteps) {
  const lookup = new Map();

  vetoSteps
    .filter(
      (step) => step.action === "Picked" || step.action === "Decider"
    )
    .forEach((step) => {
      const key = step.map.toLowerCase();
      lookup.set(
        key,
        step.action === "Decider" ? "decider" : step.side
      );
    });

  return lookup;
}

function rowBelongsToTeam(row, team) {
  if (!row || !team) {
    return false;
  }

  const matchesById =
    Boolean(
      team.faceitTeamId &&
        row.team1_id ===
          team.faceitTeamId
    ) ||
    Boolean(
      team.faceitTeamId &&
        row.team2_id ===
          team.faceitTeamId
    );

  const normalizedTeamName =
    normalizeName(team.name);

  const matchesByName =
    Boolean(
      normalizedTeamName &&
        normalizeName(
          row.team1_name
        ) === normalizedTeamName
    ) ||
    Boolean(
      normalizedTeamName &&
        normalizeName(
          row.team2_name
        ) === normalizedTeamName
    );

  return (
    matchesById ||
    matchesByName
  );
}

function teamIsFirstInMatch(
  row,
  team
) {
  if (
    team?.faceitTeamId &&
    row.team1_id ===
      team.faceitTeamId
  ) {
    return true;
  }

  if (
    team?.faceitTeamId &&
    row.team2_id ===
      team.faceitTeamId
  ) {
    return false;
  }

  const normalizedTeamName =
    normalizeName(team?.name);

  if (
    normalizedTeamName &&
    normalizeName(
      row.team1_name
    ) === normalizedTeamName
  ) {
    return true;
  }

  if (
    normalizedTeamName &&
    normalizeName(
      row.team2_name
    ) === normalizedTeamName
  ) {
    return false;
  }

  return true;
}

// Some older import passes wrote matches.map_scores entries in a
// simplified { teamScore, opponentScore, won } shape instead of the
// neutral { team1_score, team2_score } shape autoSyncMatches.js writes.
// Checked against team1_score/team2_score on every row where both exist
// (100% match across a large sample) — teamScore/opponentScore always
// alias team1/team2 respectively, so it's safe to fall back to them
// rather than silently reading undefined and defaulting every score to 0.
function resolveMapScorePair(map) {
  return {
    team1Score:
      map.team1_score !== undefined ? map.team1_score : map.teamScore,
    team2Score:
      map.team2_score !== undefined
        ? map.team2_score
        : map.opponentScore,
  };
}

function teamIsFirstOnMap(
  map,
  team,
  matchTeamIsFirst
) {
  if (
    team?.faceitTeamId &&
    map.team1_id ===
      team.faceitTeamId
  ) {
    return true;
  }

  if (
    team?.faceitTeamId &&
    map.team2_id ===
      team.faceitTeamId
  ) {
    return false;
  }

  const normalizedTeamName =
    normalizeName(team?.name);

  if (
    normalizedTeamName &&
    normalizeName(
      map.team1_name
    ) === normalizedTeamName
  ) {
    return true;
  }

  if (
    normalizedTeamName &&
    normalizeName(
      map.team2_name
    ) === normalizedTeamName
  ) {
    return false;
  }

  return matchTeamIsFirst;
}

function buildMapScoresFromDatabase(
  row,
  team,
  matchTeamIsFirst,
  teamScore,
  opponentScore,
  pickedBySideByMap
) {
  const rawMapScores =
    parseJsonValue(
      row.map_scores,
      []
    );

  const mapScores =
    Array.isArray(rawMapScores)
      ? rawMapScores
          .map((map) => {
            const mapName =
              cleanMapName(
                map.map
              );

            if (!mapName) {
              return null;
            }

            const mapTeamIsFirst =
              teamIsFirstOnMap(
                map,
                team,
                matchTeamIsFirst
              );

            const { team1Score, team2Score } =
              resolveMapScorePair(map);

            const currentTeamScore =
              toNumber(
                mapTeamIsFirst
                  ? team1Score
                  : team2Score
              );

            const currentOpponentScore =
              toNumber(
                mapTeamIsFirst
                  ? team2Score
                  : team1Score
              );

            return {
              map: mapName,

              teamScore:
                currentTeamScore,

              opponentScore:
                currentOpponentScore,

              won:
                currentTeamScore >
                currentOpponentScore,

              pickedBy:
                pickedBySideByMap?.get(
                  mapName.toLowerCase()
                ) || null,
            };
          })
          .filter(Boolean)
      : [];

  /*
   * Основной вариант:
   * используем полноценные map_scores.
   */
  if (mapScores.length > 0) {
    return mapScores;
  }

  /*
   * Резерв:
   * если map_scores пустой,
   * но поле maps содержит одну карту,
   * считаем её BO1-картой.
   */
  const rawMaps =
    parseJsonValue(
      row.maps,
      []
    );

  const mapNames =
    Array.isArray(rawMaps)
      ? rawMaps
          .map(cleanMapName)
          .filter(Boolean)
      : [];

  if (mapNames.length === 1) {
    return [
      {
        map:
          mapNames[0],

        teamScore,

        opponentScore,

        won:
          teamScore >
          opponentScore,

        pickedBy:
          pickedBySideByMap?.get(
            mapNames[0].toLowerCase()
          ) || null,
      },
    ];
  }

  return [];
}

function normalizeDatabaseMatch(
  row,
  team
) {
  const matchTeamIsFirst =
    teamIsFirstInMatch(
      row,
      team
    );

  const teamScore =
    toNumber(
      matchTeamIsFirst
        ? row.team1_score
        : row.team2_score
    );

  const opponentScore =
    toNumber(
      matchTeamIsFirst
        ? row.team2_score
        : row.team1_score
    );

  const teamName =
    matchTeamIsFirst
      ? row.team1_name
      : row.team2_name;

  const opponentName =
    matchTeamIsFirst
      ? row.team2_name
      : row.team1_name;

  const vetoSteps = resolveVetoSteps(
    row,
    matchTeamIsFirst
  );

  const pickedBySideByMap =
    buildPickedBySideByMap(vetoSteps);

  const mapScores =
    buildMapScoresFromDatabase(
      row,
      team,
      matchTeamIsFirst,
      teamScore,
      opponentScore,
      pickedBySideByMap
    );

  return {
    id:
      row.id,

    matchId:
      row.id,

    teamSlug:
      team?.slug ||
      null,

    teamName:
      team?.name ||
      teamName ||
      "Unknown",

    opponentName:
      opponentName ||
      "Unknown",

    date:
      String(
        row.finished_at ||
        row.scheduled_at ||
        ""
      ).slice(0, 10) ||
      null,

    season:
      row.competition_name ||
      "ESEA League",

    teamScore,

    opponentScore,

    boScore:
      `${teamScore} : ${opponentScore}`,

    won:
      teamScore >
      opponentScore,

    result:
      teamScore >
      opponentScore
        ? "WIN"
        : "LOSS",

    maps:
      mapScores.map(
        (map) => map.map
      ),

    mapScores,

    faceitUrl:
      row.faceit_url ||
      `https://www.faceit.com/en/cs2/room/${row.id}`,

    demoSynced:
      Boolean(row.demo_synced),

    vetoSteps,

    vetoSynced:
      Boolean(row.veto_synced),

    source:
      "supabase",
  };
}

function normalizeFallbackMatch(
  match
) {
  const rawMapScores =
    Array.isArray(
      match.mapScores
    )
      ? match.mapScores
      : [];

  let normalizedMapScores =
    rawMapScores
      .map((map) => {
        const mapName =
          cleanMapName(
            map.map
          );

        if (!mapName) {
          return null;
        }

        const teamScore =
          toNumber(
            map.teamScore
          );

        const opponentScore =
          toNumber(
            map.opponentScore
          );

        return {
          ...map,

          map:
            mapName,

          teamScore,

          opponentScore,

          won:
            typeof map.won ===
            "boolean"
              ? map.won
              : teamScore >
                opponentScore,
        };
      })
      .filter(Boolean);

  /*
   * Резерв для старых матчей,
   * где есть maps, но нет mapScores.
   */
  if (
    normalizedMapScores.length ===
      0 &&
    Array.isArray(match.maps) &&
    match.maps.length === 1
  ) {
    const mapName =
      cleanMapName(
        match.maps[0]
      );

    const scoreParts =
      String(
        match.boScore ||
        ""
      )
        .split(":")
        .map((item) =>
          item.trim()
        );

    const teamScore =
      toNumber(
        match.teamScore ??
        scoreParts[0]
      );

    const opponentScore =
      toNumber(
        match.opponentScore ??
        scoreParts[1]
      );

    if (mapName) {
      normalizedMapScores = [
        {
          map:
            mapName,

          teamScore,

          opponentScore,

          won:
            typeof match.won ===
            "boolean"
              ? match.won
              : teamScore >
                opponentScore,
        },
      ];
    }
  }

  return {
    ...match,

    matchId:
      match.matchId ||
      match.id,

    mapScores:
      normalizedMapScores,

    maps:
      normalizedMapScores.map(
        (map) => map.map
      ),

    source:
      match.source ||
      "fallback",
  };
}

function hasMapScores(match) {
  return (
    Array.isArray(
      match?.mapScores
    ) &&
    match.mapScores.length > 0
  );
}

function mergeMatches(
  fallbackMatches,
  databaseMatches
) {
  const matchesById =
    new Map();

  /*
   * Сначала кладём старые данные.
   */
  fallbackMatches.forEach(
    (match) => {
      const normalized =
        normalizeFallbackMatch(
          match
        );

      if (
        normalized.matchId
      ) {
        matchesById.set(
          normalized.matchId,
          normalized
        );
      }
    }
  );

  /*
   * Затем накладываем данные Supabase.
   *
   * Главное исправление:
   * Supabase не имеет права затереть
   * существующие карты пустым массивом.
   */
  databaseMatches.forEach(
    (databaseMatch) => {
      if (
        !databaseMatch.matchId
      ) {
        return;
      }

      const fallbackMatch =
        matchesById.get(
          databaseMatch.matchId
        );

      const databaseHasMaps =
        hasMapScores(
          databaseMatch
        );

      const fallbackHasMaps =
        hasMapScores(
          fallbackMatch
        );

      const selectedMapScores =
        databaseHasMaps
          ? databaseMatch.mapScores
          : fallbackHasMaps
            ? fallbackMatch.mapScores
            : [];

      const mergedMatch = {
        ...(fallbackMatch || {}),
        ...databaseMatch,

        /*
         * Не затираем карты пустым массивом.
         */
        mapScores:
          selectedMapScores,

        maps:
          selectedMapScores.map(
            (map) =>
              map.map
          ),
      };

      matchesById.set(
        databaseMatch.matchId,
        mergedMatch
      );
    }
  );

  return [
    ...matchesById.values(),
  ].sort(
    (first, second) => {
      const firstTime =
        new Date(
          first.date || 0
        ).getTime();

      const secondTime =
        new Date(
          second.date || 0
        ).getTime();

      return (
        secondTime -
        firstTime
      );
    }
  );
}

function buildMapStats(matches) {
  const mapsByName = {};

  matches.forEach((match) => {
    const mapScores =
      Array.isArray(
        match.mapScores
      )
        ? match.mapScores
        : [];

    mapScores.forEach((map) => {
      const mapName =
        cleanMapName(
          map.map
        );

      if (!mapName) {
        return;
      }

      if (!mapsByName[mapName]) {
        mapsByName[mapName] = {
          name:
            mapName,

          played:
            0,

          wins:
            0,

          losses:
            0,
        };
      }

      mapsByName[
        mapName
      ].played += 1;

      if (map.won) {
        mapsByName[
          mapName
        ].wins += 1;
      } else {
        mapsByName[
          mapName
        ].losses += 1;
      }
    });
  });

  return Object.values(
    mapsByName
  )
    .map((map) => ({
      ...map,

      winrate:
        map.played > 0
          ? Math.round(
              (
                map.wins /
                map.played
              ) * 100
            )
          : 0,
    }))
    .sort(
      (first, second) =>
        second.winrate -
          first.winrate ||
        second.played -
          first.played ||
        first.name.localeCompare(
          second.name
        )
    );
}

// Per-map pick/ban aggregation across a team's whole veto history —
// mirrors buildMapStats() above, but reading vetoSteps instead of
// mapScores. pickRate/banRate are relative to matchesWithVeto (how many
// finished matches actually have veto data backfilled yet), not to the
// team's total match count, since coverage starts partial.
export function buildVetoStats(matches) {
  const mapsByName = {};
  let matchesWithVeto = 0;

  matches.forEach((match) => {
    const vetoSteps = Array.isArray(match.vetoSteps)
      ? match.vetoSteps
      : [];

    if (vetoSteps.length === 0) {
      return;
    }

    matchesWithVeto += 1;

    const mapScoreByName = new Map(
      (Array.isArray(match.mapScores) ? match.mapScores : []).map(
        (map) => [String(map.map || "").toLowerCase(), map]
      )
    );

    vetoSteps.forEach((step) => {
      const mapName = step.map;
      if (!mapName) return;

      if (!mapsByName[mapName]) {
        mapsByName[mapName] = {
          name: mapName,
          picked: 0,
          banned: 0,
          decider: 0,
          pickedByOpponent: 0,
          bannedByOpponent: 0,
          winsWhenPicked: 0,
          lossesWhenPicked: 0,
        };
      }

      const entry = mapsByName[mapName];

      if (step.action === "Picked" && step.side === "team") {
        entry.picked += 1;

        const played = mapScoreByName.get(mapName.toLowerCase());
        if (played) {
          if (played.won) entry.winsWhenPicked += 1;
          else entry.lossesWhenPicked += 1;
        }
      } else if (
        step.action === "Picked" &&
        step.side === "opponent"
      ) {
        entry.pickedByOpponent += 1;
      } else if (step.action === "Banned" && step.side === "team") {
        entry.banned += 1;
      } else if (
        step.action === "Banned" &&
        step.side === "opponent"
      ) {
        entry.bannedByOpponent += 1;
      } else if (step.action === "Decider") {
        entry.decider += 1;
      }
    });
  });

  return Object.values(mapsByName)
    .map((map) => {
      const decidedGames =
        map.winsWhenPicked + map.lossesWhenPicked;

      return {
        ...map,
        pickRate:
          matchesWithVeto > 0
            ? Math.round((map.picked / matchesWithVeto) * 100)
            : 0,
        banRate:
          matchesWithVeto > 0
            ? Math.round((map.banned / matchesWithVeto) * 100)
            : 0,
        winrateWhenPicked:
          decidedGames > 0
            ? Math.round(
                (map.winsWhenPicked / decidedGames) * 100
              )
            : 0,
      };
    })
    .sort(
      (first, second) =>
        second.picked + second.banned - (first.picked + first.banned) ||
        first.name.localeCompare(second.name)
    );
}

// Which map an opponent bans 1st, 2nd, 3rd... across a team's veto
// history — not the global veto round number, but the opponent's own
// ban sequence position (their bans only, alternating turns skipped).
// match.vetoSteps is already round-ordered (backfillMatchVeto.js stores
// it sorted, resolveVetoSteps() preserves that order), so array position
// among the opponent's own "Banned" steps is exactly this.
// Which map gets banned 1st, 2nd, 3rd... by a given side ("team" or
// "opponent") across a set of matches — shared by
// buildOpponentBanOrderStats (their bans against this team) and
// buildTeamBanOrderStats (this team's own ban order).
function buildBanOrderStats(matches, side) {
  const countsByMapAndOrder = {};
  const totalsByOrder = {};
  let maxOrder = 0;

  matches.forEach((match) => {
    const vetoSteps = Array.isArray(match.vetoSteps)
      ? match.vetoSteps
      : [];

    const sideBans = vetoSteps.filter(
      (step) => step.action === "Banned" && step.side === side
    );

    sideBans.forEach((step, index) => {
      const order = index + 1;
      maxOrder = Math.max(maxOrder, order);

      if (!countsByMapAndOrder[step.map]) {
        countsByMapAndOrder[step.map] = {};
      }

      countsByMapAndOrder[step.map][order] =
        (countsByMapAndOrder[step.map][order] || 0) + 1;

      totalsByOrder[order] = (totalsByOrder[order] || 0) + 1;
    });
  });

  const orders = Array.from(
    { length: maxOrder },
    (_, index) => index + 1
  );

  const rows = Object.keys(countsByMapAndOrder)
    .map((name) => {
      const byOrder = orders.map((order) => {
        const count = countsByMapAndOrder[name]?.[order] || 0;
        const total = totalsByOrder[order] || 0;

        return {
          order,
          count,
          percent:
            total > 0 ? Math.round((count / total) * 100) : 0,
        };
      });

      return {
        name,
        byOrder,
        totalBans: byOrder.reduce(
          (sum, cell) => sum + cell.count,
          0
        ),
      };
    })
    .sort((first, second) => second.totalBans - first.totalBans);

  return { orders, totalsByOrder, rows };
}

export function buildOpponentBanOrderStats(matches) {
  return buildBanOrderStats(matches, "opponent");
}

export function buildTeamBanOrderStats(matches) {
  return buildBanOrderStats(matches, "team");
}

export function useTeamStats(
  slug,
  fallbackMatches = []
) {
  const team =
    useMemo(
      () =>
        teams.find(
          (item) =>
            item.slug === slug
        ) || null,
      [slug]
    );

  const [
    databaseMatches,
    setDatabaseMatches,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadTeamStats() {
      if (!slug || !team) {
        setDatabaseMatches(
          []
        );

        setLoading(false);

        return;
      }

      setLoading(true);
      setError("");

      try {
        if (!supabase) {
          throw new Error(
            "Supabase client is not configured"
          );
        }

        let matchesQuery = supabase
          .from("matches")
          .select(
            [
              "id",
              "competition_name",
              "status",
              "scheduled_at",
              "finished_at",

              "team1_id",
              "team1_name",
              "team1_score",

              "team2_id",
              "team2_name",
              "team2_score",

              "faceit_url",
              "maps",
              "map_scores",
              "stats_synced",
              "demo_synced",
              "veto_steps",
              "veto_synced",
            ].join(",")
          )
          .in(
            "status",
            FINISHED_STATUSES
          );

        /*
         * Матчи фильтруются по faceitTeamId
         * прямо на стороне Supabase, а не
         * вырезаются из общего среза "3000
         * самых свежих матчей по всему сайту".
         *
         * Без этого фильтра у активных/старых
         * команд часть их же матчей просто не
         * попадала в этот общий срез по мере
         * роста сайта — и статистика (включая
         * вето) выглядела неполной, хотя данные
         * в базе были.
         */
        if (team?.faceitTeamId) {
          matchesQuery = matchesQuery.or(
            `team1_id.eq.${team.faceitTeamId},team2_id.eq.${team.faceitTeamId}`
          );
        }

        const {
          data,
          error: queryError,
        } = await matchesQuery
          .order(
            "finished_at",
            {
              ascending: false,
              nullsFirst: false,
            }
          )
          .limit(3000);

        if (queryError) {
          throw queryError;
        }

        const teamRows =
          (data || []).filter(
            (row) =>
              rowBelongsToTeam(
                row,
                team
              )
          );

        const normalizedMatches =
          teamRows.map(
            (row) =>
              normalizeDatabaseMatch(
                row,
                team
              )
          );

        if (!cancelled) {
          setDatabaseMatches(
            normalizedMatches
          );
        }
      } catch (loadError) {
        console.warn(
          "Team stats fallback is used:",
          loadError.message
        );

        if (!cancelled) {
          setDatabaseMatches(
            []
          );

          setError(
            "Failed to load automatic team statistics"
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadTeamStats();

    return () => {
      cancelled = true;
    };
  }, [
    slug,
    team,
  ]);

  const matches =
    useMemo(
      () =>
        mergeMatches(
          fallbackMatches,
          databaseMatches
        ),
      [
        fallbackMatches,
        databaseMatches,
      ]
    );

  const maps =
    useMemo(
      () =>
        buildMapStats(
          matches
        ),
      [matches]
    );

  return {
    matches,
    maps,
    loading,
    error,
  };
}