import CountryFlag from "./CountryFlag.jsx";
import Link from "./SiteLink.jsx";
import { tx, tf } from "../i18n/translate.js";
import { useState } from "react";


import { useTeamRoster } from "../hooks/useTeamRoster";
import { useLanguage } from "../context/LanguageContext";
import { getPlayerId, PLAYER_SILHOUETTE } from "../utils/playerIdentity";
import { formatLineupStat, resolveMatchLineup } from "../utils/matchLineups.js";

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
        alt={tf("Player silhouette for {0}", player?.nickname || "")}
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

      {player.lineupInferred && <span className="absolute right-1 top-1 z-20 rounded border border-orange-400/25 bg-[#0c1219]/90 px-1.5 py-1 text-[8px] font-bold text-orange-300">{tx("Likely")}</span>}

      <div className="absolute inset-x-0 bottom-0 z-20 flex items-center justify-center gap-1 bg-gradient-to-t from-black/95 via-black/60 to-transparent px-1.5 pb-1.5 pt-6">
        <CountryFlag country={player?.country} size="sm" />
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

function UnannouncedPlayerCard() {
  return <div aria-label={tx("Player not announced")} className="relative aspect-[3/4] w-full overflow-hidden rounded-xl border border-dashed border-[#263244] bg-white/[0.02]">
    <img src={PLAYER_SILHOUETTE} alt="" className="h-full w-full object-contain object-bottom opacity-30" />
    <span className="absolute inset-x-0 bottom-2 text-center text-[10px] font-semibold text-slate-500">{tx("TBD")}</span>
  </div>;
}

function TeamLineupRow({ team, roster, selectedPlayerId, onSelect }) {
  const { tr } = useLanguage();

  const showUnconfirmedHint =
    !roster.loading &&
    roster.starting.length > 0 &&
    roster.provisional;

  return (
    <div className="rounded-2xl border border-[#263244] bg-[#0c1219] p-3">
      <div className="mb-2 flex items-center gap-2.5">
        <TeamMark team={team} />
        <div className="truncate text-sm font-black text-white">
          {team?.name || tx("TBD")}
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
          {Array.from({ length: Math.max(0, 5 - roster.starting.length) }, (_, index) => roster.pendingPlayers
            ? <PlayerCardSkeleton key={`pending-${index}`} />
            : <UnannouncedPlayerCard key={`unannounced-${index}`} />)}
        </div>
      )}

      {!roster.loading && roster.starting.length === 0 && (
        <div className="rounded-xl border border-dashed border-[#263244] px-4 py-6 text-center text-sm text-gray-500">
          {tr("Состав ещё не объявлен", "Lineup not announced yet")}
        </div>
      )}

      {showUnconfirmedHint && (
        <div className="mt-3 text-center text-[#7185a0]">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em]">{tr("Вероятный состав", "Likely lineup")}</div>
          {roster.announcedCount > 0 && <p className="mx-auto mt-1 max-w-xl text-[10px] leading-relaxed">{roster.inferredCount > 0
            ? tf("FACEIT lists {0}/5 players. Other shown players are a likely lineup based on match history and the registered roster.", roster.announcedCount)
            : tf("FACEIT lists {0}/5 players. Remaining players have not been announced.", roster.announcedCount)}</p>}
        </div>
      )}
      {!roster.loading && !roster.provisional && <div className="mt-3 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7185a0]">{tx("FACEIT lineup")}</div>}
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
        to={playerId ? `/players/${encodeURIComponent(playerId)}` : "#"}
        className="block rounded-lg border border-[#263244] px-3 py-1.5 text-center text-[11px] font-bold uppercase tracking-[0.08em] text-gray-300 transition hover:border-[#445a74] hover:text-white"
      >
        {tr("Профиль игрока", "Player profile")}
      </Link>
    </div>
  );
}

function CompareStatRow({ label, value1, value2, decimals }) {
  const format = (value) => formatLineupStat(value, decimals);

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-lg border border-[#182231] bg-[#0f1720] px-2.5 py-1.5 sm:px-3">
      <div className="text-right text-sm font-black text-white">
        {format(value1)}
      </div>

      <div className="text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7185a0]">
        {tx(label)}
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

  const currentRoster1 = useTeamRoster(team1Id);
  const currentRoster2 = useTeamRoster(team2Id);
  const roster1 = resolveMatchLineup(team1, currentRoster1);
  const roster2 = resolveMatchLineup(team2, currentRoster2);

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
