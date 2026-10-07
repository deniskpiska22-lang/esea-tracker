import {
  Suspense,
  lazy,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useParams } from "react-router-dom";

import { useLocation } from "react-router-dom";
import { getMatchSeoMetadata, MATCH_SEO_COLUMNS } from "../utils/matchSeo.js";

import matchesData from "../data/matches";
import upcomingMatches from "../data/upcomingMatches";
import { supabase } from "../lib/supabaseClient";

// Each of these is ~2600 lines on its own — lazy so a visitor only ever
// downloads the one variant their match status actually needs, instead of
// all three bundled together just because MatchPageRouter picks between them.
const UpcomingMatchPage = lazy(() => import("./UpcomingMatchPage"));
const LiveMatchPage = lazy(() => import("./LiveMatchPage"));
const MatchPage = lazy(() => import("./MatchPage"));

function MatchLoading() {
  return (
    <div className="min-h-screen bg-[#0b0f14] p-8 text-center text-white">
      Loading match...
    </div>
  );
}

const LIVE_STATUSES = new Set([
  "LIVE",
  "ONGOING",
  "READY",
  "VOTING",
  "CONFIGURING",
  "MATCH_STATUS_ONGOING",
  "MATCH_STATUS_READY",
  "MATCH_STATUS_VOTING",
  "MATCH_STATUS_CONFIGURING",
  "PAUSED",
  "MATCH_STATUS_PAUSED",
]);

const FINISHED_STATUSES = new Set([
  "FINISHED",
  "MATCH_STATUS_FINISHED",
]);

/*
 * Every /match/:id-style route stays pointed at this one component so
 * existing links across the app don't need to change. It only decides
 * WHICH of the three page components to mount; each of those is fully
 * self-contained (own polling/status logic), so this never has to
 * re-decide after the initial pick.
 */
function MatchPageRouter() {
  const { pathname } = useLocation();
  const {
    matchId: routeMatchId,
    id: routeId,
  } = useParams();

  const matchId = routeMatchId || routeId || "";

  const finishedMatch = useMemo(
    () =>
      matchesData.find(
        (item) =>
          item.matchId === matchId ||
          item.id === matchId
      ) || null,
    [matchId]
  );

  const upcomingMatch = useMemo(
    () =>
      upcomingMatches.find(
        (item) =>
          item.matchId === matchId ||
          item.id === matchId
      ) || null,
    [matchId]
  );

  const [resolved, setResolved] = useState(null);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let cancelled = false;

    supabase
      .from("matches")
      .select(MATCH_SEO_COLUMNS)
      .eq("id", matchId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) {
          setResolved({ matchId, row: data || null });
          if (data) window.dispatchEvent(new CustomEvent("match-seo-update", { detail: { ...getMatchSeoMetadata(data), routePath: pathname } }));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResolved({ matchId, row: null });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [matchId, pathname]);

  const loading =
    Boolean(supabase) &&
    (!resolved || resolved.matchId !== matchId);

  const dbRow =
    resolved && resolved.matchId === matchId
      ? resolved.row
      : null;

  if (loading) {
    return <MatchLoading />;
  }

  if (!finishedMatch && !upcomingMatch && !dbRow) {
    return (
      <div className="min-h-screen bg-[#0b0f14] p-8 text-center text-white">
        <div className="text-xl font-bold">
          Match not found
        </div>
      </div>
    );
  }

  const normalizedStatus = String(
    dbRow?.status || ""
  ).toUpperCase();

  const isLive = LIVE_STATUSES.has(normalizedStatus);
  const apiSaysFinished = FINISHED_STATUSES.has(normalizedStatus);
  const showFinishedSections =
    Boolean(finishedMatch) || apiSaysFinished;

  if (isLive) {
    return (
      <Suspense fallback={<MatchLoading />}>
        <LiveMatchPage />
      </Suspense>
    );
  }

  if (showFinishedSections) {
    return (
      <Suspense fallback={<MatchLoading />}>
        <MatchPage />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<MatchLoading />}>
      <UpcomingMatchPage />
    </Suspense>
  );
}

export default MatchPageRouter;
