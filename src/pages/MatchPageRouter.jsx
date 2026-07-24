import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { useParams } from "react-router-dom";

import matchesData from "../data/matches";
import upcomingMatches from "../data/upcomingMatches";
import { supabase } from "../lib/supabaseClient";

import UpcomingMatchPage from "./UpcomingMatchPage";
import LiveMatchPage from "./LiveMatchPage";
import MatchPage from "./MatchPage";

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
      .select("status")
      .eq("id", matchId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) {
          setResolved({ matchId, row: data || null });
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
  }, [matchId]);

  const loading =
    Boolean(supabase) &&
    (!resolved || resolved.matchId !== matchId);

  const dbRow =
    resolved && resolved.matchId === matchId
      ? resolved.row
      : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b0f14] p-8 text-center text-white">
        Loading match...
      </div>
    );
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
    return <LiveMatchPage />;
  }

  if (showFinishedSections) {
    return <MatchPage />;
  }

  return <UpcomingMatchPage />;
}

export default MatchPageRouter;
