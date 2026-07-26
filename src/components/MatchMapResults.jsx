import { useEffect, useState } from "react";

import { formatMapName } from "../utils/formatMapName";

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getMapBackgroundUrl(mapName) {
  const slug = String(mapName || "")
    .trim()
    .toLowerCase()
    .replace(/^de_/i, "")
    .replace(/\s+/g, "");

  return slug ? `/maps/${slug}.png` : null;
}

function TeamBadge({ team, align }) {
  return (
    <div
      className={`flex min-w-0 items-center gap-1.5 sm:gap-2 ${
        align === "right" ? "flex-row-reverse" : ""
      }`}
    >
      {team.logo && (
        <img
          src={team.logo}
          alt=""
          className="h-5 w-5 shrink-0 rounded-sm object-contain sm:h-6 sm:w-6"
        />
      )}
      <span className="truncate text-xs font-bold text-slate-200 sm:text-sm">
        {team.name}
      </span>
    </div>
  );
}

function MapResultRow({ map, index, team1, team2, demoUrl, pickedBy }) {
  const formattedName = formatMapName(map.map);
  const leftScore = toNumber(map.teamScore);
  const rightScore = toNumber(map.opponentScore);
  const backgroundUrl = getMapBackgroundUrl(map.map);

  const pickLabel =
    pickedBy === "team1"
      ? `${team1.name} pick`
      : pickedBy === "team2"
        ? `${team2.name} pick`
        : pickedBy === "decider"
          ? "Decider"
          : null;

  return (
    <div className="relative overflow-hidden rounded-xl border border-[#222e3f] bg-[#0b1119]">
      {backgroundUrl && (
        <div
          className="absolute inset-0 scale-110 bg-cover bg-center blur-[2px]"
          style={{ backgroundImage: `url(${backgroundUrl})` }}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/60 to-black/80" />

      <div className="relative grid grid-cols-[minmax(0,1fr)_88px_minmax(0,1fr)] items-center gap-2 px-3 py-2.5 sm:grid-cols-[minmax(0,1fr)_120px_minmax(0,1fr)] sm:gap-3 sm:px-5 sm:py-3.5">
        <div className="flex items-center justify-end gap-2 sm:gap-3">
          <TeamBadge team={team1} align="right" />
          <div
            className={`text-lg font-black sm:text-2xl ${
              leftScore > rightScore ? "text-emerald-400" : "text-white"
            }`}
          >
            {leftScore}
          </div>
        </div>

        <div className="text-center">
          <div className="text-[9px] font-black uppercase tracking-[0.16em] text-orange-400 sm:text-xs">
            Map {index + 1}
          </div>
          <div className="truncate text-sm font-black text-white sm:text-base">
            {formattedName}
          </div>
          {pickLabel && (
            <div className="mt-0.5 truncate text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              {pickLabel}
            </div>
          )}
          {demoUrl && (
            <a
              href={demoUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-1 hidden rounded-lg border border-orange-500/40 px-2 py-0.5 text-[10px] font-bold text-orange-400 transition hover:bg-orange-500/10 sm:inline-block"
            >
              Demo
            </a>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div
            className={`text-lg font-black sm:text-2xl ${
              rightScore > leftScore ? "text-emerald-400" : "text-white"
            }`}
          >
            {rightScore}
          </div>
          <TeamBadge team={team2} align="left" />
        </div>
      </div>
    </div>
  );
}

function FinishedMapsPanel({
  maps,
  team1,
  team2,
  demoUrls,
  demoUnavailable,
  pickedTeamByMap,
}) {
  const demos = Array.isArray(demoUrls) ? demoUrls : [];

  if (!Array.isArray(maps) || maps.length === 0) {
    return (
      <section className="overflow-hidden rounded-[24px] border border-[#263244] bg-[#101722]">
        <div className="border-b border-[#263244] px-5 py-4 sm:px-6">
          <h2 className="text-xl font-black">Maps</h2>
          <p className="mt-1 text-xs text-slate-500">
            Match result synchronization
          </p>
        </div>

        <div className="p-6">
          <div className="rounded-2xl border border-dashed border-[#2a3546] bg-[#0b1119] p-6 text-center">
            <div className="font-bold text-slate-300">
              Map scores are being processed
            </div>
            <div className="mt-2 text-sm text-slate-500">
              The final series score is available. Detailed map results will appear automatically.
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-[24px] border border-[#263244] bg-[#101722]">
      <div className="border-b border-[#263244] px-5 py-3 sm:px-6">
        <h2 className="text-xl font-black">Map results</h2>
        <p className="mt-1 text-xs text-slate-500">Full series breakdown</p>
        {demos.length === 0 && !demoUnavailable && (
          <p className="mt-1 text-xs text-slate-500">
            Demo is processing, it will appear here automatically
          </p>
        )}
      </div>

      <div className="space-y-2 p-3 sm:p-4">
        {maps.map((map, index) => (
          <MapResultRow
            key={`${map.map}-${index}`}
            map={map}
            index={index}
            team1={team1}
            team2={team2}
            demoUrl={demos[index]}
            pickedBy={pickedTeamByMap?.get(
              formatMapName(map.map).toLowerCase()
            )}
          />
        ))}
      </div>
    </section>
  );
}

function parseVetoSteps(payload, team1, team2) {
  const tickets = payload?.payload?.tickets || payload?.tickets;

  if (!Array.isArray(tickets)) {
    return [];
  }

  const mapTicket = tickets.find(
    (ticket) => ticket?.entity_type === "map"
  );

  const entities = mapTicket?.entities;

  if (!Array.isArray(entities)) {
    return [];
  }

  return entities
    .slice()
    .sort((a, b) => toNumber(a.round) - toNumber(b.round))
    .map((entity) => ({
      map: formatMapName(entity.guid),
      action: entity.status === "pick" ? "Picked" : "Banned",
      team:
        entity.selected_by === "faction1"
          ? team1
          : entity.selected_by === "faction2"
            ? team2
            : null,
    }));
}

// team1/team2/"decider" keyed by lowercased map name, built from the
// veto's "Picked" entries — used to badge each played map with who
// chose it (a map left over after every ban has no pick entry, so it
// reads as a decider).
function buildPickedTeamByMap(steps, team1, team2) {
  const lookup = new Map();

  steps
    .filter((step) => step.action === "Picked")
    .forEach((step) => {
      const key = step.map.toLowerCase();

      if (step.team === team1) {
        lookup.set(key, "team1");
      } else if (step.team === team2) {
        lookup.set(key, "team2");
      } else {
        lookup.set(key, "decider");
      }
    });

  return lookup;
}

function MapVetoCard({ steps, isLoading }) {
  const hasSteps = Array.isArray(steps) && steps.length > 0;

  return (
    <section className="flex h-full flex-col overflow-hidden rounded-[24px] border border-[#263244] bg-[#101722]">
      <div className="border-b border-[#263244] px-5 py-3 sm:px-6">
        <h2 className="text-xl font-black">Map Veto</h2>
        <p className="mt-1 text-xs text-slate-500">Pick &amp; ban process</p>
      </div>

      {hasSteps ? (
        <div className="space-y-1.5 p-3 sm:p-4">
          {steps.map((step, index) => (
            <div
              key={`${step.map}-${index}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-[#1d2634] bg-[#0b1119] px-3 py-2 text-sm"
            >
              <div className="flex min-w-0 items-center gap-2">
                {step.team?.logo && (
                  <img
                    src={step.team.logo}
                    alt=""
                    className="h-4 w-4 flex-shrink-0 rounded-sm object-contain"
                  />
                )}
                <span className="truncate font-semibold text-slate-300">
                  {step.team?.name || "Decider"}
                </span>
              </div>

              <div className="flex flex-shrink-0 items-center gap-2">
                <span
                  className={`text-xs font-black uppercase tracking-wide ${
                    step.action === "Picked"
                      ? "text-emerald-400"
                      : "text-rose-400"
                  }`}
                >
                  {step.action}
                </span>
                <span className="font-bold text-white">{step.map}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="w-full rounded-2xl border border-dashed border-[#2a3546] bg-[#0b1119] p-6 text-center">
            <div className="font-bold text-slate-300">
              {isLoading ? "Loading veto…" : "Coming soon"}
            </div>
            <div className="mt-2 text-sm text-slate-500">
              {isLoading
                ? "Fetching pick & ban history."
                : "No veto data available for this match yet."}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default function MatchMapResultsSection({
  matchId,
  maps,
  team1,
  team2,
  demoUrls,
  demoUnavailable,
}) {
  const [steps, setSteps] = useState(null);

  useEffect(() => {
    if (!matchId) {
      return;
    }

    let cancelled = false;
    setSteps(null);

    fetch(`/api/veto?matchId=${encodeURIComponent(matchId)}`)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Veto request failed");
        }
        return response.json();
      })
      .then((data) => {
        if (!cancelled) {
          setSteps(parseVetoSteps(data, team1, team2));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSteps([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [matchId, team1, team2]);

  const pickedTeamByMap = buildPickedTeamByMap(
    steps || [],
    team1,
    team2
  );

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.9fr)_minmax(280px,1fr)]">
      <FinishedMapsPanel
        maps={maps}
        team1={team1}
        team2={team2}
        demoUrls={demoUrls}
        demoUnavailable={demoUnavailable}
        pickedTeamByMap={pickedTeamByMap}
      />

      <MapVetoCard steps={steps} isLoading={Boolean(matchId) && steps === null} />
    </div>
  );
}
