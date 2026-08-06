import { useState } from "react";
import { Link } from "react-router-dom";

import { useTeamRoster } from "../hooks/useTeamRoster";
import { useLanguage } from "../context/LanguageContext";
import { getPlayerId, PLAYER_SILHOUETTE } from "../utils/playerIdentity";

function getTeamId(team) {
  return (
    team?.faceitTeamId ||
    team?.faceit_team_id ||
    team?.teamId ||
    team?.id ||
    null
  );
}

function getTeamLogo(team) {
  return team?.logo || team?.logoUrl || team?.logo_url || null;
}

function pickActivePlayer(list, selectedId) {
  if (!list.length) return null;

  if (selectedId) {
    const found = list.find(
      (player) => getPlayerId(player) === selectedId
    );
    if (found) return found;
  }

  return [...list].sort(
    (a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0)
  )[0];
}

function getFlagUrl(country) {
  if (!country || country.length !== 2) {
    return null;
  }
  return `https://flagcdn.com/24x18/${country.toLowerCase()}.png`;
}

function PlayerFlag({ country, size = "sm" }) {
  const [failed, setFailed] = useState(false);
  const flagUrl = getFlagUrl(country);
  const dims = size === "sm" ? "h-[14px] w-5" : "h-[18px] w-6";

  if (!flagUrl || failed) {
    return (
      <div
        className={`${dims} shrink-0 rounded-sm border border-white/10 bg-white/[0.04]`}
        title={country || "Unknown country"}
      />
    );
  }

  return (
    <img
      src={flagUrl}
      alt={country}
      title={country}
      className={`${dims} shrink-0 rounded-sm object-cover`}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

function PlayerPortraitLayers({ player, team }) {
  const teamLogo = getTeamLogo(team);

  return (
    <>
      {teamLogo && (
        <img
          src={teamLogo}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full scale-[1.08] object-contain opacity-[0.16] grayscale blur-[1px]"
        />
      )}

      <img
        src={PLAYER_SILHOUETTE}
        alt={`Player silhouette for ${player?.nickname || ""}`}
        className="absolute inset-0 z-10 h-full w-full scale-[1.03] object-contain object-bottom"
      />

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#121b27]/40" />
    </>
  );
}

function PlayerTileBody({ player, team }) {
  return (
    <>
      <PlayerPortraitLayers player={player} team={team} />

      <div className="absolute inset-x-0 bottom-0 z-20 flex items-center justify-center gap-1 bg-gradient-to-t from-black/95 via-black/60 to-transparent px-1.5 pb-1.5 pt-6">
        <PlayerFlag country={player?.country} />
        <div
          title={player?.nickname}
          className="min-w-0 truncate text-[11px] font-bold text-white"
        >
          {player?.nickname || "—"}
        </div>
      </div>
    </>
  );
}

function TeamMark({ team }) {
  const [failed, setFailed] = useState(false);
  const src = getTeamLogo(team);

  if (!src || failed) {
    return (
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/5 bg-white/[0.04] text-xs font-bold text-gray-500">
        {String(team?.name || "?")
          .trim()
          .slice(0, 1)
          .toUpperCase()}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt=""
      className="h-7 w-7 shrink-0 object-contain"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

function PlayerCard({ player, team, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={[
        "relative aspect-[3/4] w-full overflow-hidden rounded-xl border transition",
        selected
          ? "border-orange-400 shadow-lg shadow-orange-500/10"
          : "border-[#263244] hover:border-[#445a74]",
      ].join(" ")}
    >
      <PlayerTileBody player={player} team={team} />
    </button>
  );
}

function PlayerCardSkeleton() {
  return (
    <div className="aspect-[3/4] w-full animate-pulse rounded-xl border border-[#263244] bg-white/5" />
  );
}

function TeamLineupRow({ team, roster, selectedPlayerId, onSelect }) {
  const { tr } = useLanguage();

  const showUnconfirmedHint =
    !roster.loading &&
    roster.starting.length > 0 &&
    roster.lineupSource !== "match_history";

  return (
    <div className="rounded-2xl border border-[#263244] bg-[#0c1219] p-3">
      <div className="mb-2 flex items-center gap-2.5">
        <TeamMark team={team} />
        <div className="truncate text-sm font-black text-white">
          {team?.name || "TBD"}
        </div>
      </div>

      {roster.loading && (
        <div className="grid grid-cols-5 gap-2 sm:gap-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <PlayerCardSkeleton key={index} />
          ))}
        </div>
      )}

      {!roster.loading && roster.starting.length > 0 && (
        <div className="grid grid-cols-5 gap-2 sm:gap-3">
          {roster.starting.map((player) => (
            <PlayerCard
              key={getPlayerId(player) || player.nickname}
              player={player}
              team={team}
              selected={getPlayerId(player) === selectedPlayerId}
              onClick={() => onSelect(getPlayerId(player))}
            />
          ))}
        </div>
      )}

      {!roster.loading && roster.starting.length === 0 && (
        <div className="rounded-xl border border-dashed border-[#263244] px-4 py-6 text-center text-sm text-gray-500">
          {tr("Состав ещё не объявлен", "Lineup not announced yet")}
        </div>
      )}

      {showUnconfirmedHint && (
        <div className="mt-3 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7185a0]">
          {tr("Вероятный состав", "Likely lineup")}
        </div>
      )}
    </div>
  );
}

function CompareSidePlayer({ player, team }) {
  const { tr } = useLanguage();
  const playerId = getPlayerId(player);

  return (
    <div className="mx-auto flex w-full max-w-[150px] flex-col gap-1.5">
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl border border-[#263244]">
        <PlayerTileBody player={player} team={team} />
      </div>

      <Link
        to={playerId ? `/player/${encodeURIComponent(playerId)}` : "#"}
        className="block rounded-lg border border-[#263244] px-3 py-1.5 text-center text-[11px] font-bold uppercase tracking-[0.08em] text-gray-300 transition hover:border-[#445a74] hover:text-white"
      >
        {tr("Профиль игрока", "Player profile")}
      </Link>
    </div>
  );
}

function CompareStatRow({ label, value1, value2, decimals }) {
  const format = (value) => {
    const number = Number(value);
    return Number.isFinite(number) ? number.toFixed(decimals) : "—";
  };

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-lg border border-[#182231] bg-[#0f1720] px-2.5 py-1.5 sm:px-3">
      <div className="text-right text-sm font-black text-white">
        {format(value1)}
      </div>

      <div className="text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7185a0]">
        {label}
      </div>

      <div className="text-left text-sm font-black text-white">
        {format(value2)}
      </div>
    </div>
  );
}

function ComparePanel({ player1, player2, team1, team2 }) {
  const { tr } = useLanguage();

  if (!player1 || !player2) {
    return (
      <div className="rounded-2xl border border-dashed border-[#263244] px-6 py-8 text-center text-sm text-gray-500">
        {tr("Составы ещё не готовы для сравнения", "Lineups not ready to compare yet")}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[#263244] bg-[#0c1219] p-3 sm:p-4">
      <div className="grid grid-cols-[1fr_minmax(0,320px)_1fr] items-stretch gap-3 sm:gap-5">
        <CompareSidePlayer player={player1} team={team1} />

        <div className="flex h-full flex-col justify-center gap-2">
          <CompareStatRow
            label={tr("Рейтинг", "Rating")}
            value1={player1.rating}
            value2={player2.rating}
            decimals={2}
          />
          <CompareStatRow
            label="K/D"
            value1={player1.rating_kd}
            value2={player2.rating_kd}
            decimals={2}
          />
          <CompareStatRow
            label="ADR"
            value1={player1.rating_adr}
            value2={player2.rating_adr}
            decimals={1}
          />
          <CompareStatRow
            label={tr("Матчи", "Matches")}
            value1={player1.rating_matches}
            value2={player2.rating_matches}
            decimals={0}
          />
        </div>

        <CompareSidePlayer player={player2} team={team2} />
      </div>
    </div>
  );
}

export default function MatchLineups({ team1, team2 }) {
  const { tr } = useLanguage();

  const team1Id = getTeamId(team1);
  const team2Id = getTeamId(team2);

  const roster1 = useTeamRoster(team1Id);
  const roster2 = useTeamRoster(team2Id);

  const [selectedId1, setSelectedId1] = useState(null);
  const [selectedId2, setSelectedId2] = useState(null);

  const activePlayer1 = pickActivePlayer(roster1.starting, selectedId1);
  const activePlayer2 = pickActivePlayer(roster2.starting, selectedId2);

  return (
    <div>
      <div className="mb-3 text-sm font-black uppercase tracking-[0.18em] text-orange-300">
        {tr("Составы", "Lineups")}
      </div>

      <div className="space-y-3">
        <TeamLineupRow
          team={team1}
          roster={roster1}
          selectedPlayerId={getPlayerId(activePlayer1 || {})}
          onSelect={setSelectedId1}
        />

        <ComparePanel
          player1={activePlayer1}
          player2={activePlayer2}
          team1={team1}
          team2={team2}
        />

        <TeamLineupRow
          team={team2}
          roster={roster2}
          selectedPlayerId={getPlayerId(activePlayer2 || {})}
          onSelect={setSelectedId2}
        />
      </div>
    </div>
  );
}
