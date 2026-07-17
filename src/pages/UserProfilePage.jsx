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
import teams from "../data/teams";

const FINISHED_STATUSES = new Set([
  "FINISHED",
  "MATCH_STATUS_FINISHED",
]);

const ACCOUNT_TYPE_LABELS = {
  fan: "Фанат",
  player: "Игрок",
  staff: "Team Staff",
};

const TEAM_ROLE_LABELS = {
  player: "Player",
  coach: "Coach",
  manager: "Manager",
  analyst: "Analyst",
};

const VERIFICATION_LABELS = {
  verified: "Подтверждено",
  pending: "Ожидает проверки",
  rejected: "Заявка отклонена",
  none: "Не подтверждено",
};

function formatDate(value) {
  if (!value) return "Неизвестно";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Неизвестно";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
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

function SectionTitle({
  icon,
  children,
  action,
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <span className="text-lg text-orange-400">
          {icon}
        </span>

        <h2 className="text-sm font-black uppercase tracking-[0.14em] text-orange-400">
          {children}
        </h2>
      </div>

      {action}
    </div>
  );
}

function TeamLogo({
  team,
  className = "h-16 w-16",
}) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#29384a] bg-[#080d14] p-2 ${className}`}
    >
      {team?.logo ? (
        <img
          src={team.logo}
          alt={team.name}
          className="h-full w-full object-contain"
        />
      ) : (
        <span className="text-xl font-black text-orange-400">
          {team?.name
            ?.slice(0, 2)
            .toUpperCase() || "TM"}
        </span>
      )}
    </div>
  );
}

function VerificationBadge({ status }) {
  const styles = {
    verified:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    pending:
      "border-amber-500/30 bg-amber-500/10 text-amber-300",
    rejected:
      "border-red-500/30 bg-red-500/10 text-red-300",
    none:
      "border-gray-500/20 bg-gray-500/10 text-gray-400",
  };

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-black ${
        styles[status] || styles.none
      }`}
    >
      <span className="text-sm">
        {status === "verified"
          ? "✓"
          : status === "pending"
            ? "◷"
            : status === "rejected"
              ? "×"
              : "○"}
      </span>

      {VERIFICATION_LABELS[status] ||
        VERIFICATION_LABELS.none}
    </span>
  );
}

function StatItem({
  icon,
  value,
  label,
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center justify-center gap-4 px-4 py-4">
      <div className="text-3xl text-orange-400">
        {icon}
      </div>

      <div>
        <div className="text-3xl font-black tracking-tight text-white">
          {value}
        </div>

        <div className="mt-1 text-xs text-gray-400">
          {label}
        </div>
      </div>
    </div>
  );
}

function ProfessionalCard({
  profile,
  team,
  isOwnProfile,
}) {
  if (
    profile.account_type === "fan" ||
    !team
  ) {
    return (
      <section className="rounded-3xl border border-[#243244] bg-[#0f1722] p-6">
        <SectionTitle icon="▣">
          Профессиональный профиль
        </SectionTitle>

        <div className="mt-7 flex min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-[#2b394b] bg-[#0a1018] px-6 text-center">
          <div className="text-3xl text-gray-700">
            ◇
          </div>

          <div className="mt-4 font-black text-white">
            Профессиональный статус не указан
          </div>

          <p className="mt-2 max-w-md text-sm leading-6 text-gray-500">
            Игроки, тренеры, менеджеры и аналитики могут отправить заявку на подтверждение команды.
          </p>

          {isOwnProfile && (
            <Link
              to={`/profile/${encodeURIComponent(
                profile.username
              )}/verification`}
              className="mt-5 rounded-xl border border-orange-500/30 bg-orange-500/10 px-4 py-2.5 text-sm font-black text-orange-300 transition hover:bg-orange-500 hover:text-white"
            >
              Пройти верификацию
            </Link>
          )}
        </div>
      </section>
    );
  }

  const role =
    TEAM_ROLE_LABELS[profile.team_role] ||
    "Роль не указана";

  const accountType =
    ACCOUNT_TYPE_LABELS[
      profile.account_type
    ] || "Профессиональный аккаунт";

  return (
    <section className="relative overflow-hidden rounded-3xl border border-[#243244] bg-[#0f1722] p-6">
      <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-orange-500/[0.06] blur-3xl" />

      <div className="relative">
        <SectionTitle
          icon="▣"
          action={
            <VerificationBadge
              status={
                profile.verification_status
              }
            />
          }
        >
          Профессиональный профиль
        </SectionTitle>

        <div className="mt-7 grid gap-7 md:grid-cols-[140px_1fr]">
          <div className="flex items-start justify-center">
            <Link
              to={`/team/${team.slug}`}
              className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-full border-2 border-orange-500/50 bg-[#070c12] p-5 shadow-[0_0_35px_rgba(249,115,22,0.08)] transition hover:scale-[1.02]"
            >
              {team.logo ? (
                <img
                  src={team.logo}
                  alt={team.name}
                  className="h-full w-full object-contain"
                />
              ) : (
                <span className="text-4xl font-black text-orange-400">
                  {team.name
                    .slice(0, 2)
                    .toUpperCase()}
                </span>
              )}
            </Link>
          </div>

          <div className="min-w-0">
            <Link
              to={`/team/${team.slug}`}
              className="text-3xl font-black tracking-tight text-white transition hover:text-orange-400"
            >
              {team.name}
            </Link>

            <div className="mt-2 flex items-center gap-2 text-sm text-orange-300">
              <span>♙</span>
              <span className="font-bold">
                {role}
              </span>
            </div>

            <p className="mt-4 max-w-xl text-sm leading-6 text-gray-400">
              {profile.verification_status ===
              "verified"
                ? "Командная принадлежность и роль подтверждены администрацией ESEA Tracker."
                : profile.verification_status ===
                    "pending"
                  ? "Заявка отправлена на проверку. Мы проверим данные и обновим статус профиля."
                  : profile.verification_status ===
                      "rejected"
                    ? "Заявка не прошла проверку. Обновите информацию и отправьте её повторно."
                    : "Командная принадлежность пока не подтверждена."}
            </p>

            <div className="mt-7 grid gap-4 border-t border-[#233044] pt-5 sm:grid-cols-2">
              <div>
                <div className="text-xs text-gray-600">
                  Тип аккаунта
                </div>

                <div className="mt-1 font-black text-orange-400">
                  {accountType}
                </div>
              </div>

              <div>
                <div className="text-xs text-gray-600">
                  Роль
                </div>

                <div className="mt-1 font-black text-orange-400">
                  {role}
                </div>
              </div>
            </div>

            {isOwnProfile &&
              profile.verification_status !==
                "verified" && (
                <Link
                  to={`/profile/${encodeURIComponent(
                    profile.username
                  )}/verification`}
                  className="mt-6 inline-flex rounded-xl border border-orange-500/30 bg-orange-500/10 px-5 py-2.5 text-sm font-black text-orange-300 transition hover:bg-orange-500 hover:text-white"
                >
                  {profile.verification_status ===
                  "pending"
                    ? "Посмотреть заявку"
                    : profile.verification_status ===
                        "rejected"
                      ? "Отправить повторно"
                      : "Пройти верификацию"}
                </Link>
              )}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function UserProfilePage() {
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
            .eq(
              "user_id",
              loadedProfile.id
            )
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
            .eq(
              "user_id",
              loadedProfile.id
            ),

          supabase
            .from("match_votes")
            .select(`
              match_id,
              team_id,
              created_at
            `)
            .eq(
              "user_id",
              loadedProfile.id
            )
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
          Array.isArray(
            votesResponse.data
          )
            ? votesResponse.data
            : [];

        const matchIds = [
          ...new Set(
            loadedVotes
              .map(
                (vote) =>
                  vote.match_id
              )
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
          Array.isArray(
            commentsResponse.data
          )
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
          "Не удалось загрузить профиль."
        );
      } finally {
        setLoading(false);
      }
    }, [username]);

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
      Number.isNaN(
        createdAt.getTime()
      )
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
      <main className="min-h-screen bg-[#080d14] px-4 py-12 text-white">
        <div className="mx-auto max-w-7xl text-center text-gray-500">
          Загрузка профиля...
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-[#080d14] px-4 py-12 text-white">
        <div className="mx-auto max-w-3xl rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-center text-red-300">
          {error}
        </div>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="min-h-screen bg-[#080d14] px-4 py-12 text-white">
        <div className="mx-auto max-w-3xl rounded-3xl border border-[#243041] bg-[#0f1722] p-8 text-center">
          <h1 className="text-3xl font-black">
            Профиль не найден
          </h1>

          <p className="mt-2 text-gray-500">
            Пользователь @{username} не существует.
          </p>

          <Link
            to="/"
            className="mt-6 inline-flex rounded-xl bg-orange-500 px-5 py-3 font-black transition hover:bg-orange-400"
          >
            На главную
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#080d14] px-4 py-7 text-white md:px-8 md:py-10">
      <div className="mx-auto max-w-[1320px]">
        <section className="overflow-hidden rounded-[30px] border border-[#263548] bg-[#0b121c] shadow-[0_26px_90px_rgba(0,0,0,0.32)]">
          <div className="relative h-40 overflow-hidden bg-[linear-gradient(105deg,#8d3510_0%,#4b2117_31%,#26191a_58%,#101925_100%)] md:h-48">
            <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_center,white_1px,transparent_1px)] [background-size:18px_18px]" />
            <div className="absolute right-0 top-0 h-full w-1/3 bg-gradient-to-l from-[#101925] to-transparent" />
            <div className="absolute -right-12 top-2 text-[120px] font-black italic tracking-tight text-white/[0.025] md:text-[170px]">
              ESEA
            </div>
          </div>

          <div className="px-5 pb-7 md:px-7">
            <div className="-mt-16 grid gap-6 lg:grid-cols-[180px_1fr_auto] lg:items-start">
              <div className="relative z-10">
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.username}
                    className="h-36 w-36 rounded-[28px] border-4 border-[#0b121c] bg-[#080d14] object-cover shadow-2xl md:h-40 md:w-40"
                  />
                ) : (
                  <div className="flex h-36 w-36 items-center justify-center rounded-[28px] border-4 border-[#0b121c] bg-[#080d14] text-5xl font-black text-orange-400 shadow-2xl md:h-40 md:w-40">
                    {getInitials(profile)}
                  </div>
                )}

                {profile.verification_status ===
                  "verified" && (
                  <div className="absolute -bottom-2 right-3 flex h-9 w-9 items-center justify-center rounded-full border-4 border-[#0b121c] bg-emerald-400 font-black text-[#07120d]">
                    ✓
                  </div>
                )}
              </div>

              <div className="min-w-0 pb-1 lg:pt-20 lg:pb-2">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="truncate text-4xl font-black tracking-[-0.035em] text-white md:text-5xl">
                    {profile.display_name ||
                      profile.username}
                  </h1>

                  {profile.country_code && (
                    <span
                      title={profile.country_code}
                      className="text-xl font-black text-white"
                    >
                      {countryFlag(
                        profile.country_code
                      )}{" "}
                      {profile.country_code}
                    </span>
                  )}
                </div>

                <div className="mt-2 text-base font-bold text-gray-300">
                  @{profile.username}
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-gray-400">
                  <span>
                    ▣ На платформе с{" "}
                    {formatDate(
                      profile.created_at
                    )}
                  </span>

                  <span className="text-gray-700">
                    •
                  </span>

                  <span>
                    ♙{" "}
                    {ACCOUNT_TYPE_LABELS[
                      profile.account_type
                    ] || "Пользователь"}
                  </span>
                </div>
              </div>

              {isOwnProfile && (
                <Link
                  to={`/profile/${encodeURIComponent(
                    profile.username
                  )}/edit`}
                  className="mb-1 inline-flex items-center justify-center rounded-xl border border-orange-500/60 bg-orange-500/[0.06] px-6 py-3.5 text-sm font-black text-orange-300 transition hover:bg-orange-500 hover:text-white lg:mt-20"
                >
                  Редактировать профиль
                </Link>
              )}
            </div>

            <div className="mt-7 grid gap-6 xl:grid-cols-[0.75fr_1.25fr]">
              <div className="grid gap-5">
                <section className="rounded-3xl border border-[#243244] bg-[#0f1722] p-6">
                  <SectionTitle icon="♙">
                    О пользователе
                  </SectionTitle>

                  <p className="mt-7 min-h-10 text-sm leading-7 text-gray-200">
                    {profile.bio ||
                      "Пользователь пока ничего о себе не рассказал."}
                  </p>
                </section>

                <section className="rounded-3xl border border-[#243244] bg-[#0f1722] p-6">
                  <SectionTitle icon="☆">
                    Любимая команда
                  </SectionTitle>

                  {favoriteTeam ? (
                    <Link
                      to={`/team/${favoriteTeam.slug}`}
                      className="mt-6 flex items-center gap-5 rounded-2xl border border-[#2a394c] bg-[#0a1018] p-4 transition hover:border-orange-500/40"
                    >
                      <TeamLogo
                        team={favoriteTeam}
                        className="h-16 w-16"
                      />

                      <div className="min-w-0">
                        <div className="truncate text-xl font-black text-white">
                          {favoriteTeam.name}
                        </div>

                        <div className="mt-2 text-sm text-gray-500">
                          Открыть страницу команды ↗
                        </div>
                      </div>
                    </Link>
                  ) : (
                    <div className="mt-6 rounded-2xl border border-dashed border-[#2a394c] p-6 text-sm text-gray-500">
                      Любимая команда не выбрана.
                    </div>
                  )}
                </section>
              </div>

              <ProfessionalCard
                profile={profile}
                team={profileTeam}
                isOwnProfile={isOwnProfile}
              />
            </div>

            <section className="mt-6 overflow-hidden rounded-3xl border border-[#243244] bg-[#0d1520]">
              <div className="grid divide-y divide-[#263548] sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-5">
                <StatItem
                  icon="⌾"
                  value={votes.length}
                  label="Прогнозов сделано"
                />

                <StatItem
                  icon="↗"
                  value={
                    predictionAccuracy === null
                      ? "—"
                      : `${predictionAccuracy}%`
                  }
                  label="Точность прогнозов"
                />

                <StatItem
                  icon="♕"
                  value={correctPredictions}
                  label="Выигранных прогнозов"
                />

                <StatItem
                  icon="▢"
                  value={commentCount}
                  label="Комментариев"
                />

                <StatItem
                  icon="▣"
                  value={membershipDays}
                  label="Дней на сайте"
                />
              </div>
            </section>

            <section className="mt-6 overflow-hidden rounded-3xl border border-[#243244] bg-[#0f1722]">
              <div className="border-b border-[#243244] px-6 py-5">
                <SectionTitle icon="▢">
                  Последние комментарии
                </SectionTitle>
              </div>

              {comments.length === 0 ? (
                <div className="p-10 text-center text-gray-500">
                  Пользователь пока не оставлял комментариев.
                </div>
              ) : (
                <div className="divide-y divide-[#233044]">
                  {comments.map(
                    (comment) => (
                      <Link
                        key={comment.id}
                        to={`/matches/${comment.match_id}`}
                        className="group grid gap-4 px-6 py-5 transition hover:bg-white/[0.025] md:grid-cols-[210px_1fr_auto] md:items-center"
                      >
                        <div>
                          <div className="font-black text-white">
                            Матч #{comment.match_id}
                          </div>

                          <div className="mt-1 text-xs text-gray-500">
                            {formatDateTime(
                              comment.created_at
                            )}
                          </div>
                        </div>

                        <p className="line-clamp-2 text-sm leading-6 text-gray-300">
                          {comment.body}
                        </p>

                        <div className="text-sm font-black text-orange-400 transition group-hover:translate-x-1">
                          Открыть →
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
                  Данные профиля в контексте ещё не обновлены. Обновите страницу.
                </div>
              )}
          </div>
        </section>
      </div>
    </main>
  );
}