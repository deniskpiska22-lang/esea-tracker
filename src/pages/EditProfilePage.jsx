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

function getInitials(profile, displayName) {
  const source =
    displayName ||
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

function SectionHeader({
  eyebrow,
  title,
  description,
}) {
  return (
    <div className="border-b border-[#243244] px-5 py-5 md:px-6">
      <div className="text-[11px] font-black uppercase tracking-[0.2em] text-orange-400">
        {eyebrow}
      </div>

      <h2 className="mt-2 text-xl font-black tracking-tight text-white">
        {title}
      </h2>

      {description && (
        <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
          {description}
        </p>
      )}
    </div>
  );
}

function FieldLabel({
  title,
  hint,
}) {
  return (
    <div className="mb-2">
      <div className="text-sm font-black text-gray-200">
        {title}
      </div>

      {hint && (
        <div className="mt-1 text-xs text-gray-600">
          {hint}
        </div>
      )}
    </div>
  );
}

const STATUS_META = {
  verified: {
    label: "Подтверждено",
    classes:
      "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
  },
  pending: {
    label: "Ожидает проверки",
    classes:
      "border-amber-500/25 bg-amber-500/10 text-amber-300",
  },
  rejected: {
    label: "Заявка отклонена",
    classes:
      "border-red-500/25 bg-red-500/10 text-red-300",
  },
  none: {
    label: "Не подтверждено",
    classes:
      "border-gray-500/20 bg-gray-500/10 text-gray-400",
  },
};

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
  const [avatarBroken, setAvatarBroken] =
    useState(false);
  const [saving, setSaving] =
    useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] =
    useState("");

  const normalizedUsername =
    String(username || "").toLowerCase();

  const ownsProfile = Boolean(
    user?.id &&
      profile?.id &&
      user.id === profile.id &&
      String(
        profile.username || ""
      ).toLowerCase() ===
        normalizedUsername
  );

  useEffect(() => {
    if (!profile) {
      return;
    }

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
    setAvatarBroken(false);
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

  const favoriteTeam = useMemo(
    () =>
      sortedTeams.find(
        (team) =>
          team.slug ===
          favoriteTeamSlug
      ) || null,
    [favoriteTeamSlug, sortedTeams]
  );

  const verificationStatus =
    profile?.verification_status || "none";

  const statusMeta =
    STATUS_META[verificationStatus] ||
    STATUS_META.none;

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
        "Профиль успешно сохранён."
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
      }, 650);
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

  if (loading) {
    return (
      <main className="min-h-screen bg-[#080d14] px-4 py-12 text-white">
        <div className="mx-auto max-w-7xl text-center text-gray-500">
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
      <main className="min-h-screen bg-[#080d14] px-4 py-12 text-white">
        <div className="mx-auto max-w-3xl rounded-3xl border border-red-500/20 bg-red-500/10 p-6 text-center text-red-300">
          У вас нет доступа к редактированию этого профиля.
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#080d14] px-4 py-7 text-white md:px-8 md:py-10">
      <div className="mx-auto max-w-[1320px]">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <Link
            to={`/profile/${encodeURIComponent(
              profile.username
            )}`}
            className="inline-flex items-center gap-2 text-sm font-black text-orange-400 transition hover:text-orange-300"
          >
            <span>←</span>
            Назад в профиль
          </Link>

          <div className="text-sm text-gray-600">
            Редактирование @{profile.username}
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]"
        >
          <div className="space-y-6">
            <section className="overflow-hidden rounded-[30px] border border-[#263548] bg-[#0f1722]">
              <div className="relative overflow-hidden border-b border-[#243244] bg-[linear-gradient(110deg,#7b2f12_0%,#3d2019_42%,#101925_100%)] px-6 py-8">
                <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_center,white_1px,transparent_1px)] [background-size:18px_18px]" />

                <div className="relative">
                  <div className="text-[11px] font-black uppercase tracking-[0.2em] text-orange-300">
                    Profile editor
                  </div>

                  <h1 className="mt-3 text-3xl font-black tracking-tight md:text-4xl">
                    Настройте профиль
                  </h1>

                  <p className="mt-3 max-w-2xl text-sm leading-6 text-orange-50/60">
                    Здесь редактируются только личные данные. Команда и роль подтверждаются через отдельную заявку.
                  </p>
                </div>
              </div>

              <div className="grid gap-5 p-5 md:grid-cols-2 md:p-6">
                <label className="block">
                  <FieldLabel
                    title="Отображаемое имя"
                    hint="До 50 символов"
                  />

                  <input
                    value={displayName}
                    onChange={(event) =>
                      setDisplayName(
                        event.target.value
                      )
                    }
                    maxLength={50}
                    placeholder={
                      profile.username
                    }
                    className="w-full rounded-2xl border border-[#2b394b] bg-[#0a1018] px-4 py-3.5 text-white outline-none transition placeholder:text-gray-700 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15"
                  />
                </label>

                <label className="block">
                  <FieldLabel
                    title="Код страны"
                    hint="Например RU, UA, KZ"
                  />

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
                    className="w-full rounded-2xl border border-[#2b394b] bg-[#0a1018] px-4 py-3.5 uppercase text-white outline-none transition placeholder:text-gray-700 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15"
                  />
                </label>

                <label className="block md:col-span-2">
                  <FieldLabel
                    title="О себе"
                    hint="Коротко расскажите о себе"
                  />

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
                    rows={6}
                    maxLength={300}
                    placeholder="Расскажите о себе, своём опыте и интересах..."
                    className="w-full resize-y rounded-2xl border border-[#2b394b] bg-[#0a1018] px-4 py-3.5 text-white outline-none transition placeholder:text-gray-700 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15"
                  />

                  <div className="mt-2 text-right text-xs font-semibold text-gray-600">
                    {bio.length}/300
                  </div>
                </label>
              </div>
            </section>

            <section className="overflow-hidden rounded-[30px] border border-[#263548] bg-[#0f1722]">
              <SectionHeader
                eyebrow="Preferences"
                title="Персональные настройки"
                description="Выберите любимую команду и настройте внешний вид профиля."
              />

              <div className="grid gap-5 p-5 md:grid-cols-2 md:p-6">
                <label className="block">
                  <FieldLabel
                    title="Любимая команда"
                    hint="Показывается в профиле"
                  />

                  <select
                    value={
                      favoriteTeamSlug
                    }
                    onChange={(event) =>
                      setFavoriteTeamSlug(
                        event.target.value
                      )
                    }
                    className="w-full rounded-2xl border border-[#2b394b] bg-[#0a1018] px-4 py-3.5 text-white outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15"
                  >
                    <option value="">
                      Не выбрана
                    </option>

                    {sortedTeams.map(
                      (team) => (
                        <option
                          key={team.slug}
                          value={team.slug}
                        >
                          {team.name}
                        </option>
                      )
                    )}
                  </select>
                </label>

                <label className="block">
                  <FieldLabel
                    title="Ссылка на аватар"
                    hint="Прямая ссылка на изображение"
                  />

                  <input
                    type="url"
                    value={avatarUrl}
                    onChange={(event) => {
                      setAvatarUrl(
                        event.target.value
                      );
                      setAvatarBroken(false);
                    }}
                    placeholder="https://example.com/avatar.jpg"
                    className="w-full rounded-2xl border border-[#2b394b] bg-[#0a1018] px-4 py-3.5 text-white outline-none transition placeholder:text-gray-700 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15"
                  />
                </label>
              </div>
            </section>

            <section className="overflow-hidden rounded-[30px] border border-[#263548] bg-[#0f1722]">
              <SectionHeader
                eyebrow="Professional verification"
                title="Профессиональный профиль"
                description="Команду, роль и статус нельзя менять вручную. Они обновляются после проверки заявки администратором."
              />

              <div className="p-5 md:p-6">
                <div
                  className={`rounded-2xl border p-4 ${statusMeta.classes}`}
                >
                  <div className="font-black">
                    {statusMeta.label}
                  </div>

                  <p className="mt-2 text-sm opacity-80">
                    {verificationStatus ===
                    "verified"
                      ? "Команда и роль подтверждены администрацией."
                      : verificationStatus ===
                          "pending"
                        ? "Ваша заявка находится на проверке."
                        : verificationStatus ===
                            "rejected"
                          ? "Заявку можно исправить и отправить повторно."
                          : "Отправьте заявку, чтобы подтвердить связь с командой."}
                  </p>
                </div>

                {verificationStatus !==
                  "verified" && (
                  <Link
                    to={`/profile/${encodeURIComponent(
                      profile.username
                    )}/verification`}
                    className="mt-4 inline-flex rounded-2xl bg-orange-500 px-5 py-3 font-black text-white transition hover:bg-orange-400"
                  >
                    {verificationStatus ===
                    "pending"
                      ? "Посмотреть заявку"
                      : verificationStatus ===
                          "rejected"
                        ? "Отправить повторно"
                        : "Пройти верификацию"}
                  </Link>
                )}
              </div>
            </section>

            {error && (
              <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}

            {success && (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
                {success}
              </div>
            )}
          </div>

          <aside className="space-y-6 xl:sticky xl:top-6 xl:self-start">
            <section className="overflow-hidden rounded-[30px] border border-[#263548] bg-[#0f1722]">
              <SectionHeader
                eyebrow="Live preview"
                title="Предпросмотр профиля"
                description="Так основные данные будут выглядеть в профиле."
              />

              <div className="p-5">
                <div className="overflow-hidden rounded-3xl border border-[#29384a] bg-[#0a1018]">
                  <div className="h-24 bg-[linear-gradient(110deg,#7b2f12_0%,#3d2019_48%,#101925_100%)]" />

                  <div className="-mt-10 px-5 pb-5">
                    <div className="flex items-end gap-4">
                      {avatarUrl &&
                      !avatarBroken ? (
                        <img
                          src={avatarUrl}
                          alt=""
                          className="h-20 w-20 rounded-2xl border-4 border-[#0a1018] bg-[#080d14] object-cover"
                          onError={() =>
                            setAvatarBroken(
                              true
                            )
                          }
                        />
                      ) : (
                        <div className="flex h-20 w-20 items-center justify-center rounded-2xl border-4 border-[#0a1018] bg-[#080d14] text-2xl font-black text-orange-400">
                          {getInitials(
                            profile,
                            displayName
                          )}
                        </div>
                      )}

                      <div className="min-w-0 pb-1">
                        <div className="truncate text-xl font-black text-white">
                          {displayName ||
                            profile.username}
                        </div>

                        <div className="mt-1 text-sm text-gray-500">
                          @{profile.username}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                      {countryCode && (
                        <span>
                          {countryFlag(
                            countryCode
                          )}{" "}
                          {countryCode}
                        </span>
                      )}

                      <span>•</span>

                      <span>
                        {statusMeta.label}
                      </span>
                    </div>

                    <p className="mt-4 line-clamp-4 text-sm leading-6 text-gray-400">
                      {bio ||
                        "Описание профиля появится здесь."}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-[30px] border border-[#263548] bg-[#0f1722] p-5">
              <div className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-600">
                Любимая команда
              </div>

              <div className="mt-4 rounded-2xl border border-[#29384a] bg-[#0a1018] p-4">
                <div className="font-black text-white">
                  {favoriteTeam?.name ||
                    "Не выбрана"}
                </div>
              </div>
            </section>

            <section className="rounded-[30px] border border-[#263548] bg-[#0f1722] p-5">
              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-2xl bg-orange-500 px-6 py-4 font-black text-white shadow-lg shadow-orange-500/15 transition hover:-translate-y-0.5 hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving
                  ? "Сохранение..."
                  : "Сохранить изменения"}
              </button>

              <Link
                to={`/profile/${encodeURIComponent(
                  profile.username
                )}`}
                className="mt-3 inline-flex w-full items-center justify-center rounded-2xl border border-[#2b394b] px-5 py-3.5 font-black text-gray-300 transition hover:border-[#41516a] hover:bg-white/[0.025]"
              >
                Отмена
              </Link>
            </section>
          </aside>
        </form>
      </div>
    </main>
  );
}