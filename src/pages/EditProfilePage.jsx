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
import { useLanguage } from "../context/LanguageContext";
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
    label: "verified",
    classes:
      "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
  },
  pending: {
    label: "pending",
    classes:
      "border-amber-500/25 bg-amber-500/10 text-amber-300",
  },
  rejected: {
    label: "rejected",
    classes:
      "border-red-500/25 bg-red-500/10 text-red-300",
  },
  none: {
    label: "none",
    classes:
      "border-gray-500/20 bg-gray-500/10 text-gray-400",
  },
};

export default function EditProfilePage() {
  const { username } = useParams();
  const navigate = useNavigate();
  const { tr } = useLanguage();

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
        tr("Код страны должен состоять из двух латинских букв, например RU.", "The country code must contain two Latin letters, for example US.")
      );
      return;
    }

    if (bio.length > 300) {
      setError(
        tr("Описание не может быть длиннее 300 символов.", "The bio cannot be longer than 300 characters.")
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
        tr("Профиль успешно сохранён.", "Profile saved successfully.")
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
          tr("Не удалось сохранить профиль.", "Could not save the profile.")
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#080d14] px-4 py-12 text-white">
        <div className="mx-auto max-w-7xl text-center text-gray-500">
          {tr("Загрузка...", "Loading...")}
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
          {tr("У вас нет доступа к редактированию этого профиля.", "You do not have permission to edit this profile.")}
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
            {tr("Назад в профиль", "Back to profile")}
          </Link>

          <div className="text-sm text-gray-600">
            {tr("Редактирование", "Editing")} @{profile.username}
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
                    {tr("Редактор профиля", "Profile editor")}
                  </div>

                  <h1 className="mt-3 text-3xl font-black tracking-tight md:text-4xl">
                    {tr("Настройте профиль", "Customize your profile")}
                  </h1>

                  <p className="mt-3 max-w-2xl text-sm leading-6 text-orange-50/60">
                    {tr("Здесь редактируются только личные данные. Команда и роль подтверждаются через отдельную заявку.", "Only personal details are edited here. Team and role are verified through a separate request.")}
                  </p>
                </div>
              </div>

              <div className="grid gap-5 p-5 md:grid-cols-2 md:p-6">
                <label className="block">
                  <FieldLabel
                    title={tr("Отображаемое имя", "Display name")}
                    hint={tr("До 50 символов", "Up to 50 characters")}
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
                    title={tr("Код страны", "Country code")}
                    hint={tr("Например RU, UA, KZ", "For example US, DE, PL")}
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
                    placeholder={tr("RU", "US")}
                    className="w-full rounded-2xl border border-[#2b394b] bg-[#0a1018] px-4 py-3.5 uppercase text-white outline-none transition placeholder:text-gray-700 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15"
                  />
                </label>

                <label className="block md:col-span-2">
                  <FieldLabel
                    title={tr("О себе", "About you")}
                    hint={tr("Коротко расскажите о себе", "Tell us a little about yourself")}
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
                    placeholder={tr("Расскажите о себе, своём опыте и интересах...", "Tell us about yourself, your experience, and interests...")}
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
                eyebrow={tr("Настройки", "Preferences")}
                title={tr("Персональные настройки", "Personal settings")}
                description={tr("Выберите любимую команду и настройте внешний вид профиля.", "Choose your favorite team and customize your profile.")}
              />

              <div className="grid gap-5 p-5 md:grid-cols-2 md:p-6">
                <label className="block">
                  <FieldLabel
                    title={tr("Любимая команда", "Favorite team")}
                    hint={tr("Показывается в профиле", "Shown on your profile")}
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
                      {tr("Не выбрана", "Not selected")}
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
                    title={tr("Ссылка на аватар", "Avatar URL")}
                    hint={tr("Прямая ссылка на изображение", "Direct link to an image")}
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
                eyebrow={tr("Профессиональная верификация", "Professional verification")}
                title={tr("Профессиональный профиль", "Professional profile")}
                description={tr("Команду, роль и статус нельзя менять вручную. Они обновляются после проверки заявки администратором.", "Team, role, and status cannot be changed manually. They are updated after an administrator reviews your request.")}
              />

              <div className="p-5 md:p-6">
                <div
                  className={`rounded-2xl border p-4 ${statusMeta.classes}`}
                >
                  <div className="font-black">
                    {statusMeta.label === "verified"
                        ? tr("Подтверждено", "Verified")
                        : statusMeta.label === "pending"
                          ? tr("Ожидает проверки", "Pending review")
                          : statusMeta.label === "rejected"
                            ? tr("Заявка отклонена", "Request rejected")
                            : tr("Не подтверждено", "Not verified")}
                  </div>

                  <p className="mt-2 text-sm opacity-80">
                    {verificationStatus ===
                    "verified"
                      ? tr("Команда и роль подтверждены администрацией.", "Team and role have been verified by an administrator.")
                      : verificationStatus ===
                          "pending"
                        ? tr("Ваша заявка находится на проверке.", "Your request is under review.")
                        : verificationStatus ===
                            "rejected"
                          ? tr("Заявку можно исправить и отправить повторно.", "You can update the request and submit it again.")
                          : tr("Отправьте заявку, чтобы подтвердить связь с командой.", "Submit a request to verify your connection with the team.")}
                  </p>
                </div>

                <Link
                  to={`/profile/${encodeURIComponent(
                    profile.username
                  )}/verification`}
                  className="mt-4 inline-flex rounded-2xl bg-orange-500 px-5 py-3 font-black text-white transition hover:bg-orange-400"
                >
                  {verificationStatus ===
                  "pending"
                    ? tr("Посмотреть заявку", "View request")
                    : verificationStatus ===
                        "verified"
                      ? tr("Изменить профессиональную информацию", "Edit professional information")
                      : verificationStatus ===
                          "rejected"
                        ? tr("Отправить повторно", "Submit again")
                        : tr("Пройти верификацию", "Get verified")}
                </Link>
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
                eyebrow={tr("Предпросмотр", "Live preview")}
                title={tr("Предпросмотр профиля", "Profile preview")}
                description={tr("Так основные данные будут выглядеть в профиле.", "This is how the main details will appear on your profile.")}
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
                        {statusMeta.label === "verified"
                        ? tr("Подтверждено", "Verified")
                        : statusMeta.label === "pending"
                          ? tr("Ожидает проверки", "Pending review")
                          : statusMeta.label === "rejected"
                            ? tr("Заявка отклонена", "Request rejected")
                            : tr("Не подтверждено", "Not verified")}
                      </span>
                    </div>

                    <p className="mt-4 line-clamp-4 text-sm leading-6 text-gray-400">
                      {bio ||
                        tr("Описание профиля появится здесь.", "Your profile bio will appear here.")}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-[30px] border border-[#263548] bg-[#0f1722] p-5">
              <div className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-600">
                {tr("Любимая команда", "Favorite team")}
              </div>

              <div className="mt-4 rounded-2xl border border-[#29384a] bg-[#0a1018] p-4">
                <div className="font-black text-white">
                  {favoriteTeam?.name ||
                    tr("Не выбрана", "Not selected")}
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
                  ? tr("Сохранение...", "Saving...")
                  : tr("Сохранить изменения", "Save changes")}
              </button>

              <Link
                to={`/profile/${encodeURIComponent(
                  profile.username
                )}`}
                className="mt-3 inline-flex w-full items-center justify-center rounded-2xl border border-[#2b394b] px-5 py-3.5 font-black text-gray-300 transition hover:border-[#41516a] hover:bg-white/[0.025]"
              >
                {tr("Отмена", "Cancel")}
              </Link>
            </section>
          </aside>
        </form>
      </div>
    </main>
  );
}