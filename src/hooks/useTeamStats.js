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
  opponentScore
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

            const currentTeamScore =
              toNumber(
                mapTeamIsFirst
                  ? map.team1_score
                  : map.team2_score
              );

            const currentOpponentScore =
              toNumber(
                mapTeamIsFirst
                  ? map.team2_score
                  : map.team1_score
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

  const mapScores =
    buildMapScoresFromDatabase(
      row,
      team,
      matchTeamIsFirst,
      teamScore,
      opponentScore
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
      row.finished_at ||
      row.scheduled_at ||
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

        const {
          data,
          error: queryError,
        } = await supabase
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
            ].join(",")
          )
          .in(
            "status",
            FINISHED_STATUSES
          )
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