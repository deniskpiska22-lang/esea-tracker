import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Link,
  Navigate,
} from "react-router-dom";

import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import teams from "../data/teams";

const NAV_ITEMS = [
  {
    value: "overview",
    label: "Overview",
    icon: "◫",
  },
  {
    value: "verification",
    label: "Verification",
    icon: "✓",
  },
  {
    value: "users",
    label: "Users",
    icon: "◎",
  },
  {
    value: "teams",
    label: "Teams",
    icon: "◆",
  },
  {
    value: "team-profiles",
    label: "Team Profiles",
    icon: "🖼",
  },
  {
    value: "activity",
    label: "History",
    icon: "↺",
  },
];

const STATUS_META = {
  pending: {
    label: "Pending",
    badge:
      "border-amber-500/30 bg-amber-500/10 text-amber-300",
    dot: "bg-amber-400",
  },
  approved: {
    label: "Approved",
    badge:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    dot: "bg-emerald-400",
  },
  rejected: {
    label: "Rejected",
    badge:
      "border-red-500/30 bg-red-500/10 text-red-300",
    dot: "bg-red-400",
  },
};

const REQUEST_TYPE_META = {
  join_team: {
    label: "Initial verification",
    short: "Join",
  },
  change_team: {
    label: "Profile update",
    short: "Change",
  },
  leave_team: {
    label: "Leave team",
    short: "Leave",
  },
};

const ROLE_LABELS = {
  player: "Player",
  coach: "Coach",
  manager: "Manager",
  analyst: "Analyst",
};

const ACCOUNT_TYPE_LABELS = {
  fan: "Fan",
  player: "Player",
  staff: "Team Staff",
};

const SOCIAL_PLATFORM_OPTIONS = [
  "FACEIT",
  "HLTV",
  "Liquipedia",
  "Website",
  "Twitter/X",
  "Instagram",
  "Discord",
  "Telegram",
  "Other",
];

function formatDate(value, withTime = true) {
  if (!value) {
    return "Unknown";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(withTime
      ? {
          hour: "2-digit",
          minute: "2-digit",
        }
      : {}),
  }).format(date);
}

function relativeTime(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  const difference =
    Date.now() - date.getTime();

  if (!Number.isFinite(difference)) {
    return "";
  }

  const minutes = Math.max(
    0,
    Math.floor(difference / 60000)
  );

  if (minutes < 1) {
    return "just now";
  }

  if (minutes < 60) {
    return `${minutes} min ago`;
  }

  const hours = Math.floor(
    minutes / 60
  );

  if (hours < 24) {
    return `${hours} hr ago`;
  }

  const days = Math.floor(
    hours / 24
  );

  return `${days} days ago`;
}

function getInitials(profile) {
  const source =
    profile?.display_name ||
    profile?.username ||
    "?";

  return String(source)
    .trim()
    .slice(0, 2)
    .toUpperCase();
}

function StatusBadge({ status }) {
  const meta =
    STATUS_META[status] ||
    STATUS_META.pending;

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-black ${meta.badge}`}
    >
      <span
        className={`h-2 w-2 rounded-full ${meta.dot}`}
      />
      {meta.label}
    </span>
  );
}

function TeamMark({
  team,
  size = "h-12 w-12",
}) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/[0.07] bg-[#080d14] p-2 ${size}`}
    >
      {team?.logo ? (
        <img
          src={team.logo}
          alt={team.name}
          className="h-full w-full object-contain"
        />
      ) : (
        <span className="font-black text-orange-400">
          {String(
            team?.name || "FA"
          )
            .slice(0, 2)
            .toUpperCase()}
        </span>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  hint,
  icon,
  tone = "orange",
}) {
  const tones = {
    orange:
      "border-orange-500/20 bg-orange-500/[0.055]",
    amber:
      "border-amber-500/20 bg-amber-500/[0.055]",
    green:
      "border-emerald-500/20 bg-emerald-500/[0.055]",
    blue:
      "border-sky-500/20 bg-sky-500/[0.055]",
  };

  return (
    <div
      className={`relative overflow-hidden rounded-[26px] border p-5 ${
        tones[tone] || tones.orange
      }`}
    >
      <div className="absolute -right-6 -top-8 text-7xl font-black text-white/[0.025]">
        {icon}
      </div>

      <div className="relative">
        <div className="text-[11px] font-black uppercase tracking-[0.16em] text-gray-500">
          {label}
        </div>

        <div className="mt-3 text-4xl font-black tracking-tight text-white">
          {value}
        </div>

        <div className="mt-2 text-xs text-gray-600">
          {hint}
        </div>
      </div>
    </div>
  );
}

function EmptyState({
  title,
  text,
}) {
  return (
    <div className="flex min-h-[360px] flex-col items-center justify-center rounded-[28px] border border-dashed border-[#2b394b] bg-[#0a1018] px-6 text-center">
      <div className="text-4xl text-gray-700">
        ◇
      </div>
      <div className="mt-4 text-lg font-black text-white">
        {title}
      </div>
      <p className="mt-2 max-w-md text-sm leading-6 text-gray-600">
        {text}
      </p>
    </div>
  );
}

function PlayerPhotoRow({
  row,
  draft,
  saving,
  onChange,
  onSave,
}) {
  const preview =
    draft.url || row.avatar;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/[0.06] bg-[#0c121b] p-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/[0.05] font-black text-orange-300">
        {preview ? (
          <img
            src={preview}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          String(row.nickname || "?")
            .slice(0, 2)
            .toUpperCase()
        )}
      </div>

      <div className="min-w-[120px] shrink-0 truncate text-sm font-black text-white">
        {row.nickname}
      </div>

      <input
        value={draft.url}
        onChange={(event) =>
          onChange({
            ...draft,
            url: event.target.value,
          })
        }
        placeholder="Photo URL"
        className="min-w-[200px] flex-1 rounded-xl border border-white/[0.07] bg-[#080d14] px-3 py-2 text-sm outline-none placeholder:text-gray-700 focus:border-orange-500"
      />

      <label className="flex shrink-0 items-center gap-2 text-xs font-bold text-gray-400">
        <input
          type="checkbox"
          checked={draft.verified}
          onChange={(event) =>
            onChange({
              ...draft,
              verified: event.target.checked,
            })
          }
        />
        Verified
      </label>

      <button
        type="button"
        disabled={saving}
        onClick={onSave}
        className="shrink-0 rounded-xl border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-xs font-black text-orange-300 transition hover:bg-orange-500 hover:text-white disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save"}
      </button>
    </div>
  );
}

export default function AdminVerificationPage() {
  const {
    profile,
    loading: authLoading,
  } = useAuth();

  const [section, setSection] =
    useState("overview");
  const [claims, setClaims] =
    useState([]);
  const [profiles, setProfiles] =
    useState([]);
  const [loading, setLoading] =
    useState(true);
  const [refreshing, setRefreshing] =
    useState(false);
  const [error, setError] =
    useState("");
  const [success, setSuccess] =
    useState("");

  const [search, setSearch] =
    useState("");
  const [statusFilter, setStatusFilter] =
    useState("pending");
  const [typeFilter, setTypeFilter] =
    useState("all");
  const [selectedClaimId, setSelectedClaimId] =
    useState(null);
  const [processingId, setProcessingId] =
    useState(null);
  const [rejectionReason, setRejectionReason] =
    useState("");

  const [teamSearch, setTeamSearch] =
    useState("");
  const [selectedTeamSlug, setSelectedTeamSlug] =
    useState(null);
  const [teamProfileLoading, setTeamProfileLoading] =
    useState(false);
  const [teamDescriptionDraft, setTeamDescriptionDraft] =
    useState("");
  const [teamProfileSaving, setTeamProfileSaving] =
    useState(false);
  const [teamProfileError, setTeamProfileError] =
    useState("");
  const [teamProfileSuccess, setTeamProfileSuccess] =
    useState("");
  const [teamRoster, setTeamRoster] =
    useState([]);
  const [photoDrafts, setPhotoDrafts] =
    useState({});
  const [photoSavingId, setPhotoSavingId] =
    useState(null);
  const [socialLinksDraft, setSocialLinksDraft] =
    useState([]);
  const [socialLinksSaving, setSocialLinksSaving] =
    useState(false);

  const teamBySlug = useMemo(
    () =>
      new Map(
        teams.map((team) => [
          team.slug,
          team,
        ])
      ),
    []
  );

  const profilesById = useMemo(
    () =>
      new Map(
        profiles.map((item) => [
          item.id,
          item,
        ])
      ),
    [profiles]
  );

  const sortedAllTeams = useMemo(
    () =>
      [...teams].sort((a, b) =>
        a.name.localeCompare(b.name)
      ),
    []
  );

  const filteredAllTeams = useMemo(() => {
    const normalized =
      teamSearch.trim().toLowerCase();

    if (!normalized) {
      return sortedAllTeams;
    }

    return sortedAllTeams.filter((row) =>
      String(row.name || "")
        .toLowerCase()
        .includes(normalized)
    );
  }, [sortedAllTeams, teamSearch]);

  const selectedTeam = useMemo(
    () =>
      sortedAllTeams.find(
        (row) => row.slug === selectedTeamSlug
      ) || null,
    [sortedAllTeams, selectedTeamSlug]
  );

  const selectedTeamId =
    selectedTeam?.faceitTeamId ||
    selectedTeam?.faceit_team_id ||
    null;

  const loadDashboard = useCallback(
    async ({ silent = false } = {}) => {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      try {
        const [
          claimsResponse,
          profilesResponse,
        ] = await Promise.all([
          supabase
            .from("team_claim_requests")
            .select(`
              id,
              user_id,
              request_type,
              previous_team_slug,
              previous_account_type,
              previous_team_role,
              team_slug,
              account_type,
              team_role,
              birth_date,
              contact_email,
              contact_handle,
              proof_url,
              message,
              status,
              rejection_reason,
              created_at,
              reviewed_at,
              reviewed_by
            `)
            .order("created_at", {
              ascending: false,
            }),

          supabase
            .from("profiles")
            .select(`
              id,
              username,
              display_name,
              avatar_url,
              country_code,
              account_type,
              team_slug,
              team_role,
              verification_status,
              is_admin,
              created_at
            `)
            .order("created_at", {
              ascending: false,
            }),
        ]);

        if (claimsResponse.error) {
          throw claimsResponse.error;
        }

        if (profilesResponse.error) {
          throw profilesResponse.error;
        }

        const loadedClaims =
          Array.isArray(
            claimsResponse.data
          )
            ? claimsResponse.data
            : [];

        const loadedProfiles =
          Array.isArray(
            profilesResponse.data
          )
            ? profilesResponse.data
            : [];

        setClaims(loadedClaims);
        setProfiles(loadedProfiles);

        setSelectedClaimId(
          (current) => {
            if (
              current &&
              loadedClaims.some(
                (claim) =>
                  claim.id === current
              )
            ) {
              return current;
            }

            return (
              loadedClaims.find(
                (claim) =>
                  claim.status ===
                  "pending"
              )?.id ||
              loadedClaims[0]?.id ||
              null
            );
          }
        );
      } catch (loadError) {
        console.error(
          "Failed to load admin dashboard:",
          loadError
        );

        setError(
          loadError.message ||
            "Could not load the admin dashboard."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    if (profile?.is_admin) {
      loadDashboard();
    }
  }, [
    profile?.is_admin,
    loadDashboard,
  ]);

  useEffect(() => {
    if (!profile?.is_admin) {
      return undefined;
    }

    const channel = supabase
      .channel(
        "admin-verification-realtime"
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table:
            "team_claim_requests",
        },
        () => {
          loadDashboard({
            silent: true,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(
        channel
      );
    };
  }, [
    profile?.is_admin,
    loadDashboard,
  ]);

  useEffect(() => {
    if (!selectedTeamId) {
      return undefined;
    }

    let cancelled = false;

    async function loadTeamContent() {
      setTeamProfileLoading(true);
      setTeamProfileError("");
      setTeamProfileSuccess("");

      const [profileResponse, rosterResponse] =
        await Promise.all([
          supabase
            .from("team_profiles")
            .select("description,social_links")
            .eq("team_id", selectedTeamId)
            .maybeSingle(),
          supabase
            .from("team_players")
            .select(
              "player_id,official_photo_url,official_photo_verified,players!team_players_player_id_fkey(id,nickname,avatar)"
            )
            .eq("team_id", selectedTeamId),
        ]);

      if (cancelled) {
        return;
      }

      if (profileResponse.error) {
        console.error(
          "Team profile load failed:",
          profileResponse.error
        );
      }

      if (rosterResponse.error) {
        console.error(
          "Team roster load failed:",
          rosterResponse.error
        );
      }

      setTeamDescriptionDraft(
        profileResponse.data?.description || ""
      );

      setSocialLinksDraft(
        Array.isArray(
          profileResponse.data?.social_links
        )
          ? profileResponse.data.social_links
          : []
      );

      const rosterRows = (
        rosterResponse.data || []
      ).map((row) => {
        const player = Array.isArray(row.players)
          ? row.players[0]
          : row.players;

        return {
          playerId: row.player_id,
          nickname: player?.nickname || "Unknown",
          avatar: player?.avatar || null,
          officialPhotoUrl:
            row.official_photo_url || "",
          officialPhotoVerified: Boolean(
            row.official_photo_verified
          ),
        };
      });

      setTeamRoster(rosterRows);
      setPhotoDrafts(
        Object.fromEntries(
          rosterRows.map((row) => [
            row.playerId,
            {
              url: row.officialPhotoUrl,
              verified: row.officialPhotoVerified,
            },
          ])
        )
      );

      setTeamProfileLoading(false);
    }

    loadTeamContent();

    return () => {
      cancelled = true;
    };
  }, [selectedTeamId]);

  const counts = useMemo(() => {
    const result = {
      all: claims.length,
      pending: 0,
      approved: 0,
      rejected: 0,
      join_team: 0,
      change_team: 0,
      leave_team: 0,
    };

    claims.forEach((claim) => {
      if (result[claim.status] !== undefined) {
        result[claim.status] += 1;
      }

      if (
        result[claim.request_type] !==
        undefined
      ) {
        result[claim.request_type] += 1;
      }
    });

    return result;
  }, [claims]);

  const verifiedProfiles = useMemo(
    () =>
      profiles.filter(
        (item) =>
          item.verification_status ===
          "verified"
      ),
    [profiles]
  );

  const professionalProfiles =
    useMemo(
      () =>
        profiles.filter(
          (item) =>
            item.account_type ===
              "player" ||
            item.account_type ===
              "staff"
        ),
      [profiles]
    );

  const activeTeamCount = useMemo(
    () =>
      new Set(
        professionalProfiles
          .map(
            (item) =>
              item.team_slug
          )
          .filter(Boolean)
      ).size,
    [professionalProfiles]
  );

  const filteredClaims = useMemo(() => {
    const normalized =
      search.trim().toLowerCase();

    return claims.filter((claim) => {
      if (
        statusFilter !== "all" &&
        claim.status !== statusFilter
      ) {
        return false;
      }

      if (
        typeFilter !== "all" &&
        claim.request_type !==
          typeFilter
      ) {
        return false;
      }

      if (!normalized) {
        return true;
      }

      const userProfile =
        profilesById.get(
          claim.user_id
        );

      const currentTeam =
        teamBySlug.get(
          claim.previous_team_slug
        );

      const requestedTeam =
        teamBySlug.get(
          claim.team_slug
        );

      return [
        userProfile?.username,
        userProfile?.display_name,
        claim.contact_email,
        claim.contact_handle,
        claim.request_type,
        claim.status,
        claim.previous_team_slug,
        claim.team_slug,
        currentTeam?.name,
        requestedTeam?.name,
        claim.team_role,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalized);
    });
  }, [
    claims,
    search,
    statusFilter,
    typeFilter,
    profilesById,
    teamBySlug,
  ]);

  useEffect(() => {
    if (
      selectedClaimId &&
      filteredClaims.some(
        (claim) =>
          claim.id ===
          selectedClaimId
      )
    ) {
      return;
    }

    setSelectedClaimId(
      filteredClaims[0]?.id ||
        null
    );
  }, [
    filteredClaims,
    selectedClaimId,
  ]);

  const selectedClaim = useMemo(
    () =>
      claims.find(
        (claim) =>
          claim.id ===
          selectedClaimId
      ) || null,
    [
      claims,
      selectedClaimId,
    ]
  );

  const selectedProfile =
    selectedClaim
      ? profilesById.get(
          selectedClaim.user_id
        )
      : null;

  const recentClaims = useMemo(
    () => claims.slice(0, 6),
    [claims]
  );

  const recentUsers = useMemo(
    () => profiles.slice(0, 6),
    [profiles]
  );

  const teamRows = useMemo(() => {
    const countsByTeam =
      new Map();

    professionalProfiles.forEach(
      (item) => {
        if (!item.team_slug) {
          return;
        }

        const current =
          countsByTeam.get(
            item.team_slug
          ) || {
            total: 0,
            players: 0,
            staff: 0,
          };

        current.total += 1;

        if (
          item.account_type ===
          "player"
        ) {
          current.players += 1;
        } else {
          current.staff += 1;
        }

        countsByTeam.set(
          item.team_slug,
          current
        );
      }
    );

    return [...countsByTeam.entries()]
      .map(([slug, data]) => ({
        slug,
        team:
          teamBySlug.get(slug) ||
          {
            slug,
            name: slug,
          },
        ...data,
      }))
      .sort(
        (first, second) =>
          second.total -
          first.total
      );
  }, [
    professionalProfiles,
    teamBySlug,
  ]);

  async function reviewClaim(
    decision
  ) {
    if (!selectedClaim) {
      return;
    }

    const normalizedReason =
      rejectionReason.trim();

    if (
      decision === "rejected" &&
      !normalizedReason
    ) {
      setError(
        "Enter a rejection reason."
      );
      return;
    }

    setProcessingId(
      selectedClaim.id
    );
    setError("");
    setSuccess("");

    try {
      const {
        error: reviewError,
      } = await supabase.rpc(
        "review_team_claim",
        {
          p_claim_id:
            selectedClaim.id,
          p_decision: decision,
          p_rejection_reason:
            decision === "rejected"
              ? normalizedReason
              : null,
        }
      );

      if (reviewError) {
        throw reviewError;
      }

      setClaims((current) =>
        current.map((claim) =>
          claim.id ===
          selectedClaim.id
            ? {
                ...claim,
                status: decision,
                rejection_reason:
                  decision ===
                  "rejected"
                    ? normalizedReason
                    : null,
                reviewed_at:
                  new Date().toISOString(),
              }
            : claim
        )
      );

      setSuccess(
        decision === "approved"
          ? "Request approved successfully."
          : "Request rejected."
      );
      setRejectionReason("");
    } catch (reviewError) {
      console.error(
        "Failed to review claim:",
        reviewError
      );

      setError(
        reviewError.message ||
          "Could not process the request."
      );
    } finally {
      setProcessingId(null);
    }
  }

  async function saveTeamDescription() {
    if (!selectedTeamId) {
      return;
    }

    setTeamProfileSaving(true);
    setTeamProfileError("");
    setTeamProfileSuccess("");

    try {
      const { error } = await supabase.rpc(
        "upsert_team_profile",
        {
          p_team_id: selectedTeamId,
          p_description:
            teamDescriptionDraft.trim() || null,
        }
      );

      if (error) {
        throw error;
      }

      setTeamProfileSuccess(
        "Description saved."
      );
    } catch (error) {
      console.error(
        "Failed to save team description:",
        error
      );

      setTeamProfileError(
        error.message ||
          "Could not save the description."
      );
    } finally {
      setTeamProfileSaving(false);
    }
  }

  function addSocialLinkRow() {
    setSocialLinksDraft((current) => [
      ...current,
      { platform: SOCIAL_PLATFORM_OPTIONS[0], url: "" },
    ]);
  }

  function updateSocialLinkRow(index, patch) {
    setSocialLinksDraft((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index
          ? { ...row, ...patch }
          : row
      )
    );
  }

  function removeSocialLinkRow(index) {
    setSocialLinksDraft((current) =>
      current.filter(
        (_, rowIndex) => rowIndex !== index
      )
    );
  }

  async function saveSocialLinks() {
    if (!selectedTeamId) {
      return;
    }

    setSocialLinksSaving(true);
    setTeamProfileError("");
    setTeamProfileSuccess("");

    const cleaned = socialLinksDraft
      .map((row) => ({
        platform: row.platform || "Other",
        url: String(row.url || "").trim(),
      }))
      .filter((row) => row.url);

    try {
      const { error } = await supabase.rpc(
        "set_team_social_links",
        {
          p_team_id: selectedTeamId,
          p_social_links: cleaned,
        }
      );

      if (error) {
        throw error;
      }

      setSocialLinksDraft(cleaned);
      setTeamProfileSuccess("Social links saved.");
    } catch (error) {
      console.error(
        "Failed to save social links:",
        error
      );

      setTeamProfileError(
        error.message ||
          "Could not save the social links."
      );
    } finally {
      setSocialLinksSaving(false);
    }
  }

  async function savePlayerPhoto(playerId) {
    if (!selectedTeamId) {
      return;
    }

    const draft =
      photoDrafts[playerId] || {
        url: "",
        verified: false,
      };

    setPhotoSavingId(playerId);
    setTeamProfileError("");
    setTeamProfileSuccess("");

    try {
      const { error } = await supabase.rpc(
        "set_official_team_photo",
        {
          p_team_id: selectedTeamId,
          p_player_id: playerId,
          p_photo_url: draft.url.trim() || null,
          p_verified: Boolean(draft.verified),
        }
      );

      if (error) {
        throw error;
      }

      setTeamRoster((current) =>
        current.map((row) =>
          row.playerId === playerId
            ? {
                ...row,
                officialPhotoUrl: draft.url.trim(),
                officialPhotoVerified: Boolean(
                  draft.verified
                ),
              }
            : row
        )
      );

      setTeamProfileSuccess("Photo updated.");
    } catch (error) {
      console.error(
        "Failed to save player photo:",
        error
      );

      setTeamProfileError(
        error.message ||
          "Could not update the photo."
      );
    } finally {
      setPhotoSavingId(null);
    }
  }

  if (authLoading || loading) {
    return (
      <main className="min-h-screen bg-[#070b11] px-4 py-14 text-white">
        <div className="mx-auto max-w-7xl text-center text-gray-500">
          Loading Admin Center...
        </div>
      </main>
    );
  }

  if (!profile?.is_admin) {
    return (
      <Navigate
        to="/"
        replace
      />
    );
  }

  return (
    <main className="min-h-screen bg-[#070b11] text-white">
      <div className="mx-auto flex min-h-screen max-w-[1700px]">
        <aside className="hidden w-[250px] shrink-0 border-r border-white/[0.06] bg-[#090e15] px-4 py-6 xl:block">
          <div className="px-3">
            <div className="text-[11px] font-black uppercase tracking-[0.22em] text-orange-400">
              ESEA Tracker
            </div>
            <div className="mt-2 text-xl font-black">
              Admin Center
            </div>
            <div className="mt-1 text-xs text-gray-600">
              Operations dashboard
            </div>
          </div>

          <nav className="mt-8 space-y-1">
            {NAV_ITEMS.map((item) => {
              const active =
                section === item.value;

              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() =>
                    setSection(
                      item.value
                    )
                  }
                  className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-black transition ${
                    active
                      ? "bg-orange-500/10 text-orange-300"
                      : "text-gray-500 hover:bg-white/[0.04] hover:text-gray-200"
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-xl ${
                      active
                        ? "bg-orange-500/15"
                        : "bg-white/[0.035]"
                    }`}
                  >
                    {item.icon}
                  </span>
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="mt-8 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4">
            <div className="text-xs font-black text-gray-300">
              Quick status
            </div>

            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="text-gray-600">
                Pending
              </span>
              <span className="font-black text-amber-300">
                {counts.pending}
              </span>
            </div>

            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-gray-600">
                Users
              </span>
              <span className="font-black text-white">
                {profiles.length}
              </span>
            </div>
          </div>

          <Link
            to="/"
            className="mt-6 flex items-center justify-center rounded-2xl border border-white/[0.07] px-4 py-3 text-sm font-black text-gray-400 transition hover:border-orange-500/25 hover:text-orange-300"
          >
            ← Back to site
          </Link>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#070b11]/90 px-4 py-4 backdrop-blur-2xl md:px-7">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.18em] text-gray-600">
                  Admin workspace
                </div>

                <h1 className="mt-1 text-2xl font-black tracking-tight">
                  {
                    NAV_ITEMS.find(
                      (item) =>
                        item.value ===
                        section
                    )?.label
                  }
                </h1>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={refreshing}
                  onClick={() =>
                    loadDashboard({
                      silent: true,
                    })
                  }
                  className="rounded-2xl border border-white/[0.08] bg-white/[0.035] px-4 py-3 text-sm font-black text-gray-300 transition hover:border-orange-500/30 hover:text-orange-300 disabled:opacity-50"
                >
                  {refreshing
                    ? "Refreshing..."
                    : "↻ Refresh"}
                </button>

                <Link
                  to="/"
                  className="rounded-2xl bg-orange-500 px-4 py-3 text-sm font-black text-white transition hover:bg-orange-400 xl:hidden"
                >
                  Open site
                </Link>
              </div>
            </div>

            <div className="mt-4 flex gap-2 overflow-x-auto xl:hidden">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() =>
                    setSection(
                      item.value
                    )
                  }
                  className={`shrink-0 rounded-xl px-3 py-2 text-xs font-black ${
                    section === item.value
                      ? "bg-orange-500/10 text-orange-300"
                      : "bg-white/[0.03] text-gray-500"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </header>

          <div className="p-4 md:p-7">
            {error && (
              <div className="mb-5 rounded-2xl border border-red-500/25 bg-red-500/10 p-4 text-sm text-red-300">
                {error}
              </div>
            )}

            {success && (
              <div className="mb-5 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm text-emerald-300">
                {success}
              </div>
            )}

            {section === "overview" && (
              <div className="space-y-6">
                <section className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
                  <MetricCard
                    label="Awaiting review"
                    value={counts.pending}
                    hint="Action required"
                    icon="✓"
                    tone="amber"
                  />
                  <MetricCard
                    label="Verified"
                    value={
                      verifiedProfiles.length
                    }
                    hint="Professional profiles"
                    icon="◎"
                    tone="green"
                  />
                  <MetricCard
                    label="Users"
                    value={profiles.length}
                    hint="Total accounts"
                    icon="◫"
                    tone="blue"
                  />
                  <MetricCard
                    label="Active teams"
                    value={activeTeamCount}
                    hint="Represented in profiles"
                    icon="◆"
                    tone="orange"
                  />
                </section>

                <section className="grid gap-6 2xl:grid-cols-[1.35fr_0.65fr]">
                  <div className="rounded-[30px] border border-white/[0.07] bg-[#0c121b] p-5 md:p-6">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-xs font-black uppercase tracking-[0.17em] text-orange-400">
                          Verification activity
                        </div>
                        <h2 className="mt-2 text-xl font-black">
                          Latest requests
                        </h2>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setSection(
                            "verification"
                          )
                        }
                        className="text-sm font-black text-orange-400 hover:text-orange-300"
                      >
                        View all →
                      </button>
                    </div>

                    <div className="mt-5 space-y-2">
                      {recentClaims.map(
                        (claim) => {
                          const userProfile =
                            profilesById.get(
                              claim.user_id
                            );
                          const requestTeam =
                            teamBySlug.get(
                              claim.team_slug
                            );

                          return (
                            <button
                              key={claim.id}
                              type="button"
                              onClick={() => {
                                setSelectedClaimId(
                                  claim.id
                                );
                                setSection(
                                  "verification"
                                );
                              }}
                              className="flex w-full items-center gap-4 rounded-2xl border border-transparent px-3 py-3 text-left transition hover:border-white/[0.06] hover:bg-white/[0.025]"
                            >
                              <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-orange-500/10 font-black text-orange-300">
                                {userProfile?.avatar_url ? (
                                  <img
                                    src={
                                      userProfile.avatar_url
                                    }
                                    alt=""
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  getInitials(
                                    userProfile
                                  )
                                )}
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="truncate font-black text-white">
                                  {userProfile?.display_name ||
                                    userProfile?.username ||
                                    "Unknown"}
                                </div>
                                <div className="mt-1 truncate text-xs text-gray-600">
                                  {
                                    REQUEST_TYPE_META[
                                      claim.request_type
                                    ]?.label
                                  }
                                  {requestTeam?.name
                                    ? ` · ${requestTeam.name}`
                                    : ""}
                                </div>
                              </div>

                              <StatusBadge
                                status={
                                  claim.status
                                }
                              />
                            </button>
                          );
                        }
                      )}
                    </div>
                  </div>

                  <div className="rounded-[30px] border border-white/[0.07] bg-[#0c121b] p-5 md:p-6">
                    <div className="text-xs font-black uppercase tracking-[0.17em] text-orange-400">
                      Platform health
                    </div>
                    <h2 className="mt-2 text-xl font-black">
                      Platform status
                    </h2>

                    <div className="mt-6 space-y-5">
                      {[
                        {
                          label:
                            "Approval rate",
                          value:
                            counts.approved +
                              counts.rejected >
                            0
                              ? Math.round(
                                  (counts.approved /
                                    (counts.approved +
                                      counts.rejected)) *
                                    100
                                )
                              : 0,
                        },
                        {
                          label:
                            "Professional users",
                          value:
                            profiles.length >
                            0
                              ? Math.round(
                                  (professionalProfiles.length /
                                    profiles.length) *
                                    100
                                )
                              : 0,
                        },
                        {
                          label:
                            "Verified profiles",
                          value:
                            profiles.length >
                            0
                              ? Math.round(
                                  (verifiedProfiles.length /
                                    profiles.length) *
                                    100
                                )
                              : 0,
                        },
                      ].map((item) => (
                        <div
                          key={item.label}
                        >
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-500">
                              {item.label}
                            </span>
                            <span className="font-black text-white">
                              {item.value}%
                            </span>
                          </div>

                          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.05]">
                            <div
                              className="h-full rounded-full bg-orange-500"
                              style={{
                                width: `${Math.min(
                                  100,
                                  item.value
                                )}%`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                <section className="rounded-[30px] border border-white/[0.07] bg-[#0c121b] p-5 md:p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-black uppercase tracking-[0.17em] text-orange-400">
                        New accounts
                      </div>
                      <h2 className="mt-2 text-xl font-black">
                        New users
                      </h2>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setSection("users")
                      }
                      className="text-sm font-black text-orange-400 hover:text-orange-300"
                    >
                      Open users →
                    </button>
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {recentUsers.map(
                      (item) => (
                        <Link
                          key={item.id}
                          to={`/profile/${encodeURIComponent(
                            item.username || ""
                          )}`}
                          className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 transition hover:border-orange-500/25 hover:bg-orange-500/[0.035]"
                        >
                          <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-white/[0.05] font-black text-orange-300">
                            {item.avatar_url ? (
                              <img
                                src={
                                  item.avatar_url
                                }
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              getInitials(item)
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="truncate font-black text-white">
                              {item.display_name ||
                                item.username}
                            </div>
                            <div className="mt-1 truncate text-xs text-gray-600">
                              @{item.username}
                            </div>
                          </div>
                        </Link>
                      )
                    )}
                  </div>
                </section>
              </div>
            )}

            {section === "verification" && (
              <div className="space-y-5">
                <section className="rounded-[28px] border border-white/[0.07] bg-[#0c121b] p-4">
                  <div className="grid gap-3 xl:grid-cols-[1fr_auto_auto]">
                    <input
                      value={search}
                      onChange={(event) =>
                        setSearch(
                          event.target.value
                        )
                      }
                      placeholder="Search by username, team, or email..."
                      className="w-full rounded-2xl border border-white/[0.07] bg-[#080d14] px-4 py-3.5 text-sm outline-none placeholder:text-gray-700 focus:border-orange-500"
                    />

                    <select
                      value={statusFilter}
                      onChange={(event) =>
                        setStatusFilter(
                          event.target.value
                        )
                      }
                      className="rounded-2xl border border-white/[0.07] bg-[#080d14] px-4 py-3.5 text-sm font-bold outline-none focus:border-orange-500"
                    >
                      <option value="all">
                        All statuses
                      </option>
                      <option value="pending">
                        Pending
                      </option>
                      <option value="approved">
                        Approved
                      </option>
                      <option value="rejected">
                        Rejected
                      </option>
                    </select>

                    <select
                      value={typeFilter}
                      onChange={(event) =>
                        setTypeFilter(
                          event.target.value
                        )
                      }
                      className="rounded-2xl border border-white/[0.07] bg-[#080d14] px-4 py-3.5 text-sm font-bold outline-none focus:border-orange-500"
                    >
                      <option value="all">
                        All types
                      </option>
                      <option value="join_team">
                        Initial
                      </option>
                      <option value="change_team">
                        Update
                      </option>
                      <option value="leave_team">
                        Leave team
                      </option>
                    </select>
                  </div>
                </section>

                <section className="grid min-h-[720px] gap-5 2xl:grid-cols-[420px_minmax(0,1fr)]">
                  <div className="overflow-hidden rounded-[28px] border border-white/[0.07] bg-[#0c121b]">
                    <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
                      <div>
                        <div className="font-black">
                          Requests
                        </div>
                        <div className="mt-1 text-xs text-gray-600">
                          Found: {
                            filteredClaims.length
                          }
                        </div>
                      </div>

                      <span className="rounded-xl bg-amber-500/10 px-3 py-2 text-xs font-black text-amber-300">
                        {counts.pending} pending
                      </span>
                    </div>

                    <div className="max-h-[680px] overflow-y-auto p-2">
                      {filteredClaims.length ===
                      0 ? (
                        <div className="p-10 text-center text-sm text-gray-600">
                          No requests found
                        </div>
                      ) : (
                        filteredClaims.map(
                          (claim) => {
                            const userProfile =
                              profilesById.get(
                                claim.user_id
                              );
                            const currentTeam =
                              teamBySlug.get(
                                claim.previous_team_slug
                              );
                            const requestedTeam =
                              teamBySlug.get(
                                claim.team_slug
                              );
                            const active =
                              selectedClaimId ===
                              claim.id;

                            return (
                              <button
                                key={claim.id}
                                type="button"
                                onClick={() => {
                                  setSelectedClaimId(
                                    claim.id
                                  );
                                  setRejectionReason(
                                    ""
                                  );
                                }}
                                className={`mb-2 w-full rounded-2xl border p-4 text-left transition ${
                                  active
                                    ? "border-orange-500/35 bg-orange-500/[0.075]"
                                    : "border-transparent hover:border-white/[0.06] hover:bg-white/[0.025]"
                                }`}
                              >
                                <div className="flex items-start gap-3">
                                  <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/[0.05] font-black text-orange-300">
                                    {userProfile?.avatar_url ? (
                                      <img
                                        src={
                                          userProfile.avatar_url
                                        }
                                        alt=""
                                        className="h-full w-full object-cover"
                                      />
                                    ) : (
                                      getInitials(
                                        userProfile
                                      )
                                    )}
                                  </div>

                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="min-w-0">
                                        <div className="truncate font-black text-white">
                                          {userProfile?.display_name ||
                                            userProfile?.username ||
                                            "Unknown"}
                                        </div>
                                        <div className="mt-1 truncate text-xs text-gray-600">
                                          @{userProfile?.username ||
                                            "unknown"}
                                        </div>
                                      </div>

                                      <StatusBadge
                                        status={
                                          claim.status
                                        }
                                      />
                                    </div>

                                    <div className="mt-4 flex items-center gap-2 text-xs font-bold text-gray-500">
                                      <span className="truncate">
                                        {currentTeam?.name ||
                                          (claim.previous_team_slug
                                            ? claim.previous_team_slug
                                            : "No team")}
                                      </span>
                                      <span className="text-orange-400">
                                        →
                                      </span>
                                      <span className="truncate text-gray-300">
                                        {claim.request_type ===
                                        "leave_team"
                                          ? "Free Agent"
                                          : requestedTeam?.name ||
                                            claim.team_slug ||
                                            "Not specified"}
                                      </span>
                                    </div>

                                    <div className="mt-3 flex items-center justify-between gap-3 text-[11px]">
                                      <span className="font-black uppercase tracking-[0.1em] text-orange-400">
                                        {
                                          REQUEST_TYPE_META[
                                            claim.request_type
                                          ]?.short
                                        }
                                      </span>
                                      <span className="text-gray-700">
                                        {relativeTime(
                                          claim.created_at
                                        )}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </button>
                            );
                          }
                        )
                      )}
                    </div>
                  </div>

                  <div className="rounded-[28px] border border-white/[0.07] bg-[#0c121b]">
                    {!selectedClaim ? (
                      <EmptyState
                        title="Select a request"
                        text="The user profile, proposed changes, and moderation tools will appear on the right."
                      />
                    ) : (
                      <div>
                        <div className="border-b border-white/[0.06] p-5 md:p-6">
                          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                            <div className="flex items-center gap-4">
                              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-orange-500/10 text-xl font-black text-orange-300">
                                {selectedProfile?.avatar_url ? (
                                  <img
                                    src={
                                      selectedProfile.avatar_url
                                    }
                                    alt=""
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  getInitials(
                                    selectedProfile
                                  )
                                )}
                              </div>

                              <div>
                                <div className="text-2xl font-black">
                                  {selectedProfile?.display_name ||
                                    selectedProfile?.username ||
                                    "Unknown"}
                                </div>
                                <div className="mt-1 text-sm text-gray-600">
                                  @{selectedProfile?.username ||
                                    "unknown"}
                                </div>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  <StatusBadge
                                    status={
                                      selectedClaim.status
                                    }
                                  />
                                  <span className="rounded-full border border-orange-500/20 bg-orange-500/[0.06] px-3 py-1.5 text-[11px] font-black text-orange-300">
                                    {
                                      REQUEST_TYPE_META[
                                        selectedClaim.request_type
                                      ]?.label
                                    }
                                  </span>
                                </div>
                              </div>
                            </div>

                            {selectedProfile?.username && (
                              <Link
                                to={`/profile/${encodeURIComponent(
                                  selectedProfile.username
                                )}`}
                                className="rounded-2xl border border-white/[0.08] px-4 py-3 text-sm font-black text-gray-300 transition hover:border-orange-500/30 hover:text-orange-300"
                              >
                                Open profile ↗
                              </Link>
                            )}
                          </div>
                        </div>

                        <div className="p-5 md:p-6">
                          <div className="grid gap-5 xl:grid-cols-2">
                            <div className="rounded-[26px] border border-white/[0.07] bg-[#080d14] p-5">
                              <div className="text-[11px] font-black uppercase tracking-[0.17em] text-gray-600">
                                Current
                              </div>

                              <div className="mt-5 flex items-center gap-4">
                                <TeamMark
                                  team={
                                    teamBySlug.get(
                                      selectedClaim.previous_team_slug
                                    ) || {
                                      name:
                                        selectedClaim.previous_team_slug ||
                                        "No team",
                                    }
                                  }
                                  size="h-16 w-16"
                                />

                                <div>
                                  <div className="text-xl font-black">
                                    {teamBySlug.get(
                                      selectedClaim.previous_team_slug
                                    )?.name ||
                                      selectedClaim.previous_team_slug ||
                                      "No team"}
                                  </div>
                                  <div className="mt-2 text-sm font-bold text-gray-500">
                                    {ROLE_LABELS[
                                      selectedClaim.previous_team_role
                                    ] ||
                                      selectedClaim.previous_team_role ||
                                      "Role not specified"}
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="relative rounded-[26px] border border-orange-500/20 bg-orange-500/[0.045] p-5">
                              <div className="absolute -left-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-orange-500/30 bg-[#0c121b] font-black text-orange-400 xl:flex">
                                →
                              </div>

                              <div className="text-[11px] font-black uppercase tracking-[0.17em] text-orange-400">
                                Requested
                              </div>

                              <div className="mt-5 flex items-center gap-4">
                                <TeamMark
                                  team={
                                    selectedClaim.request_type ===
                                    "leave_team"
                                      ? {
                                          name:
                                            "Free Agent",
                                        }
                                      : teamBySlug.get(
                                          selectedClaim.team_slug
                                        ) || {
                                          name:
                                            selectedClaim.team_slug ||
                                            "Not specified",
                                        }
                                  }
                                  size="h-16 w-16"
                                />

                                <div>
                                  <div className="text-xl font-black">
                                    {selectedClaim.request_type ===
                                    "leave_team"
                                      ? "Free Agent"
                                      : teamBySlug.get(
                                          selectedClaim.team_slug
                                        )?.name ||
                                        selectedClaim.team_slug ||
                                        "Not specified"}
                                  </div>
                                  <div className="mt-2 text-sm font-bold text-orange-300">
                                    {selectedClaim.request_type ===
                                    "leave_team"
                                      ? "Leaving team"
                                      : ROLE_LABELS[
                                          selectedClaim.team_role
                                        ] ||
                                        selectedClaim.team_role ||
                                        "Role not specified"}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="mt-5 grid gap-4 md:grid-cols-2">
                            <div className="rounded-2xl border border-white/[0.06] bg-[#080d14] p-4">
                              <div className="text-xs text-gray-600">
                                Contact email
                              </div>
                              <a
                                href={`mailto:${selectedClaim.contact_email}`}
                                className="mt-2 block break-all font-black text-white hover:text-orange-400"
                              >
                                {selectedClaim.contact_email}
                              </a>
                            </div>

                            <div className="rounded-2xl border border-white/[0.06] bg-[#080d14] p-4">
                              <div className="text-xs text-gray-600">
                                Telegram / Discord
                              </div>
                              <div className="mt-2 break-all font-black text-white">
                                {selectedClaim.contact_handle ||
                                  "Not specified"}
                              </div>
                            </div>
                          </div>

                          <div className="mt-5 rounded-[26px] border border-white/[0.07] bg-[#080d14] p-5">
                            <div className="flex flex-wrap items-center justify-between gap-4">
                              <div>
                                <div className="text-xs text-gray-600">
                                  Proof
                                </div>
                                <div className="mt-2 text-sm font-black text-white">
                                  Proof of team affiliation
                                </div>
                              </div>

                              <a
                                href={
                                  selectedClaim.proof_url
                                }
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-2xl bg-orange-500 px-4 py-3 text-sm font-black text-white transition hover:bg-orange-400"
                              >
                                Open proof ↗
                              </a>
                            </div>

                            <div className="mt-4 break-all rounded-2xl bg-white/[0.025] p-4 text-sm text-gray-500">
                              {selectedClaim.proof_url}
                            </div>
                          </div>

                          <div className="mt-5 rounded-[26px] border border-white/[0.07] bg-[#080d14] p-5">
                            <div className="text-xs font-black uppercase tracking-[0.15em] text-gray-600">
                              User message
                            </div>
                            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-gray-300">
                              {selectedClaim.message ||
                                "The user did not leave a comment."}
                            </p>
                          </div>

                          {selectedClaim.status ===
                          "pending" ? (
                            <div className="mt-5 rounded-[26px] border border-white/[0.07] bg-[#080d14] p-5">
                              <div className="grid gap-4 xl:grid-cols-[1fr_auto]">
                                <textarea
                                  value={
                                    rejectionReason
                                  }
                                  onChange={(event) =>
                                    setRejectionReason(
                                      event.target.value
                                    )
                                  }
                                  rows={4}
                                  placeholder="Rejection reason — required only when rejecting..."
                                  className="w-full resize-y rounded-2xl border border-white/[0.07] bg-[#0c121b] px-4 py-3.5 text-sm outline-none placeholder:text-gray-700 focus:border-red-500"
                                />

                                <div className="flex min-w-[190px] flex-col gap-3">
                                  <button
                                    type="button"
                                    disabled={
                                      processingId ===
                                      selectedClaim.id
                                    }
                                    onClick={() =>
                                      reviewClaim(
                                        "approved"
                                      )
                                    }
                                    className="rounded-2xl bg-emerald-500 px-5 py-3.5 text-sm font-black text-white transition hover:bg-emerald-400 disabled:opacity-50"
                                  >
                                    {processingId ===
                                    selectedClaim.id
                                      ? "Processing..."
                                      : "✓ Approve"}
                                  </button>

                                  <button
                                    type="button"
                                    disabled={
                                      processingId ===
                                      selectedClaim.id
                                    }
                                    onClick={() =>
                                      reviewClaim(
                                        "rejected"
                                      )
                                    }
                                    className="rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-3.5 text-sm font-black text-red-300 transition hover:bg-red-500 hover:text-white disabled:opacity-50"
                                  >
                                    Reject
                                  </button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="mt-5 rounded-[26px] border border-white/[0.07] bg-[#080d14] p-5">
                              <div className="flex items-center justify-between gap-4">
                                <div>
                                  <div className="text-xs text-gray-600">
                                    Decision recorded
                                  </div>
                                  <div className="mt-2 font-black">
                                    {formatDate(
                                      selectedClaim.reviewed_at
                                    )}
                                  </div>
                                </div>

                                <StatusBadge
                                  status={
                                    selectedClaim.status
                                  }
                                />
                              </div>

                              {selectedClaim.rejection_reason && (
                                <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/[0.06] p-4 text-sm text-red-200">
                                  {
                                    selectedClaim.rejection_reason
                                  }
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              </div>
            )}

            {section === "users" && (
              <section className="overflow-hidden rounded-[30px] border border-white/[0.07] bg-[#0c121b]">
                <div className="border-b border-white/[0.06] p-5 md:p-6">
                  <div className="text-xs font-black uppercase tracking-[0.17em] text-orange-400">
                    User directory
                  </div>
                  <h2 className="mt-2 text-2xl font-black">
                    All users
                  </h2>
                  <p className="mt-2 text-sm text-gray-600">
                    Profiles, roles, teams, and verification status.
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] text-left">
                    <thead className="border-b border-white/[0.06] text-[11px] font-black uppercase tracking-[0.13em] text-gray-600">
                      <tr>
                        <th className="px-6 py-4">
                          User
                        </th>
                        <th className="px-6 py-4">
                          Type
                        </th>
                        <th className="px-6 py-4">
                          Team
                        </th>
                        <th className="px-6 py-4">
                          Verification
                        </th>
                        <th className="px-6 py-4">
                          Joined
                        </th>
                        <th className="px-6 py-4" />
                      </tr>
                    </thead>

                    <tbody>
                      {profiles.map(
                        (item) => (
                          <tr
                            key={item.id}
                            className="border-b border-white/[0.04] transition hover:bg-white/[0.02]"
                          >
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-white/[0.05] font-black text-orange-300">
                                  {item.avatar_url ? (
                                    <img
                                      src={
                                        item.avatar_url
                                      }
                                      alt=""
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    getInitials(
                                      item
                                    )
                                  )}
                                </div>

                                <div>
                                  <div className="font-black text-white">
                                    {item.display_name ||
                                      item.username}
                                  </div>
                                  <div className="mt-1 text-xs text-gray-600">
                                    @{item.username}
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td className="px-6 py-4 text-sm font-bold text-gray-400">
                              {ACCOUNT_TYPE_LABELS[
                                item.account_type
                              ] ||
                                item.account_type}
                              {item.is_admin
                                ? " · Admin"
                                : ""}
                            </td>

                            <td className="px-6 py-4 text-sm font-bold text-gray-400">
                              {teamBySlug.get(
                                item.team_slug
                              )?.name ||
                                (item.team_slug
                                  ? item.team_slug
                                  : "—")}
                            </td>

                            <td className="px-6 py-4">
                              <StatusBadge
                                status={
                                  item.verification_status ===
                                  "verified"
                                    ? "approved"
                                    : item.verification_status
                                }
                              />
                            </td>

                            <td className="px-6 py-4 text-sm text-gray-600">
                              {formatDate(
                                item.created_at,
                                false
                              )}
                            </td>

                            <td className="px-6 py-4 text-right">
                              <Link
                                to={`/profile/${encodeURIComponent(
                                  item.username || ""
                                )}`}
                                className="text-sm font-black text-orange-400 hover:text-orange-300"
                              >
                                Open →
                              </Link>
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {section === "teams" && (
                <section className="rounded-[30px] border border-white/[0.07] bg-[#0c121b] p-5 md:p-6">
                  <div className="text-xs font-black uppercase tracking-[0.17em] text-orange-400">
                    Team coverage
                  </div>
                  <h2 className="mt-2 text-2xl font-black">
                    Teams on the platform
                  </h2>

                  <div className="mt-6 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                    {teamRows.map(
                      (row) => (
                        <Link
                          key={row.slug}
                          to={`/team/${row.slug}`}
                          className="group rounded-[24px] border border-white/[0.06] bg-[#080d14] p-5 transition hover:border-orange-500/25 hover:bg-orange-500/[0.035]"
                        >
                          <div className="flex items-center gap-4">
                            <TeamMark
                              team={row.team}
                              size="h-16 w-16"
                            />

                            <div className="min-w-0">
                              <div className="truncate text-lg font-black text-white transition group-hover:text-orange-300">
                                {row.team.name}
                              </div>
                              <div className="mt-1 text-xs text-gray-600">
                                {row.total} verified members
                              </div>
                            </div>
                          </div>

                          <div className="mt-5 grid grid-cols-2 gap-3">
                            <div className="rounded-xl bg-white/[0.035] p-3">
                              <div className="text-xs text-gray-600">
                                Players
                              </div>
                              <div className="mt-1 text-xl font-black">
                                {row.players}
                              </div>
                            </div>

                            <div className="rounded-xl bg-white/[0.035] p-3">
                              <div className="text-xs text-gray-600">
                                Staff
                              </div>
                              <div className="mt-1 text-xl font-black">
                                {row.staff}
                              </div>
                            </div>
                          </div>
                        </Link>
                      )
                    )}
                  </div>
                </section>
            )}

            {section === "team-profiles" && (
                <section className="rounded-[30px] border border-white/[0.07] bg-[#0c121b] p-5 md:p-6">
                  <div className="text-xs font-black uppercase tracking-[0.17em] text-orange-400">
                    Team content
                  </div>
                  <h2 className="mt-2 text-2xl font-black">
                    Team profiles
                  </h2>
                  <p className="mt-2 text-sm text-gray-600">
                    Edit a team's public description, social links, and its players' official photos — each section publishes independently as soon as you save it.
                  </p>

                  <div className="mt-6 grid gap-5 2xl:grid-cols-[380px_minmax(0,1fr)]">
                    <div className="overflow-hidden rounded-[26px] border border-white/[0.07] bg-[#080d14]">
                      <div className="border-b border-white/[0.06] p-4">
                        <input
                          value={teamSearch}
                          onChange={(event) =>
                            setTeamSearch(
                              event.target.value
                            )
                          }
                          placeholder="Search teams..."
                          className="w-full rounded-2xl border border-white/[0.07] bg-[#0c121b] px-4 py-3 text-sm outline-none placeholder:text-gray-700 focus:border-orange-500"
                        />
                      </div>

                      <div className="max-h-[640px] overflow-y-auto p-2">
                        {filteredAllTeams.length === 0 && (
                          <div className="p-6 text-center text-sm text-gray-600">
                            No teams found
                          </div>
                        )}

                        {filteredAllTeams
                          .slice(0, 200)
                          .map((row) => {
                            const active =
                              row.slug ===
                              selectedTeamSlug;

                            return (
                              <button
                                key={row.slug}
                                type="button"
                                onClick={() =>
                                  setSelectedTeamSlug(
                                    row.slug
                                  )
                                }
                                className={`mb-1 flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition ${
                                  active
                                    ? "bg-orange-500/10 text-orange-300"
                                    : "text-gray-300 hover:bg-white/[0.04]"
                                }`}
                              >
                                <TeamMark
                                  team={row}
                                  size="h-8 w-8"
                                />
                                <span className="min-w-0 flex-1 truncate text-sm font-bold">
                                  {row.name}
                                </span>
                              </button>
                            );
                          })}
                      </div>
                    </div>

                    <div className="rounded-[26px] border border-white/[0.07] bg-[#080d14] p-5 md:p-6">
                      {!selectedTeam ? (
                        <EmptyState
                          title="Select a team"
                          text="Pick a team on the left to edit its description and official player photos."
                        />
                      ) : (
                        <div className="space-y-6">
                          <div className="flex items-center gap-4">
                            <TeamMark
                              team={selectedTeam}
                              size="h-14 w-14"
                            />
                            <div>
                              <div className="text-xl font-black">
                                {selectedTeam.name}
                              </div>
                              <div className="mt-1 text-xs text-gray-600">
                                {selectedTeam.division || ""}
                              </div>
                            </div>
                          </div>

                          {teamProfileError && (
                            <div className="rounded-2xl border border-red-500/25 bg-red-500/10 p-4 text-sm text-red-300">
                              {teamProfileError}
                            </div>
                          )}

                          {teamProfileSuccess && (
                            <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm text-emerald-300">
                              {teamProfileSuccess}
                            </div>
                          )}

                          <div>
                            <div className="text-xs font-black uppercase tracking-[0.15em] text-gray-600">
                              Description
                            </div>

                            <textarea
                              rows={5}
                              maxLength={2000}
                              value={teamDescriptionDraft}
                              disabled={teamProfileLoading}
                              onChange={(event) =>
                                setTeamDescriptionDraft(
                                  event.target.value
                                )
                              }
                              placeholder="Team description shown on the public team page..."
                              className="mt-3 w-full resize-y rounded-2xl border border-white/[0.07] bg-[#0c121b] px-4 py-3.5 text-sm outline-none placeholder:text-gray-700 focus:border-orange-500 disabled:opacity-60"
                            />

                            <button
                              type="button"
                              disabled={
                                teamProfileSaving ||
                                teamProfileLoading
                              }
                              onClick={saveTeamDescription}
                              className="mt-3 rounded-2xl bg-orange-500 px-5 py-3 text-sm font-black text-white transition hover:bg-orange-400 disabled:opacity-50"
                            >
                              {teamProfileSaving
                                ? "Saving..."
                                : "Save description"}
                            </button>
                          </div>

                          <div>
                            <div className="text-xs font-black uppercase tracking-[0.15em] text-gray-600">
                              Social links
                            </div>

                            <div className="mt-3 space-y-2">
                              {socialLinksDraft.map(
                                (row, index) => (
                                  <div
                                    key={index}
                                    className="flex flex-wrap items-center gap-2"
                                  >
                                    <select
                                      value={
                                        row.platform ||
                                        SOCIAL_PLATFORM_OPTIONS[0]
                                      }
                                      onChange={(event) =>
                                        updateSocialLinkRow(
                                          index,
                                          {
                                            platform:
                                              event.target
                                                .value,
                                          }
                                        )
                                      }
                                      className="shrink-0 rounded-xl border border-white/[0.07] bg-[#0c121b] px-3 py-2 text-sm outline-none focus:border-orange-500"
                                    >
                                      {SOCIAL_PLATFORM_OPTIONS.map(
                                        (option) => (
                                          <option
                                            key={option}
                                            value={option}
                                          >
                                            {option}
                                          </option>
                                        )
                                      )}
                                    </select>

                                    <input
                                      value={row.url || ""}
                                      onChange={(event) =>
                                        updateSocialLinkRow(
                                          index,
                                          {
                                            url: event.target
                                              .value,
                                          }
                                        )
                                      }
                                      placeholder="https://..."
                                      className="min-w-[200px] flex-1 rounded-xl border border-white/[0.07] bg-[#0c121b] px-3 py-2 text-sm outline-none placeholder:text-gray-700 focus:border-orange-500"
                                    />

                                    <button
                                      type="button"
                                      onClick={() =>
                                        removeSocialLinkRow(
                                          index
                                        )
                                      }
                                      className="shrink-0 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs font-black text-red-300 transition hover:bg-red-500 hover:text-white"
                                    >
                                      Remove
                                    </button>
                                  </div>
                                )
                              )}

                              {socialLinksDraft.length === 0 && (
                                <div className="text-sm text-gray-600">
                                  No social links yet.
                                </div>
                              )}
                            </div>

                            <div className="mt-3 flex flex-wrap gap-3">
                              <button
                                type="button"
                                onClick={addSocialLinkRow}
                                className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-5 py-3 text-sm font-black text-gray-300 transition hover:border-orange-500/30 hover:text-orange-300"
                              >
                                + Add link
                              </button>

                              <button
                                type="button"
                                disabled={
                                  socialLinksSaving ||
                                  teamProfileLoading
                                }
                                onClick={saveSocialLinks}
                                className="rounded-2xl bg-orange-500 px-5 py-3 text-sm font-black text-white transition hover:bg-orange-400 disabled:opacity-50"
                              >
                                {socialLinksSaving
                                  ? "Saving..."
                                  : "Save social links"}
                              </button>
                            </div>
                          </div>

                          <div>
                            <div className="text-xs font-black uppercase tracking-[0.15em] text-gray-600">
                              Official player photos
                            </div>

                            {teamProfileLoading ? (
                              <div className="mt-3 text-sm text-gray-600">
                                Loading roster...
                              </div>
                            ) : teamRoster.length === 0 ? (
                              <div className="mt-3 text-sm text-gray-600">
                                No roster found for this team yet.
                              </div>
                            ) : (
                              <div className="mt-3 space-y-3">
                                {teamRoster.map((row) => (
                                  <PlayerPhotoRow
                                    key={row.playerId}
                                    row={row}
                                    draft={
                                      photoDrafts[
                                        row.playerId
                                      ] || {
                                        url: "",
                                        verified: false,
                                      }
                                    }
                                    saving={
                                      photoSavingId ===
                                      row.playerId
                                    }
                                    onChange={(next) =>
                                      setPhotoDrafts(
                                        (current) => ({
                                          ...current,
                                          [row.playerId]: next,
                                        })
                                      )
                                    }
                                    onSave={() =>
                                      savePlayerPhoto(
                                        row.playerId
                                      )
                                    }
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </section>
            )}

            {section === "activity" && (
              <section className="rounded-[30px] border border-white/[0.07] bg-[#0c121b] p-5 md:p-6">
                <div className="text-xs font-black uppercase tracking-[0.17em] text-orange-400">
                  Audit timeline
                </div>
                <h2 className="mt-2 text-2xl font-black">
                  Request history
                </h2>

                <div className="mt-7 space-y-3">
                  {claims.map(
                    (claim) => {
                      const userProfile =
                        profilesById.get(
                          claim.user_id
                        );
                      const requestTeam =
                        teamBySlug.get(
                          claim.team_slug
                        );

                      return (
                        <button
                          key={claim.id}
                          type="button"
                          onClick={() => {
                            setSelectedClaimId(
                              claim.id
                            );
                            setSection(
                              "verification"
                            );
                          }}
                          className="flex w-full items-center gap-4 rounded-2xl border border-white/[0.06] bg-[#080d14] p-4 text-left transition hover:border-orange-500/25"
                        >
                          <div className={`h-3 w-3 rounded-full ${
                            STATUS_META[
                              claim.status
                            ]?.dot ||
                            "bg-gray-500"
                          }`} />

                          <div className="min-w-0 flex-1">
                            <div className="truncate font-black text-white">
                              {userProfile?.display_name ||
                                userProfile?.username ||
                                "Unknown"}
                            </div>
                            <div className="mt-1 truncate text-xs text-gray-600">
                              {
                                REQUEST_TYPE_META[
                                  claim.request_type
                                ]?.label
                              }
                              {requestTeam?.name
                                ? ` · ${requestTeam.name}`
                                : ""}
                            </div>
                          </div>

                          <div className="hidden text-right sm:block">
                            <StatusBadge
                              status={
                                claim.status
                              }
                            />
                            <div className="mt-2 text-xs text-gray-700">
                              {formatDate(
                                claim.created_at
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    }
                  )}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}