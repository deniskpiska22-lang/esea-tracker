function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeKey(value = "") {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function teamKey(team = {}) {
  return team.teamId
    ? `id:${team.teamId}`
    : `name:${normalizeKey(team.teamName)}`;
}

function playerKey(player = {}) {
  return player.playerId
    ? `id:${player.playerId}`
    : `name:${normalizeKey(player.nickname)}`;
}

/**
 * Builds one whole-series player-stat payload from FACEIT's per-map rows.
 * Counting stats are summed; rate stats are weighted by rounds (HS% by
 * kills). The team score is the number of maps won, not the round score of
 * whichever map happened to be returned first.
 */
export function aggregateMatchPlayerStats(maps, matchId) {
  const usableMaps = (Array.isArray(maps) ? maps : []).filter(
    (map) =>
      Array.isArray(map?.teams) &&
      map.teams.length >= 2 &&
      map.teams.some(
        (team) => Array.isArray(team?.players) && team.players.length > 0
      )
  );

  if (usableMaps.length === 0) {
    return null;
  }

  const teams = new Map();

  for (const map of usableMaps) {
    const mapTeams = map.teams.slice(0, 2);
    const roundWeight = Math.max(
      1,
      mapTeams.reduce((sum, team) => sum + number(team?.score), 0)
    );
    const highestScore = Math.max(...mapTeams.map((team) => number(team?.score)));

    for (const team of mapTeams) {
      const key = teamKey(team);

      if (!teams.has(key)) {
        teams.set(key, {
          teamId: team.teamId || null,
          teamName: team.teamName || "Unknown",
          score: 0,
          players: new Map(),
        });
      }

      const targetTeam = teams.get(key);

      if (number(team.score) === highestScore) {
        targetTeam.score += 1;
      }

      for (const player of Array.isArray(team.players) ? team.players : []) {
        const keyForPlayer = playerKey(player);

        if (!targetTeam.players.has(keyForPlayer)) {
          targetTeam.players.set(keyForPlayer, {
            playerId: player.playerId || null,
            nickname: player.nickname || "Unknown",
            kills: 0,
            deaths: 0,
            assists: 0,
            mvps: 0,
            adrWeighted: 0,
            adrRounds: 0,
            headshotKills: 0,
            kastWeighted: 0,
            kastRounds: 0,
          });
        }

        const targetPlayer = targetTeam.players.get(keyForPlayer);
        const kills = number(player.kills);
        const deaths = number(player.deaths);
        const adr = Number(player.adr);
        const hsRate = Number(player.hsRate);
        const kast = Number(player.kast);

        targetPlayer.kills += kills;
        targetPlayer.deaths += deaths;
        targetPlayer.assists += number(player.assists);
        targetPlayer.mvps += number(player.mvps);

        if (Number.isFinite(adr)) {
          targetPlayer.adrWeighted += adr * roundWeight;
          targetPlayer.adrRounds += roundWeight;
        }

        if (Number.isFinite(hsRate)) {
          targetPlayer.headshotKills += kills * (hsRate / 100);
        }

        if (player.kast !== null && player.kast !== undefined && Number.isFinite(kast)) {
          targetPlayer.kastWeighted += kast * roundWeight;
          targetPlayer.kastRounds += roundWeight;
        }
      }
    }
  }

  return {
    matchId,
    map: null,
    teams: [...teams.values()].map((team) => ({
      teamId: team.teamId,
      teamName: team.teamName,
      score: team.score,
      players: [...team.players.values()].map((player) => ({
        playerId: player.playerId,
        nickname: player.nickname,
        kills: player.kills,
        deaths: player.deaths,
        assists: player.assists,
        adr:
          player.adrRounds > 0
            ? player.adrWeighted / player.adrRounds
            : 0,
        kd:
          player.deaths > 0
            ? player.kills / player.deaths
            : player.kills,
        hsRate:
          player.kills > 0
            ? (player.headshotKills / player.kills) * 100
            : 0,
        kast:
          player.kastRounds > 0
            ? player.kastWeighted / player.kastRounds
            : null,
        mvps: player.mvps,
      })),
    })),
  };
}
