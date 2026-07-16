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

function formatDate(value) {
  if (!value) return "Unknown";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
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

function StatCard({
  label,
  value,
  hint,
}) {
  return (
    <div className="rounded-2xl border border-[#243041] bg-[#111823] p-5">
      <div className="text-sm text-gray-500">
        {label}
      </div>

      <div className="mt-2 text-3xl font-black text-white">
        {value}
      </div>

      {hint && (
        <div className="mt-1 text-xs text-gray-500">
          {hint}
        </div>
      )}
    </div>
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
  const [commentCount, setCommentCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadProfileData = useCallback(async () => {
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

  const isOwnProfile =
    Boolean(
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
      settledPredictions.filter((vote) => {
        const match = matchById.get(
          String(vote.match_id)
        );

        return (
          getWinnerTeamId(match) ===
          String(vote.team_id)
        );
      }).length,
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

  if (loading || authLoading) {
    return (
      <main className="min-h-screen bg-[#0b0f14] px-4 py-12 text-white">
        <div className="mx-auto max-w-6xl text-center text-gray-500">
          Загрузка профиля...
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-[#0b0f14] px-4 py-12 text-white">
        <div className="mx-auto max-w-3xl rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-center text-red-300">
          {error}
        </div>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="min-h-screen bg-[#0b0f14] px-4 py-12 text-white">
        <div className="mx-auto max-w-3xl rounded-2xl border border-[#243041] bg-[#111823] p-8 text-center">
          <h1 className="text-3xl font-black">
            Профиль не найден
          </h1>

          <p className="mt-2 text-gray-500">
            Пользователь @{username} не существует.
          </p>

          <Link
            to="/"
            className="mt-6 inline-flex rounded-xl bg-orange-500 px-5 py-3 font-black transition hover:bg-orange-600"
          >
            На главную
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0b0f14] px-4 py-8 text-white md:px-8 md:py-12">
      <div className="mx-auto max-w-6xl">
        <section className="overflow-hidden rounded-3xl border border-[#243041] bg-[#111823]">
          <div className="h-28 bg-gradient-to-r from-orange-500/25 via-orange-500/10 to-transparent md:h-36" />

          <div className="px-5 pb-6 md:px-8 md:pb-8">
            <div className="-mt-14 flex flex-col gap-6 md:-mt-16 md:flex-row md:items-end md:justify-between">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.username}
                    className="h-28 w-28 rounded-3xl border-4 border-[#111823] bg-[#0b0f14] object-cover shadow-2xl md:h-32 md:w-32"
                  />
                ) : (
                  <div className="flex h-28 w-28 items-center justify-center rounded-3xl border-4 border-[#111823] bg-[#0b0f14] text-4xl font-black text-orange-400 shadow-2xl md:h-32 md:w-32">
                    {getInitials(profile)}
                  </div>
                )}

                <div className="pb-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-3xl font-black md:text-4xl">
                      {profile.display_name ||
                        profile.username}
                    </h1>

                    {profile.country_code && (
                      <span
                        title={profile.country_code}
                        className="text-2xl"
                      >
                        {countryFlag(
                          profile.country_code
                        )}
                      </span>
                    )}
                  </div>

                  <div className="mt-1 text-gray-400">
                    @{profile.username}
                  </div>

                  <div className="mt-2 text-sm text-gray-500">
                    Зарегистрирован{" "}
                    {formatDate(
                      profile.created_at
                    )}
                  </div>
                </div>
              </div>

              {isOwnProfile && (
                <Link
                  to={`/profile/${encodeURIComponent(
                    profile.username
                  )}/edit`}
                  className="inline-flex items-center justify-center rounded-xl border border-orange-500/40 bg-orange-500/10 px-5 py-3 font-black text-orange-400 transition hover:bg-orange-500 hover:text-white"
                >
                  Редактировать профиль
                </Link>
              )}
            </div>

            {profile.bio && (
              <p className="mt-6 max-w-3xl whitespace-pre-wrap text-sm leading-6 text-gray-300">
                {profile.bio}
              </p>
            )}

            {favoriteTeam && (
              <div className="mt-6 inline-flex items-center gap-3 rounded-2xl border border-[#243041] bg-[#0b0f14] px-4 py-3">
                {favoriteTeam.logo && (
                  <img
                    src={favoriteTeam.logo}
                    alt={favoriteTeam.name}
                    className="h-9 w-9 object-contain"
                  />
                )}

                <div>
                  <div className="text-xs text-gray-500">
                    Любимая команда
                  </div>

                  <Link
                    to={`/team/${favoriteTeam.slug}`}
                    className="font-black transition-colors hover:text-orange-400"
                  >
                    {favoriteTeam.name}
                  </Link>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Комментарии"
            value={commentCount}
          />

          <StatCard
            label="Прогнозы"
            value={votes.length}
          />

          <StatCard
            label="Точные прогнозы"
            value={correctPredictions}
            hint={`${settledPredictions.length} завершённых матчей`}
          />

          <StatCard
            label="Точность"
            value={
              predictionAccuracy === null
                ? "—"
                : `${predictionAccuracy}%`
            }
            hint="Только завершённые матчи"
          />
        </section>

        <section className="mt-8 overflow-hidden rounded-2xl border border-[#243041] bg-[#111823]">
          <div className="border-b border-[#243041] px-5 py-4">
            <h2 className="text-2xl font-black">
              Последние комментарии
            </h2>
          </div>

          {comments.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              Пользователь пока не оставлял комментариев.
            </div>
          ) : (
            <div>
              {comments.map((comment) => (
                <Link
                  key={comment.id}
                  to={`/matches/${comment.match_id}`}
                  className="block border-b border-[#1d2634] px-5 py-4 transition-colors last:border-b-0 hover:bg-[#151e2b]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm font-black text-orange-400">
                      Открыть матч
                    </div>

                    <div className="text-xs text-gray-500">
                      {formatDateTime(
                        comment.created_at
                      )}
                    </div>
                  </div>

                  <p className="mt-3 line-clamp-3 whitespace-pre-wrap break-words text-sm leading-6 text-gray-300">
                    {comment.body}
                  </p>
                </Link>
              ))}
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
    </main>
  );
}