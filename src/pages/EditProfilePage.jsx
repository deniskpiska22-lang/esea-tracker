import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Link,
  Navigate,
  useNavigate,
  useParams,
} from "react-router-dom";

import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import teams from "../data/teams";

export default function EditProfilePage() {
  const { username } = useParams();
  const navigate = useNavigate();

  const {
    user,
    profile,
    loading,
    refreshProfile,
  } = useAuth();

  const [displayName, setDisplayName] =
    useState("");
  const [bio, setBio] = useState("");
  const [countryCode, setCountryCode] =
    useState("");
  const [
    favoriteTeamSlug,
    setFavoriteTeamSlug,
  ] = useState("");
  const [avatarUrl, setAvatarUrl] =
    useState("");
  const [saving, setSaving] =
    useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] =
    useState("");

  const normalizedUsername =
    String(username || "").toLowerCase();

  const ownsProfile =
    Boolean(
      user?.id &&
      profile?.id &&
      user.id === profile.id &&
      String(
        profile.username || ""
      ).toLowerCase() === normalizedUsername
    );

  useEffect(() => {
    if (!profile) return;

    setDisplayName(
      profile.display_name || ""
    );
    setBio(profile.bio || "");
    setCountryCode(
      profile.country_code || ""
    );
    setFavoriteTeamSlug(
      profile.favorite_team_slug || ""
    );
    setAvatarUrl(
      profile.avatar_url || ""
    );
  }, [profile]);

  const sortedTeams = useMemo(
    () =>
      [...teams].sort((first, second) =>
        first.name.localeCompare(
          second.name
        )
      ),
    []
  );

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0b0f14] px-4 py-12 text-white">
        <div className="mx-auto max-w-3xl text-center text-gray-500">
          Загрузка...
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  if (!profile || !ownsProfile) {
    return (
      <main className="min-h-screen bg-[#0b0f14] px-4 py-12 text-white">
        <div className="mx-auto max-w-3xl rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-center text-red-300">
          У вас нет доступа к редактированию этого профиля.
        </div>
      </main>
    );
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const normalizedCountry =
      countryCode
        .trim()
        .toUpperCase();

    if (
      normalizedCountry &&
      !/^[A-Z]{2}$/.test(
        normalizedCountry
      )
    ) {
      setError(
        "Код страны должен состоять из двух латинских букв, например RU."
      );
      return;
    }

    if (bio.length > 300) {
      setError(
        "Описание не может быть длиннее 300 символов."
      );
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const { error: updateError } =
        await supabase
          .from("profiles")
          .update({
            display_name:
              displayName.trim() || null,
            bio:
              bio.trim() || null,
            country_code:
              normalizedCountry || null,
            favorite_team_slug:
              favoriteTeamSlug || null,
            avatar_url:
              avatarUrl.trim() || null,
            updated_at:
              new Date().toISOString(),
          })
          .eq("id", user.id);

      if (updateError) {
        throw updateError;
      }

      await refreshProfile();

      setSuccess(
        "Профиль сохранён."
      );

      window.setTimeout(() => {
        navigate(
          `/profile/${encodeURIComponent(
            profile.username
          )}`,
          {
            replace: true,
          }
        );
      }, 500);
    } catch (saveError) {
      console.error(
        "Failed to update profile:",
        saveError
      );

      setError(
        saveError.message ||
          "Не удалось сохранить профиль."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#0b0f14] px-4 py-8 text-white md:px-8 md:py-12">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6">
          <Link
            to={`/profile/${encodeURIComponent(
              profile.username
            )}`}
            className="text-sm font-bold text-orange-400 transition hover:text-orange-300"
          >
            ← Назад в профиль
          </Link>
        </div>

        <section className="overflow-hidden rounded-3xl border border-[#243041] bg-[#111823]">
          <div className="border-b border-[#243041] px-6 py-5">
            <h1 className="text-3xl font-black">
              Редактирование профиля
            </h1>

            <p className="mt-2 text-sm text-gray-500">
              @{profile.username}
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="space-y-6 p-6"
          >
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-gray-300">
                Отображаемое имя
              </span>

              <input
                value={displayName}
                onChange={(event) =>
                  setDisplayName(
                    event.target.value
                  )
                }
                maxLength={50}
                placeholder={profile.username}
                className="w-full rounded-xl border border-[#2b3748] bg-[#0b0f14] px-4 py-3 text-white outline-none transition placeholder:text-gray-600 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-bold text-gray-300">
                О себе
              </span>

              <textarea
                value={bio}
                onChange={(event) =>
                  setBio(
                    event.target.value.slice(
                      0,
                      300
                    )
                  )
                }
                rows={5}
                maxLength={300}
                placeholder="Расскажите немного о себе..."
                className="w-full resize-y rounded-xl border border-[#2b3748] bg-[#0b0f14] px-4 py-3 text-white outline-none transition placeholder:text-gray-600 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15"
              />

              <span className="mt-1 block text-right text-xs text-gray-500">
                {bio.length}/300
              </span>
            </label>

            <div className="grid gap-5 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-gray-300">
                  Код страны
                </span>

                <input
                  value={countryCode}
                  onChange={(event) =>
                    setCountryCode(
                      event.target.value
                        .replace(
                          /[^a-zA-Z]/g,
                          ""
                        )
                        .slice(0, 2)
                        .toUpperCase()
                    )
                  }
                  maxLength={2}
                  placeholder="RU"
                  className="w-full rounded-xl border border-[#2b3748] bg-[#0b0f14] px-4 py-3 uppercase text-white outline-none transition placeholder:text-gray-600 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-bold text-gray-300">
                  Любимая команда
                </span>

                <select
                  value={favoriteTeamSlug}
                  onChange={(event) =>
                    setFavoriteTeamSlug(
                      event.target.value
                    )
                  }
                  className="w-full rounded-xl border border-[#2b3748] bg-[#0b0f14] px-4 py-3 text-white outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15"
                >
                  <option value="">
                    Не выбрана
                  </option>

                  {sortedTeams.map((team) => (
                    <option
                      key={team.slug}
                      value={team.slug}
                    >
                      {team.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block">
              <span className="mb-2 block text-sm font-bold text-gray-300">
                Ссылка на аватар
              </span>

              <input
                type="url"
                value={avatarUrl}
                onChange={(event) =>
                  setAvatarUrl(
                    event.target.value
                  )
                }
                placeholder="https://example.com/avatar.jpg"
                className="w-full rounded-xl border border-[#2b3748] bg-[#0b0f14] px-4 py-3 text-white outline-none transition placeholder:text-gray-600 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15"
              />

              <span className="mt-2 block text-xs text-gray-500">
                Загрузку файлов через Supabase Storage добавим следующим шагом.
              </span>
            </label>

            {avatarUrl && (
              <div className="flex items-center gap-4 rounded-2xl border border-[#243041] bg-[#0b0f14] p-4">
                <img
                  src={avatarUrl}
                  alt=""
                  className="h-16 w-16 rounded-2xl object-cover"
                  onError={(event) => {
                    event.currentTarget.style.display =
                      "none";
                  }}
                />

                <div>
                  <div className="font-bold">
                    Предпросмотр
                  </div>

                  <div className="text-sm text-gray-500">
                    Так будет выглядеть аватар.
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}

            {success && (
              <div className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-300">
                {success}
              </div>
            )}

            <div className="flex flex-wrap justify-end gap-3">
              <Link
                to={`/profile/${encodeURIComponent(
                  profile.username
                )}`}
                className="rounded-xl border border-[#2b3748] px-5 py-3 font-bold text-gray-300 transition hover:bg-white/5"
              >
                Отмена
              </Link>

              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-orange-500 px-6 py-3 font-black text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving
                  ? "Сохранение..."
                  : "Сохранить"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}