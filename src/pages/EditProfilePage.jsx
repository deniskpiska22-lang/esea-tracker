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

const ACCOUNT_TYPES = [
  {
    value: "fan",
    title: "Фанат",
    description:
      "Обычный профиль без профессиональной принадлежности.",
  },
  {
    value: "player",
    title: "Игрок",
    description:
      "Профессиональный или полупрофессиональный игрок.",
  },
  {
    value: "staff",
    title: "Team Staff",
    description:
      "Тренер, менеджер или аналитик команды.",
  },
];

const ROLE_OPTIONS = {
  fan: [],
  player: [
    {
      value: "player",
      label: "Player",
    },
  ],
  staff: [
    {
      value: "coach",
      label: "Coach",
    },
    {
      value: "manager",
      label: "Manager",
    },
    {
      value: "analyst",
      label: "Analyst",
    },
  ],
};

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

export default function EditProfilePage() {
  const { username } = useParams();
  const navigate = useNavigate();

  const {
    user,
    profile,
    loading,
    refreshProfile,
  } = useAuth();

  const [accountType, setAccountType] =
    useState("fan");
  const [teamSlug, setTeamSlug] =
    useState("");
  const [teamRole, setTeamRole] =
    useState("");
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
    setAccountType(
      profile.account_type || "fan"
    );
    setTeamSlug(
      profile.team_slug || ""
    );
    setTeamRole(
      profile.team_role || ""
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

  const favoriteTeam = useMemo(
    () =>
      sortedTeams.find(
        (team) =>
          team.slug ===
          favoriteTeamSlug
      ) || null,
    [favoriteTeamSlug, sortedTeams]
  );

  const professionalTeam = useMemo(
    () =>
      sortedTeams.find(
        (team) =>
          team.slug === teamSlug
      ) || null,
    [teamSlug, sortedTeams]
  );

  const availableRoles =
    ROLE_OPTIONS[accountType] || [];

  const showProfessionalFields =
    accountType !== "fan";

  function handleAccountTypeChange(
    nextType
  ) {
    setAccountType(nextType);

    if (nextType === "fan") {
      setTeamSlug("");
      setTeamRole("");
      return;
    }

    if (nextType === "player") {
      setTeamRole("player");
      return;
    }

    if (
      nextType === "staff" &&
      teamRole === "player"
    ) {
      setTeamRole("");
    }
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

    if (
      showProfessionalFields &&
      !teamSlug
    ) {
      setError(
        "Выберите команду для профессионального профиля."
      );
      return;
    }

    if (
      showProfessionalFields &&
      !teamRole
    ) {
      setError(
        "Выберите роль в команде."
      );
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const currentVerificationStatus =
        profile.verification_status ||
        "none";

      const professionalDataChanged =
        accountType !==
          (profile.account_type ||
            "fan") ||
        teamSlug !==
          (profile.team_slug || "") ||
        teamRole !==
          (profile.team_role || "");

      let nextVerificationStatus =
        currentVerificationStatus;

      if (accountType === "fan") {
        nextVerificationStatus =
          "none";
      } else if (
        professionalDataChanged ||
        currentVerificationStatus ===
          "none" ||
        currentVerificationStatus ===
          "rejected"
      ) {
        nextVerificationStatus =
          "pending";
      }

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
            account_type:
              accountType,
            team_slug:
              accountType === "fan"
                ? null
                : teamSlug || null,
            team_role:
              accountType === "fan"
                ? null
                : teamRole || null,
            verification_status:
              nextVerificationStatus,
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
                    Обновите личную информацию, любимую команду и профессиональный статус.
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
                eyebrow="Competitive identity"
                title="Профессиональный профиль"
                description="Выберите тип аккаунта, команду и роль. Изменения профессиональных данных отправят профиль на повторную проверку."
              />

              <div className="space-y-6 p-5 md:p-6">
                <div>
                  <FieldLabel
                    title="Тип аккаунта"
                    hint="Выберите вариант, который соответствует вашему статусу"
                  />

                  <div className="grid gap-3 md:grid-cols-3">
                    {ACCOUNT_TYPES.map(
                      (option) => {
                        const active =
                          accountType ===
                          option.value;

                        return (
                          <button
                            key={
                              option.value
                            }
                            type="button"
                            onClick={() =>
                              handleAccountTypeChange(
                                option.value
                              )
                            }
                            className={`rounded-2xl border p-4 text-left transition ${
                              active
                                ? "border-orange-500/60 bg-orange-500/10 shadow-[0_0_0_1px_rgba(249,115,22,0.12)]"
                                : "border-[#2b394b] bg-[#0a1018] hover:border-[#41516a]"
                            }`}
                          >
                            <div
                              className={`font-black ${
                                active
                                  ? "text-orange-300"
                                  : "text-white"
                              }`}
                            >
                              {option.title}
                            </div>

                            <div className="mt-2 text-xs leading-5 text-gray-600">
                              {
                                option.description
                              }
                            </div>
                          </button>
                        );
                      }
                    )}
                  </div>
                </div>

                {showProfessionalFields && (
                  <div className="grid gap-5 rounded-3xl border border-orange-500/15 bg-orange-500/[0.035] p-5 md:grid-cols-2">
                    <label className="block">
                      <FieldLabel
                        title="Команда"
                        hint="Команда, которую вы представляете"
                      />

                      <select
                        value={teamSlug}
                        onChange={(event) =>
                          setTeamSlug(
                            event.target.value
                          )
                        }
                        className="w-full rounded-2xl border border-[#3a4658] bg-[#0a1018] px-4 py-3.5 text-white outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15"
                      >
                        <option value="">
                          Выберите команду
                        </option>

                        {sortedTeams.map(
                          (team) => (
                            <option
                              key={
                                team.slug
                              }
                              value={
                                team.slug
                              }
                            >
                              {team.name}
                            </option>
                          )
                        )}
                      </select>
                    </label>

                    <label className="block">
                      <FieldLabel
                        title="Роль"
                        hint="Ваша роль в составе"
                      />

                      <select
                        value={teamRole}
                        onChange={(event) =>
                          setTeamRole(
                            event.target.value
                          )
                        }
                        className="w-full rounded-2xl border border-[#3a4658] bg-[#0a1018] px-4 py-3.5 text-white outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15"
                      >
                        <option value="">
                          Выберите роль
                        </option>

                        {availableRoles.map(
                          (role) => (
                            <option
                              key={
                                role.value
                              }
                              value={
                                role.value
                              }
                            >
                              {role.label}
                            </option>
                          )
                        )}
                      </select>
                    </label>

                    <div className="md:col-span-2 rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3 text-sm leading-6 text-amber-200/80">
                      После изменения команды или роли профиль получит статус «Ожидает проверки».
                    </div>
                  </div>
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
                        {ACCOUNT_TYPES.find(
                          (item) =>
                            item.value ===
                            accountType
                        )?.title ||
                          "Фанат"}
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
                Команды
              </div>

              <div className="mt-4 space-y-3">
                <div className="rounded-2xl border border-[#29384a] bg-[#0a1018] p-4">
                  <div className="text-xs text-gray-600">
                    Любимая команда
                  </div>

                  <div className="mt-1 font-black text-white">
                    {favoriteTeam?.name ||
                      "Не выбрана"}
                  </div>
                </div>

                {showProfessionalFields && (
                  <div className="rounded-2xl border border-orange-500/20 bg-orange-500/[0.04] p-4">
                    <div className="text-xs text-orange-300/60">
                      Профессиональный профиль
                    </div>

                    <div className="mt-1 font-black text-white">
                      {professionalTeam?.name ||
                        "Команда не выбрана"}
                    </div>

                    <div className="mt-2 text-xs text-gray-500">
                      {availableRoles.find(
                        (role) =>
                          role.value ===
                          teamRole
                      )?.label ||
                        "Роль не выбрана"}
                    </div>
                  </div>
                )}
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

              <p className="mt-4 text-center text-xs leading-5 text-gray-600">
                Изменения применятся сразу после сохранения.
              </p>
            </section>
          </aside>
        </form>
      </div>
    </main>
  );
}