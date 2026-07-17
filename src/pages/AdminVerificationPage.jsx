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

const FILTERS = [
  {
    value: "all",
    label: "Все",
  },
  {
    value: "pending",
    label: "Ожидают",
  },
  {
    value: "approved",
    label: "Подтверждены",
  },
  {
    value: "rejected",
    label: "Отклонены",
  },
];

const STATUS_META = {
  pending: {
    label: "Ожидает проверки",
    badge:
      "border-amber-500/30 bg-amber-500/10 text-amber-300",
    dot: "bg-amber-400",
  },
  approved: {
    label: "Подтверждено",
    badge:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    dot: "bg-emerald-400",
  },
  rejected: {
    label: "Отклонено",
    badge:
      "border-red-500/30 bg-red-500/10 text-red-300",
    dot: "bg-red-400",
  },
};

const ROLE_LABELS = {
  player: "Player",
  coach: "Coach",
  manager: "Manager",
  analyst: "Analyst",
};

const ACCOUNT_TYPE_LABELS = {
  player: "Игрок",
  staff: "Team Staff",
};

const REQUEST_TYPE_LABELS = {
  join_team: "Первичная верификация",
  change_team: "Изменение профиля",
  leave_team: "Выход из команды",
};

function formatDate(value) {
  if (!value) {
    return "Неизвестно";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Неизвестно";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
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

function StatCard({
  label,
  value,
  hint,
  tone = "default",
}) {
  const toneClasses = {
    default:
      "border-[#263548] bg-[#0f1722]",
    orange:
      "border-orange-500/25 bg-orange-500/[0.06]",
    amber:
      "border-amber-500/25 bg-amber-500/[0.06]",
    green:
      "border-emerald-500/25 bg-emerald-500/[0.06]",
    red:
      "border-red-500/25 bg-red-500/[0.06]",
  };

  return (
    <div
      className={`rounded-3xl border p-5 ${
        toneClasses[tone] ||
        toneClasses.default
      }`}
    >
      <div className="text-xs font-black uppercase tracking-[0.15em] text-gray-500">
        {label}
      </div>

      <div className="mt-3 text-4xl font-black tracking-tight text-white">
        {value}
      </div>

      {hint && (
        <div className="mt-2 text-xs text-gray-500">
          {hint}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  const meta =
    STATUS_META[status] ||
    STATUS_META.pending;

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-black ${meta.badge}`}
    >
      <span
        className={`h-2 w-2 rounded-full ${meta.dot}`}
      />

      {meta.label}
    </span>
  );
}

export default function AdminVerificationPage() {
  const {
    profile,
    loading: authLoading,
  } = useAuth();

  const [claims, setClaims] =
    useState([]);
  const [profilesById, setProfilesById] =
    useState(new Map());
  const [loading, setLoading] =
    useState(true);
  const [refreshing, setRefreshing] =
    useState(false);
  const [error, setError] =
    useState("");
  const [success, setSuccess] =
    useState("");
  const [filter, setFilter] =
    useState("pending");
  const [search, setSearch] =
    useState("");
  const [processingId, setProcessingId] =
    useState(null);
  const [
    rejectionReasons,
    setRejectionReasons,
  ] = useState({});
  const [expandedId, setExpandedId] =
    useState(null);

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

  const loadDashboard = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      setError("");

      try {
        const {
          data: claimsData,
          error: claimsError,
        } = await supabase
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
          });

        if (claimsError) {
          throw claimsError;
        }

        const loadedClaims =
          Array.isArray(claimsData)
            ? claimsData
            : [];

        const userIds = [
          ...new Set(
            loadedClaims
              .map(
                (claim) =>
                  claim.user_id
              )
              .filter(Boolean)
          ),
        ];

        let loadedProfiles = [];

        if (userIds.length > 0) {
          const {
            data: profilesData,
            error: profilesError,
          } = await supabase
            .from("profiles")
            .select(`
              id,
              username,
              display_name,
              avatar_url,
              country_code
            `)
            .in("id", userIds);

          if (profilesError) {
            throw profilesError;
          }

          loadedProfiles =
            Array.isArray(profilesData)
              ? profilesData
              : [];
        }

        setClaims(loadedClaims);
        setProfilesById(
          new Map(
            loadedProfiles.map(
              (item) => [
                item.id,
                item,
              ]
            )
          )
        );
      } catch (loadError) {
        console.error(
          "Failed to load admin dashboard:",
          loadError
        );

        setError(
          loadError.message ||
            "Не удалось загрузить админ-панель."
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

  const counts = useMemo(() => {
    const result = {
      all: claims.length,
      pending: 0,
      approved: 0,
      rejected: 0,
    };

    claims.forEach((claim) => {
      if (
        Object.prototype.hasOwnProperty.call(
          result,
          claim.status
        )
      ) {
        result[claim.status] += 1;
      }
    });

    return result;
  }, [claims]);

  const filteredClaims = useMemo(() => {
    const normalizedSearch =
      search.trim().toLowerCase();

    return claims.filter((claim) => {
      if (
        filter !== "all" &&
        claim.status !== filter
      ) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const userProfile =
        profilesById.get(
          claim.user_id
        );

      const team =
        teamBySlug.get(
          claim.team_slug
        );

      const haystack = [
        userProfile?.username,
        userProfile?.display_name,
        claim.contact_email,
        claim.contact_handle,
        claim.team_slug,
        team?.name,
        claim.team_role,
        claim.account_type,
        claim.request_type,
        claim.previous_team_slug,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(
        normalizedSearch
      );
    });
  }, [
    claims,
    filter,
    search,
    profilesById,
    teamBySlug,
  ]);

  async function reviewClaim(
    claim,
    decision
  ) {
    const rejectionReason =
      rejectionReasons[
        claim.id
      ]?.trim();

    if (
      decision === "rejected" &&
      !rejectionReason
    ) {
      setError(
        "Для отклонения заявки укажите причину."
      );
      setExpandedId(claim.id);
      return;
    }

    setProcessingId(claim.id);
    setError("");
    setSuccess("");

    try {
      const {
        error: reviewError,
      } = await supabase.rpc(
        "review_team_claim",
        {
          p_claim_id: claim.id,
          p_decision: decision,
          p_rejection_reason:
            decision === "rejected"
              ? rejectionReason
              : null,
        }
      );

      if (reviewError) {
        throw reviewError;
      }

      setClaims((current) =>
        current.map((item) =>
          item.id === claim.id
            ? {
                ...item,
                status: decision,
                rejection_reason:
                  decision ===
                  "rejected"
                    ? rejectionReason
                    : null,
                reviewed_at:
                  new Date().toISOString(),
              }
            : item
        )
      );

      setSuccess(
        decision === "approved"
          ? "Заявка подтверждена."
          : "Заявка отклонена."
      );

      setRejectionReasons(
        (current) => {
          const next = {
            ...current,
          };

          delete next[claim.id];

          return next;
        }
      );
    } catch (reviewError) {
      console.error(
        "Failed to review claim:",
        reviewError
      );

      setError(
        reviewError.message ||
          "Не удалось обработать заявку."
      );
    } finally {
      setProcessingId(null);
    }
  }

  if (authLoading || loading) {
    return (
      <main className="min-h-screen bg-[#080d14] px-4 py-12 text-white">
        <div className="mx-auto max-w-7xl text-center text-gray-500">
          Загрузка админ-панели...
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
    <main className="min-h-screen bg-[#080d14] px-4 py-7 text-white md:px-8 md:py-10">
      <div className="mx-auto max-w-[1400px]">
        <section className="overflow-hidden rounded-[32px] border border-[#263548] bg-[#0f1722]">
          <div className="relative overflow-hidden border-b border-[#263548] bg-[linear-gradient(110deg,#7b2f12_0%,#3d2019_42%,#101925_100%)] px-6 py-8 md:px-8">
            <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_center,white_1px,transparent_1px)] [background-size:18px_18px]" />

            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.22em] text-orange-300">
                  ESEA Tracker Admin
                </div>

                <h1 className="mt-3 text-3xl font-black tracking-tight md:text-4xl">
                  Центр верификации
                </h1>

                <p className="mt-3 max-w-3xl text-sm leading-6 text-orange-50/60">
                  Проверяйте заявки игроков и сотрудников команд, открывайте доказательства и принимайте решение.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={refreshing}
                  onClick={() =>
                    loadDashboard({
                      silent: true,
                    })
                  }
                  className="rounded-xl border border-orange-500/40 bg-orange-500/10 px-4 py-3 text-sm font-black text-orange-300 transition hover:bg-orange-500 hover:text-white disabled:opacity-60"
                >
                  {refreshing
                    ? "Обновление..."
                    : "Обновить"}
                </button>

                <Link
                  to="/"
                  className="rounded-xl border border-white/10 bg-black/10 px-4 py-3 text-sm font-black text-gray-200 transition hover:bg-white/10"
                >
                  На сайт
                </Link>
              </div>
            </div>
          </div>

          <div className="p-5 md:p-7">
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="Все заявки"
                value={counts.all}
                hint="За всё время"
                tone="orange"
              />

              <StatCard
                label="Ожидают"
                value={counts.pending}
                hint="Нужны действия"
                tone="amber"
              />

              <StatCard
                label="Подтверждены"
                value={counts.approved}
                hint="Успешно проверены"
                tone="green"
              />

              <StatCard
                label="Отклонены"
                value={counts.rejected}
                hint="Не прошли проверку"
                tone="red"
              />
            </section>

            <section className="mt-6 rounded-3xl border border-[#263548] bg-[#0a1018] p-4">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex flex-wrap gap-2">
                  {FILTERS.map(
                    (item) => {
                      const active =
                        filter ===
                        item.value;

                      return (
                        <button
                          key={
                            item.value
                          }
                          type="button"
                          onClick={() =>
                            setFilter(
                              item.value
                            )
                          }
                          className={`rounded-xl border px-4 py-2.5 text-sm font-black transition ${
                            active
                              ? "border-orange-500/50 bg-orange-500/10 text-orange-300"
                              : "border-[#2b394b] text-gray-400 hover:border-[#41516a] hover:text-white"
                          }`}
                        >
                          {item.label}
                          <span className="ml-2 opacity-60">
                            {counts[
                              item.value
                            ]}
                          </span>
                        </button>
                      );
                    }
                  )}
                </div>

                <label className="block w-full xl:max-w-sm">
                  <span className="sr-only">
                    Поиск заявок
                  </span>

                  <input
                    value={search}
                    onChange={(event) =>
                      setSearch(
                        event.target.value
                      )
                    }
                    placeholder="Поиск по нику, команде, email..."
                    className="w-full rounded-2xl border border-[#2b394b] bg-[#080d14] px-4 py-3 text-sm text-white outline-none placeholder:text-gray-700 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15"
                  />
                </label>
              </div>
            </section>

            {error && (
              <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
                {error}
              </div>
            )}

            {success && (
              <div className="mt-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">
                {success}
              </div>
            )}

            <div className="mt-6">
              {filteredClaims.length ===
              0 ? (
                <div className="rounded-3xl border border-dashed border-[#2b394b] bg-[#0a1018] p-12 text-center">
                  <div className="text-3xl text-gray-700">
                    ◇
                  </div>

                  <div className="mt-4 font-black text-white">
                    Заявок не найдено
                  </div>

                  <p className="mt-2 text-sm text-gray-600">
                    Измените фильтр или строку поиска.
                  </p>
                </div>
              ) : (
                <div className="space-y-5">
                  {filteredClaims.map(
                    (claim) => {
                      const team =
                        teamBySlug.get(
                          claim.team_slug
                        );

                      const userProfile =
                        profilesById.get(
                          claim.user_id
                        );

                      const isExpanded =
                        expandedId ===
                        claim.id;

                      const isProcessing =
                        processingId ===
                        claim.id;

                      return (
                        <article
                          key={claim.id}
                          className="overflow-hidden rounded-[28px] border border-[#263548] bg-[#0c141f]"
                        >
                          <div className="grid gap-5 p-5 lg:grid-cols-[230px_minmax(0,1fr)_220px] lg:p-6">
                            <div>
                              <div className="flex items-center gap-4">
                                {userProfile?.avatar_url ? (
                                  <img
                                    src={
                                      userProfile.avatar_url
                                    }
                                    alt=""
                                    className="h-16 w-16 rounded-2xl border border-[#2b394b] object-cover"
                                  />
                                ) : (
                                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[#2b394b] bg-[#080d14] text-xl font-black text-orange-400">
                                    {getInitials(
                                      userProfile
                                    )}
                                  </div>
                                )}

                                <div className="min-w-0">
                                  <div className="truncate font-black text-white">
                                    {userProfile?.display_name ||
                                      userProfile?.username ||
                                      "Неизвестный пользователь"}
                                  </div>

                                  <div className="mt-1 truncate text-sm text-gray-500">
                                    @
                                    {userProfile?.username ||
                                      "unknown"}
                                  </div>
                                </div>
                              </div>

                              <div className="mt-4 inline-flex rounded-lg border border-orange-500/20 bg-orange-500/[0.06] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-orange-300">
                                {REQUEST_TYPE_LABELS[
                                  claim.request_type
                                ] ||
                                  REQUEST_TYPE_LABELS.join_team}
                              </div>

                              <div className="mt-5">
                                <StatusBadge
                                  status={
                                    claim.status
                                  }
                                />
                              </div>

                              <div className="mt-4 text-xs text-gray-600">
                                Подано
                              </div>

                              <div className="mt-1 text-sm text-gray-400">
                                {formatDate(
                                  claim.created_at
                                )}
                              </div>

                              {claim.reviewed_at && (
                                <>
                                  <div className="mt-4 text-xs text-gray-600">
                                    Рассмотрено
                                  </div>

                                  <div className="mt-1 text-sm text-gray-400">
                                    {formatDate(
                                      claim.reviewed_at
                                    )}
                                  </div>
                                </>
                              )}
                            </div>

                            <div className="min-w-0">
                              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-[#2b394b] bg-[#080d14] p-3">
                                  {team?.logo ? (
                                    <img
                                      src={
                                        team.logo
                                      }
                                      alt={
                                        team.name
                                      }
                                      className="h-full w-full object-contain"
                                    />
                                  ) : (
                                    <span className="text-xl font-black text-orange-400">
                                      TM
                                    </span>
                                  )}
                                </div>

                                <div className="min-w-0">
                                  <div className="truncate text-2xl font-black text-white">
                                    {team?.name ||
                                      claim.team_slug}
                                  </div>

                                  <div className="mt-2 flex flex-wrap gap-2">
                                    <span className="rounded-lg bg-orange-500/10 px-2.5 py-1 text-xs font-black text-orange-300">
                                      {ACCOUNT_TYPE_LABELS[
                                        claim.account_type
                                      ] ||
                                        claim.account_type}
                                    </span>

                                    <span className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 py-1 text-xs font-black text-gray-400">
                                      {ROLE_LABELS[
                                        claim.team_role
                                      ] ||
                                        claim.team_role}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="mt-5 grid gap-3 md:grid-cols-2">
                                <div className="rounded-2xl border border-[#263548] bg-[#080d14] p-4">
                                  <div className="text-xs text-gray-600">
                                    Email
                                  </div>

                                  <a
                                    href={`mailto:${claim.contact_email}`}
                                    className="mt-1 block break-all text-sm font-bold text-white transition hover:text-orange-400"
                                  >
                                    {claim.contact_email}
                                  </a>
                                </div>

                                <div className="rounded-2xl border border-[#263548] bg-[#080d14] p-4">
                                  <div className="text-xs text-gray-600">
                                    Discord / Telegram
                                  </div>

                                  <div className="mt-1 break-all text-sm font-bold text-white">
                                    {claim.contact_handle ||
                                      "Не указан"}
                                  </div>
                                </div>
                              </div>

                              {isExpanded && (
                                <div className="mt-4 space-y-4 rounded-2xl border border-[#263548] bg-[#080d14] p-4">
                                  <div>
                                    <div className="text-xs text-gray-600">
                                      Доказательство
                                    </div>

                                    <a
                                      href={
                                        claim.proof_url
                                      }
                                      target="_blank"
                                      rel="noreferrer"
                                      className="mt-1 block break-all text-sm font-bold text-orange-400 hover:text-orange-300"
                                    >
                                      {claim.proof_url}
                                    </a>
                                  </div>

                                  <div>
                                    <div className="text-xs text-gray-600">
                                      Комментарий пользователя
                                    </div>

                                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-300">
                                      {claim.message ||
                                        "Комментарий не оставлен."}
                                    </p>
                                  </div>

                                  {claim.rejection_reason && (
                                    <div className="rounded-xl border border-red-500/20 bg-red-500/[0.06] p-3">
                                      <div className="text-xs text-red-300/60">
                                        Причина отклонения
                                      </div>

                                      <p className="mt-1 text-sm text-red-200">
                                        {claim.rejection_reason}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              )}

                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedId(
                                    isExpanded
                                      ? null
                                      : claim.id
                                  )
                                }
                                className="mt-4 text-sm font-black text-orange-400 hover:text-orange-300"
                              >
                                {isExpanded
                                  ? "Скрыть детали ↑"
                                  : "Показать детали ↓"}
                              </button>
                            </div>

                            <div>
                              {claim.status ===
                              "pending" ? (
                                <div className="space-y-3">
                                  <a
                                    href={
                                      claim.proof_url
                                    }
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex w-full items-center justify-center rounded-2xl border border-orange-500/35 bg-orange-500/10 px-4 py-3 text-sm font-black text-orange-300 transition hover:bg-orange-500 hover:text-white"
                                  >
                                    Открыть доказательство
                                  </a>

                                  <button
                                    type="button"
                                    disabled={
                                      isProcessing
                                    }
                                    onClick={() =>
                                      reviewClaim(
                                        claim,
                                        "approved"
                                      )
                                    }
                                    className="w-full rounded-2xl bg-emerald-500 px-4 py-3.5 text-sm font-black text-white transition hover:bg-emerald-400 disabled:opacity-60"
                                  >
                                    {isProcessing
                                      ? "Обработка..."
                                      : "Подтвердить"}
                                  </button>

                                  <textarea
                                    rows={4}
                                    value={
                                      rejectionReasons[
                                        claim.id
                                      ] || ""
                                    }
                                    onChange={(
                                      event
                                    ) =>
                                      setRejectionReasons(
                                        (
                                          current
                                        ) => ({
                                          ...current,
                                          [claim.id]:
                                            event
                                              .target
                                              .value,
                                        })
                                      )
                                    }
                                    placeholder="Причина отклонения..."
                                    className="w-full resize-y rounded-2xl border border-[#2b394b] bg-[#080d14] px-4 py-3 text-sm text-white outline-none placeholder:text-gray-700 focus:border-red-500 focus:ring-2 focus:ring-red-500/10"
                                  />

                                  <button
                                    type="button"
                                    disabled={
                                      isProcessing
                                    }
                                    onClick={() =>
                                      reviewClaim(
                                        claim,
                                        "rejected"
                                      )
                                    }
                                    className="w-full rounded-2xl border border-red-500/35 bg-red-500/10 px-4 py-3.5 text-sm font-black text-red-300 transition hover:bg-red-500 hover:text-white disabled:opacity-60"
                                  >
                                    Отклонить
                                  </button>
                                </div>
                              ) : (
                                <div className="rounded-2xl border border-[#263548] bg-[#080d14] p-4 text-sm text-gray-500">
                                  Заявка уже рассмотрена.
                                </div>
                              )}
                            </div>
                          </div>
                        </article>
                      );
                    }
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}