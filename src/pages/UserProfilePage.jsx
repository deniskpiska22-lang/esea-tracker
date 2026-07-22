import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Link,
  useParams,
} from "react-router-dom";

import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import teams from "../data/teams";

const FINISHED_STATUSES = new Set([
  "FINISHED",
  "MATCH_STATUS_FINISHED",
]);

const BUG_HUNTER_USERNAMES = new Set([
  "lamp4x",
]);

function isBugHunter(username) {
  return BUG_HUNTER_USERNAMES.has(
    String(username || "").trim().toLowerCase()
  );
}

const ACCOUNT_TYPE_LABELS = {
  fan: {
    ru: "Фанат",
    en: "Fan",
  },
  player: {
    ru: "Игрок",
    en: "Player",
  },
  staff: {
    ru: "Сотрудник команды",
    en: "Team staff",
  },
};

const TEAM_ROLE_LABELS = {
  player: {
    ru: "Игрок",
    en: "Player",
  },
  coach: {
    ru: "Тренер",
    en: "Coach",
  },
  manager: {
    ru: "Менеджер",
    en: "Manager",
  },
  analyst: {
    ru: "Аналитик",
    en: "Analyst",
  },
};

function formatDate(value, language) {
  if (!value) {
    return language === "ru"
      ? "Неизвестно"
      : "Unknown";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return language === "ru"
      ? "Неизвестно"
      : "Unknown";
  }

  return new Intl.DateTimeFormat(
    language === "ru" ? "ru-RU" : "en-US",
    {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }
  ).format(date);
}

function formatDateTime(value, language) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat(
    language === "ru" ? "ru-RU" : "en-US",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  ).format(date);
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

function countryFlag(code) {
  if (!code || code.length !== 2) {
    return "";
  }

  return code
    .toUpperCase()
    .replace(
      /./g,
      (character) =>
        String.fromCodePoint(
          127397 + character.charCodeAt()
        )
    );
}

function getWinnerTeamId(match) {
  const status = String(
    match?.status || ""
  ).toUpperCase();

  if (!FINISHED_STATUSES.has(status)) {
    return null;
  }

  const team1Score = Number(match.team1_score);
  const team2Score = Number(match.team2_score);

  if (
    !Number.isFinite(team1Score) ||
    !Number.isFinite(team2Score) ||
    team1Score === team2Score
  ) {
    return null;
  }

  return String(
    team1Score > team2Score
      ? match.team1_id
      : match.team2_id
  );
}

function getLocalizedLabel(dictionary, key, language, fallback) {
  return (
    dictionary[key]?.[language] ||
    dictionary[key]?.en ||
    fallback
  );
}

function PanelTitle({
  eyebrow,
  title,
  action = null,
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        {eyebrow && (
          <div className="text-[10px] font-black uppercase tracking-[0.28em] text-orange-400">
            {eyebrow}
          </div>
        )}

        <h2 className="mt-1 text-xl font-black tracking-tight text-white">
          {title}
        </h2>
      </div>

      {action}
    </div>
  );
}

function BugHunterBadge({ compact = false }) {
  return (
    <span
      className={`inline-flex items-center gap-2 border border-orange-400/35 bg-[linear-gradient(135deg,rgba(249,115,22,0.20),rgba(234,88,12,0.07))] font-black uppercase text-orange-300 shadow-[0_0_24px_rgba(249,115,22,0.08)] ${
        compact
          ? "rounded-full px-3 py-1.5 text-[11px] tracking-[0.12em]"
          : "rounded-xl px-4 py-3 text-xs tracking-[0.16em]"
      }`}
    >
      <span className="flex h-5 w-5 items-center justify-center rounded-md bg-orange-500/15 text-sm">
        🛠
      </span>

      <span>Bug Hunter</span>

      {!compact && (
        <span className="ml-auto text-orange-400/70">
          ✓
        </span>
      )}
    </span>
  );
}

function VerificationBadge({
  status,
  tr,
}) {
  const config = {
    verified: {
      icon: "✓",
      label: tr("Подтверждено", "Verified"),
      className:
        "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
    },
    pending: {
      icon: "◷",
      label: tr("На проверке", "Pending"),
      className:
        "border-amber-400/25 bg-amber-400/10 text-amber-300",
    },
    rejected: {
      icon: "×",
      label: tr("Отклонено", "Rejected"),
      className:
        "border-red-400/25 bg-red-400/10 text-red-300",
    },
    none: {
      icon: "○",
      label: tr("Не подтверждено", "Not verified"),
      className:
        "border-white/10 bg-white/[0.03] text-gray-400",
    },
  };

  const current =
    config[status] || config.none;

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.12em] ${current.className}`}
    >
      <span>{current.icon}</span>
      {current.label}
    </span>
  );
}

function TeamMark({
  team,
  className = "h-16 w-16",
}) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-[#070b11] p-2.5 ${className}`}
    >
      {team?.logo ? (
        <img
          src={team.logo}
          alt={team.name}
          className="h-full w-full object-contain"
        />
      ) : (
        <span className="text-lg font-black text-orange-400">
          {team?.name
            ?.slice(0, 2)
            .toUpperCase() || "TM"}
        </span>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
  accent = false,
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border p-5 ${
        accent
          ? "border-orange-400/25 bg-orange-500/[0.08]"
          : "border-white/[0.07] bg-white/[0.025]"
      }`}
    >
      {accent && (
        <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-orange-500/15 blur-2xl" />
      )}

      <div className="relative">
        <div className="text-[10px] font-black uppercase tracking-[0.22em] text-gray-500">
          {label}
        </div>

        <div className="mt-2 text-3xl font-black tracking-tight text-white">
          {value}
        </div>

        {detail && (
          <div className="mt-2 text-xs text-gray-500">
            {detail}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({
  title,
  text,
  action = null,
}) {
  return (
    <div className="flex min-h-44 flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-black/10 px-6 py-8 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-xl text-gray-500">
        ◇
      </div>

      <div className="mt-4 font-black text-white">
        {title}
      </div>

      <p className="mt-2 max-w-md text-sm leading-6 text-gray-500">
        {text}
      </p>

      {action}
    </div>
  );
}

function ProfessionalPanel({
  profile,
  team,
  isOwnProfile,
  tr,
  language,
}) {
  const accountType =
    getLocalizedLabel(
      ACCOUNT_TYPE_LABELS,
      profile.account_type,
      language,
      tr("Профессиональный аккаунт", "Professional account")
    );

  const role =
    getLocalizedLabel(
      TEAM_ROLE_LABELS,
      profile.team_role,
      language,
      tr("Роль не указана", "Role not specified")
    );

  const verificationPath =
    `/profile/${encodeURIComponent(
      profile.username
    )}/verification`;

  if (profile.account_type === "fan") {
    return (
      <section className="rounded-[26px] border border-white/[0.07] bg-[#0d141e] p-6">
        <PanelTitle
          eyebrow={tr("Карьера", "Career")}
          title={tr("Профессиональный профиль", "Professional profile")}
        />

        <div className="mt-6">
          <EmptyState
            title={tr(
              "Профессиональный статус не указан",
              "No professional status"
            )}
            text={tr(
              "Игроки, тренеры, менеджеры и аналитики могут подтвердить принадлежность к команде.",
              "Players, coaches, managers, and analysts can verify their team affiliation."
            )}
            action={
              isOwnProfile ? (
                <Link
                  to={verificationPath}
                  className="mt-5 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-black text-white transition hover:bg-orange-400"
                >
                  {tr("Пройти верификацию", "Get verified")}
                </Link>
              ) : null
            }
          />
        </div>
      </section>
    );
  }

  if (!team) {
    return (
      <section className="relative overflow-hidden rounded-[26px] border border-white/[0.07] bg-[#0d141e] p-6">
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-orange-500/[0.08] blur-3xl" />

        <div className="relative">
          <PanelTitle
            eyebrow={tr("Карьера", "Career")}
            title={tr("Свободный агент", "Free agent")}
            action={
              <VerificationBadge
                status={profile.verification_status}
                tr={tr}
              />
            }
          />

          <div className="mt-7 rounded-2xl border border-orange-400/15 bg-orange-500/[0.05] p-6">
            <div className="inline-flex rounded-full border border-orange-400/20 bg-orange-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-orange-300">
              Free Agent
            </div>

            <div className="mt-4 text-3xl font-black tracking-tight text-white">
              {accountType}
            </div>

            <p className="mt-3 text-sm leading-6 text-gray-400">
              {tr(
                "Профессиональный профиль подтверждён, но пользователь сейчас не состоит в команде.",
                "The professional profile is verified, but the user is not currently on a team."
              )}
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-white/[0.07] bg-black/15 p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-600">
                  {tr("Тип", "Type")}
                </div>
                <div className="mt-2 font-black text-white">
                  {accountType}
                </div>
              </div>

              <div className="rounded-xl border border-white/[0.07] bg-black/15 p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-600">
                  {tr("Роль", "Role")}
                </div>
                <div className="mt-2 font-black text-white">
                  {role}
                </div>
              </div>
            </div>

            {isOwnProfile && (
              <Link
                to={verificationPath}
                className="mt-6 inline-flex rounded-xl border border-orange-400/25 bg-orange-500/10 px-4 py-2.5 text-sm font-black text-orange-300 transition hover:bg-orange-500 hover:text-white"
              >
                {tr(
                  "Изменить профессиональную информацию",
                  "Edit professional information"
                )}
              </Link>
            )}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="relative overflow-hidden rounded-[26px] border border-white/[0.07] bg-[#0d141e] p-6">
      <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-orange-500/[0.08] blur-3xl" />

      <div className="relative">
        <PanelTitle
          eyebrow={tr("Карьера", "Career")}
          title={tr("Текущая команда", "Current team")}
          action={
            <VerificationBadge
              status={profile.verification_status}
              tr={tr}
            />
          }
        />

        <div className="mt-7 flex flex-col gap-6 sm:flex-row sm:items-center">
          <Link
            to={`/team/${team.slug}`}
            className="group shrink-0"
          >
            <TeamMark
              team={team}
              className="h-28 w-28 rounded-[26px]"
            />
          </Link>

          <div className="min-w-0 flex-1">
            <Link
              to={`/team/${team.slug}`}
              className="block truncate text-3xl font-black tracking-tight text-white transition hover:text-orange-400"
            >
              {team.name}
            </Link>

            <div className="mt-2 text-sm font-black text-orange-300">
              {role}
            </div>

            <p className="mt-4 text-sm leading-6 text-gray-400">
              {profile.verification_status === "verified"
                ? tr(
                    "Команда и роль подтверждены администрацией платформы.",
                    "Team affiliation and role have been verified by the platform."
                  )
                : profile.verification_status === "pending"
                  ? tr(
                      "Заявка отправлена и ожидает проверки.",
                      "The request has been submitted and is awaiting review."
                    )
                  : profile.verification_status === "rejected"
                    ? tr(
                        "Заявка отклонена. Информацию можно обновить и отправить повторно.",
                        "The request was rejected. You can update the information and submit it again."
                      )
                    : tr(
                        "Командная принадлежность пока не подтверждена.",
                        "Team affiliation has not yet been verified."
                      )}
            </p>
          </div>
        </div>

        <div className="mt-7 grid gap-3 border-t border-white/[0.07] pt-5 sm:grid-cols-2">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-600">
              {tr("Тип аккаунта", "Account type")}
            </div>

            <div className="mt-2 font-black text-white">
              {accountType}
            </div>
          </div>

          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-600">
              {tr("Роль в команде", "Team role")}
            </div>

            <div className="mt-2 font-black text-white">
              {role}
            </div>
          </div>
        </div>

        {isOwnProfile && (
          <Link
            to={verificationPath}
            className="mt-6 inline-flex rounded-xl border border-orange-400/25 bg-orange-500/10 px-4 py-2.5 text-sm font-black text-orange-300 transition hover:bg-orange-500 hover:text-white"
          >
            {profile.verification_status === "pending"
              ? tr("Посмотреть заявку", "View request")
              : profile.verification_status === "rejected"
                ? tr("Отправить повторно", "Submit again")
                : tr(
                    "Изменить профессиональную информацию",
                    "Edit professional information"
                  )}
          </Link>
        )}
      </div>
    </section>
  );
}

export default function UserProfilePage() {
  const { tr, language } = useLanguage();
  const { username } = useParams();

  const {
    user,
    profile: currentProfile,
    loading: authLoading,
  } = useAuth();

  const [profile, setProfile] = useState(null);
  const [comments, setComments] = useState([]);
  const [votes, setVotes] = useState([]);
  const [matches, setMatches] = useState([]);
  const [commentCount, setCommentCount] =
    useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadProfileData =
    useCallback(async () => {
      if (!supabase || !username) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const {
          data: loadedProfile,
          error: profileError,
        } = await supabase
          .from("profiles")
          .select(`
            id,
            username,
            display_name,
            avatar_url,
            bio,
            country_code,
            favorite_team_slug,
            account_type,
            team_slug,
            team_role,
            verification_status,
            created_at,
            updated_at
          `)
          .ilike("username", username)
          .maybeSingle();

        if (profileError) {
          throw profileError;
        }

        if (!loadedProfile) {
          setProfile(null);
          setComments([]);
          setVotes([]);
          setMatches([]);
          setCommentCount(0);
          return;
        }

        const [
          commentsResponse,
          commentsCountResponse,
          votesResponse,
        ] = await Promise.all([
          supabase
            .from("match_comments")
            .select(`
              id,
              match_id,
              body,
              created_at,
              updated_at
            `)
            .eq("user_id", loadedProfile.id)
            .order("created_at", {
              ascending: false,
            })
            .limit(10),

          supabase
            .from("match_comments")
            .select("id", {
              count: "exact",
              head: true,
            })
            .eq("user_id", loadedProfile.id),

          supabase
            .from("match_votes")
            .select(`
              match_id,
              team_id,
              created_at
            `)
            .eq("user_id", loadedProfile.id)
            .order("created_at", {
              ascending: false,
            }),
        ]);

        if (commentsResponse.error) {
          throw commentsResponse.error;
        }

        if (commentsCountResponse.error) {
          throw commentsCountResponse.error;
        }

        if (votesResponse.error) {
          throw votesResponse.error;
        }

        const loadedVotes =
          Array.isArray(votesResponse.data)
            ? votesResponse.data
            : [];

        const matchIds = [
          ...new Set(
            loadedVotes
              .map((vote) => vote.match_id)
              .filter(Boolean)
          ),
        ];

        let loadedMatches = [];

        if (matchIds.length > 0) {
          const {
            data: matchesData,
            error: matchesError,
          } = await supabase
            .from("matches")
            .select(`
              id,
              status,
              team1_id,
              team2_id,
              team1_score,
              team2_score
            `)
            .in("id", matchIds);

          if (matchesError) {
            throw matchesError;
          }

          loadedMatches =
            Array.isArray(matchesData)
              ? matchesData
              : [];
        }

        setProfile(loadedProfile);
        setComments(
          Array.isArray(commentsResponse.data)
            ? commentsResponse.data
            : []
        );
        setCommentCount(
          commentsCountResponse.count || 0
        );
        setVotes(loadedVotes);
        setMatches(loadedMatches);
      } catch (loadError) {
        console.error(
          "Failed to load profile page:",
          loadError
        );

        setError(
          tr(
            "Не удалось загрузить профиль.",
            "Could not load the profile."
          )
        );
      } finally {
        setLoading(false);
      }
    }, [username, tr]);

  useEffect(() => {
    loadProfileData();
  }, [loadProfileData]);

  const favoriteTeam = useMemo(() => {
    if (!profile?.favorite_team_slug) {
      return null;
    }

    return (
      teams.find(
        (team) =>
          team.slug ===
          profile.favorite_team_slug
      ) || null
    );
  }, [profile?.favorite_team_slug]);

  const profileTeam = useMemo(() => {
    if (!profile?.team_slug) {
      return null;
    }

    return (
      teams.find(
        (team) =>
          team.slug === profile.team_slug
      ) || null
    );
  }, [profile?.team_slug]);

  const isOwnProfile = Boolean(
    user?.id &&
      profile?.id &&
      user.id === profile.id
  );

  const hasBugHunterBadge = isBugHunter(
    profile?.username
  );

  const matchById = useMemo(
    () =>
      new Map(
        matches.map((match) => [
          String(match.id),
          match,
        ])
      ),
    [matches]
  );

  const settledPredictions = useMemo(
    () =>
      votes.filter((vote) => {
        const match = matchById.get(
          String(vote.match_id)
        );

        return Boolean(
          getWinnerTeamId(match)
        );
      }),
    [votes, matchById]
  );

  const correctPredictions = useMemo(
    () =>
      settledPredictions.filter(
        (vote) => {
          const match = matchById.get(
            String(vote.match_id)
          );

          return (
            getWinnerTeamId(match) ===
            String(vote.team_id)
          );
        }
      ).length,
    [settledPredictions, matchById]
  );

  const predictionAccuracy =
    settledPredictions.length > 0
      ? Math.round(
          (correctPredictions /
            settledPredictions.length) *
            100
        )
      : null;

  const membershipDays = useMemo(() => {
    if (!profile?.created_at) {
      return 0;
    }

    const createdAt = new Date(
      profile.created_at
    );

    if (
      Number.isNaN(createdAt.getTime())
    ) {
      return 0;
    }

    return Math.max(
      0,
      Math.floor(
        (Date.now() -
          createdAt.getTime()) /
          86400000
      )
    );
  }, [profile?.created_at]);

  if (loading || authLoading) {
    return (
      <main className="min-h-screen bg-[#060a0f] px-4 py-12 text-white">
        <div className="mx-auto max-w-7xl text-center text-gray-500">
          {tr(
            "Загрузка профиля...",
            "Loading profile..."
          )}
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-[#060a0f] px-4 py-12 text-white">
        <div className="mx-auto max-w-3xl rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-center text-red-300">
          {error}
        </div>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="min-h-screen bg-[#060a0f] px-4 py-12 text-white">
        <div className="mx-auto max-w-3xl rounded-[28px] border border-white/[0.07] bg-[#0d141e] p-8 text-center">
          <h1 className="text-3xl font-black">
            {tr(
              "Профиль не найден",
              "Profile not found"
            )}
          </h1>

          <p className="mt-2 text-gray-500">
            {tr("Пользователь", "User")} @{username}{" "}
            {tr(
              "не существует.",
              "does not exist."
            )}
          </p>

          <Link
            to="/"
            className="mt-6 inline-flex rounded-xl bg-orange-500 px-5 py-3 font-black transition hover:bg-orange-400"
          >
            {tr("На главную", "Go home")}
          </Link>
        </div>
      </main>
    );
  }

  const accountType =
    getLocalizedLabel(
      ACCOUNT_TYPE_LABELS,
      profile.account_type,
      language,
      tr("Пользователь", "User")
    );

  const teamRole =
    getLocalizedLabel(
      TEAM_ROLE_LABELS,
      profile.team_role,
      language,
      null
    );

  return (
    <main className="min-h-screen bg-[#060a0f] px-4 py-6 text-white md:px-8 md:py-10">
      <div className="mx-auto max-w-[1320px]">
        <section className="overflow-hidden rounded-[32px] border border-white/[0.08] bg-[#0a1018] shadow-[0_32px_110px_rgba(0,0,0,0.45)]">
          <div className="relative h-48 overflow-hidden bg-[linear-gradient(115deg,#aa3f10_0%,#672817_28%,#24191b_58%,#0c1520_100%)] md:h-60">
            <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.04)_1px,transparent_1px)] [background-size:34px_34px]" />
            <div className="absolute -left-20 top-10 h-56 w-56 rounded-full bg-orange-400/20 blur-3xl" />
          </div>

          <div className="px-5 pb-8 md:px-8">
            <div className="-mt-20 grid gap-6 xl:grid-cols-[180px_minmax(0,1fr)_auto] xl:items-start">
              <div className="relative z-10">
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.username}
                    className="h-40 w-40 rounded-[32px] border-[6px] border-[#0a1018] bg-[#070b11] object-cover shadow-2xl md:h-44 md:w-44"
                  />
                ) : (
                  <div className="flex h-40 w-40 items-center justify-center rounded-[32px] border-[6px] border-[#0a1018] bg-[#070b11] text-5xl font-black text-orange-400 shadow-2xl md:h-44 md:w-44">
                    {getInitials(profile)}
                  </div>
                )}

                {profile.verification_status ===
                  "verified" && (
                  <div className="absolute -bottom-1 right-1 flex h-10 w-10 items-center justify-center rounded-full border-[5px] border-[#0a1018] bg-emerald-400 font-black text-[#07110c]">
                    ✓
                  </div>
                )}
              </div>

              <div className="min-w-0 pt-24 md:pt-28 xl:pb-2 xl:pt-24">
                <div className="flex min-w-0 flex-wrap items-center gap-3">
                  <h1 className="min-w-0 break-words text-4xl font-black tracking-[-0.045em] text-white md:text-6xl">
                    {profile.display_name ||
                      profile.username}
                  </h1>

                  {profile.country_code && (
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm font-black text-white">
                      {countryFlag(
                        profile.country_code
                      )}{" "}
                      {profile.country_code.toUpperCase()}
                    </span>
                  )}
                </div>

                <div className="mt-2 text-base font-bold text-gray-400">
                  @{profile.username}
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.12em] text-gray-300">
                    {accountType}
                  </span>

                  {teamRole && (
                    <span className="rounded-full border border-orange-400/20 bg-orange-500/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.12em] text-orange-300">
                      {teamRole}
                    </span>
                  )}

                  <VerificationBadge
                    status={profile.verification_status}
                    tr={tr}
                  />

                  {hasBugHunterBadge && (
                    <BugHunterBadge compact />
                  )}
                </div>
              </div>

              {isOwnProfile && (
                <Link
                  to={`/profile/${encodeURIComponent(
                    profile.username
                  )}/edit`}
                  className="inline-flex items-center justify-center rounded-xl bg-orange-500 px-5 py-3 text-sm font-black text-white shadow-[0_12px_30px_rgba(249,115,22,0.18)] transition hover:bg-orange-400 xl:mt-24"
                >
                  {tr(
                    "Редактировать профиль",
                    "Edit profile"
                  )}
                </Link>
              )}
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <MetricCard
                label={tr(
                  "Прогнозы",
                  "Predictions"
                )}
                value={votes.length}
                detail={tr(
                  "Всего сделано",
                  "Total submitted"
                )}
                accent
              />

              <MetricCard
                label={tr(
                  "Точность",
                  "Accuracy"
                )}
                value={
                  predictionAccuracy === null
                    ? "—"
                    : `${predictionAccuracy}%`
                }
                detail={tr(
                  "Завершённые матчи",
                  "Settled matches"
                )}
              />

              <MetricCard
                label={tr(
                  "Угадано",
                  "Correct"
                )}
                value={correctPredictions}
                detail={tr(
                  "Верных прогнозов",
                  "Winning picks"
                )}
              />

              <MetricCard
                label={tr(
                  "Комментарии",
                  "Comments"
                )}
                value={commentCount}
                detail={tr(
                  "Активность в матчах",
                  "Match activity"
                )}
              />

              <MetricCard
                label={tr(
                  "На платформе",
                  "Membership"
                )}
                value={membershipDays}
                detail={tr(
                  "Дней с регистрации",
                  "Days since joining"
                )}
              />
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
              <div className="grid gap-6">
                <section className="rounded-[26px] border border-white/[0.07] bg-[#0d141e] p-6">
                  <PanelTitle
                    eyebrow={tr("Профиль", "Profile")}
                    title={tr("О пользователе", "About")}
                  />

                  <p className="mt-6 text-sm leading-7 text-gray-300">
                    {profile.bio ||
                      tr(
                        "Пользователь пока ничего о себе не рассказал.",
                        "This user has not added a bio yet."
                      )}
                  </p>

                  <div className="mt-6 border-t border-white/[0.07] pt-5">
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-600">
                      {tr(
                        "Дата регистрации",
                        "Member since"
                      )}
                    </div>

                    <div className="mt-2 font-black text-white">
                      {formatDate(
                        profile.created_at,
                        language
                      )}
                    </div>
                  </div>
                </section>

                {hasBugHunterBadge && (
                  <section className="relative overflow-hidden rounded-[26px] border border-orange-400/20 bg-[#0d141e] p-6">
                    <div className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-orange-500/10 blur-3xl" />

                    <div className="relative">
                      <PanelTitle
                        eyebrow={tr(
                          "Особая награда",
                          "Special award"
                        )}
                        title={tr(
                          "Достижения",
                          "Achievements"
                        )}
                      />

                      <div className="mt-6 rounded-2xl border border-orange-400/20 bg-[linear-gradient(135deg,rgba(249,115,22,0.10),rgba(255,255,255,0.02))] p-5">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-orange-400/25 bg-orange-500/10 text-2xl">
                            🛠
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="text-lg font-black uppercase tracking-[0.14em] text-orange-300">
                              Bug Hunter
                            </div>

                            <p className="mt-2 text-sm leading-6 text-gray-300">
                              {tr(
                                "Выдано Lamp4x за найденные баги и большую помощь в улучшении платформы.",
                                "Awarded to Lamp4x for finding bugs and providing major help improving the platform."
                              )}
                            </p>
                          </div>

                          <div className="shrink-0 text-2xl font-black text-orange-400">
                            ✓
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>
                )}

                <section className="rounded-[26px] border border-white/[0.07] bg-[#0d141e] p-6">
                  <PanelTitle
                    eyebrow={tr(
                      "Поддержка",
                      "Support"
                    )}
                    title={tr(
                      "Любимая команда",
                      "Favorite team"
                    )}
                  />

                  {favoriteTeam ? (
                    <Link
                      to={`/team/${favoriteTeam.slug}`}
                      className="group mt-6 flex items-center gap-4 rounded-2xl border border-white/[0.07] bg-black/15 p-4 transition hover:border-orange-400/30 hover:bg-orange-500/[0.04]"
                    >
                      <TeamMark
                        team={favoriteTeam}
                      />

                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xl font-black text-white">
                          {favoriteTeam.name}
                        </div>

                        <div className="mt-1 text-xs text-gray-500">
                          {tr(
                            "Открыть страницу команды",
                            "Open team page"
                          )}
                        </div>
                      </div>

                      <div className="text-orange-400 transition group-hover:translate-x-1">
                        →
                      </div>
                    </Link>
                  ) : (
                    <div className="mt-6">
                      <EmptyState
                        title={tr(
                          "Команда не выбрана",
                          "No favorite team"
                        )}
                        text={tr(
                          "Любимую команду можно указать в настройках профиля.",
                          "You can choose a favorite team in profile settings."
                        )}
                      />
                    </div>
                  )}
                </section>
              </div>

              <ProfessionalPanel
                profile={profile}
                team={profileTeam}
                isOwnProfile={isOwnProfile}
                tr={tr}
                language={language}
              />
            </div>

            <section className="mt-6 overflow-hidden rounded-[26px] border border-white/[0.07] bg-[#0d141e]">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.07] px-6 py-5">
                <PanelTitle
                  eyebrow={tr(
                    "Активность",
                    "Activity"
                  )}
                  title={tr(
                    "Последние комментарии",
                    "Latest comments"
                  )}
                />

                <div className="text-xs font-black text-gray-600">
                  {commentCount}{" "}
                  {tr(
                    "всего",
                    "total"
                  )}
                </div>
              </div>

              {comments.length === 0 ? (
                <div className="p-8">
                  <EmptyState
                    title={tr(
                      "Комментариев пока нет",
                      "No comments yet"
                    )}
                    text={tr(
                      "Здесь появится последняя активность пользователя в матчах.",
                      "The user's latest match activity will appear here."
                    )}
                  />
                </div>
              ) : (
                <div className="divide-y divide-white/[0.06]">
                  {comments.map(
                    (comment) => (
                      <Link
                        key={comment.id}
                        to={`/match/${comment.match_id}`}
                        className="group grid gap-4 px-6 py-5 transition hover:bg-white/[0.025] md:grid-cols-[190px_minmax(0,1fr)_auto] md:items-center"
                      >
                        <div>
                          <div className="text-xs font-black uppercase tracking-[0.16em] text-orange-400">
                            {tr(
                              "Комментарий к матчу",
                              "Match comment"
                            )}
                          </div>

                          <div className="mt-2 text-xs text-gray-600">
                            {formatDateTime(
                              comment.created_at,
                              language
                            )}
                          </div>
                        </div>

                        <p className="line-clamp-2 text-sm leading-6 text-gray-300">
                          {comment.body}
                        </p>

                        <div className="text-sm font-black text-orange-400 transition group-hover:translate-x-1">
                          →
                        </div>
                      </Link>
                    )
                  )}
                </div>
              )}
            </section>

            {isOwnProfile &&
              currentProfile?.username !==
                profile.username && (
                <div className="mt-6 rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-4 text-sm text-yellow-300">
                  {tr(
                    "Данные профиля в текущей сессии ещё не обновлены. Обновите страницу.",
                    "Profile data has not updated in the current session yet. Refresh the page."
                  )}
                </div>
              )}
          </div>
        </section>
      </div>
    </main>
  );
}