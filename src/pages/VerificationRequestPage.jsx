import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Link,
  Navigate,
  useParams,
} from "react-router-dom";

import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import teams from "../data/teams";

const ROLE_OPTIONS = {
  player: [
    { value: "player", label: "Player" },
  ],
  staff: [
    { value: "coach", label: "Coach" },
    { value: "manager", label: "Manager" },
    { value: "analyst", label: "Analyst" },
  ],
};

const STATUS_META = {
  pending: {
    title: "Request under review",
    text: "We will review the provided contact details and proof.",
    classes:
      "border-amber-500/25 bg-amber-500/10 text-amber-300",
  },
  approved: {
    title: "Request approved",
    text: "The professional profile has been verified.",
    classes:
      "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
  },
  rejected: {
    title: "Request rejected",
    text: "Correct the information and submit a new request.",
    classes:
      "border-red-500/25 bg-red-500/10 text-red-300",
  },
};

export default function VerificationRequestPage() {
  const { username } = useParams();
  const { user, profile, loading, refreshProfile } =
    useAuth();
  const { tr, language } = useLanguage();

  const [requestType, setRequestType] =
    useState("join_team");
  const [accountType, setAccountType] =
    useState("player");
  const [teamSlug, setTeamSlug] =
    useState("");
  const [teamRole, setTeamRole] =
    useState("player");
  const [birthDate, setBirthDate] =
    useState("");
  const [contactEmail, setContactEmail] =
    useState("");
  const [contactHandle, setContactHandle] =
    useState("");
  const [proofUrl, setProofUrl] =
    useState("");
  const [message, setMessage] =
    useState("");
  const [latestClaim, setLatestClaim] =
    useState(null);
  const [claimLoading, setClaimLoading] =
    useState(true);
  const [submitting, setSubmitting] =
    useState(false);
  const [error, setError] =
    useState("");
  const [success, setSuccess] =
    useState("");

  const ownsProfile =
    Boolean(
      user?.id &&
      profile?.id &&
      user.id === profile.id &&
      String(profile.username || "").toLowerCase() ===
        String(username || "").toLowerCase()
    );

  const sortedTeams = useMemo(
    () =>
      [...teams].sort((a, b) =>
        a.name.localeCompare(b.name)
      ),
    []
  );

  const selectedTeam = useMemo(
    () =>
      sortedTeams.find(
        (team) => team.slug === teamSlug
      ) || null,
    [sortedTeams, teamSlug]
  );

  useEffect(() => {
    if (!profile) return;

    const hasProfessionalProfile =
      profile.account_type === "player" ||
      profile.account_type === "staff";

    setRequestType(
      hasProfessionalProfile
        ? "change_team"
        : "join_team"
    );

    setAccountType(
      profile.account_type === "staff"
        ? "staff"
        : "player"
    );
    setTeamSlug(profile.team_slug || "");
    setTeamRole(
      profile.team_role ||
        (profile.account_type === "staff"
          ? "coach"
          : "player")
    );
    setContactEmail(
      user?.email || ""
    );
  }, [profile, user?.email]);

  useEffect(() => {
    async function loadClaim() {
      if (!user?.id) {
        setClaimLoading(false);
        return;
      }

      const { data, error: loadError } =
        await supabase
          .from("team_claim_requests")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", {
            ascending: false,
          })
          .limit(1)
          .maybeSingle();

      if (loadError) {
        console.error(loadError);
      }

      setLatestClaim(data || null);
      setClaimLoading(false);
    }

    loadClaim();
  }, [user?.id]);

  function handleAccountType(nextType) {
    setAccountType(nextType);
    setTeamRole(
      nextType === "player"
        ? "player"
        : "coach"
    );

    if (nextType !== "player") {
      setBirthDate("");
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (
      requestType !== "leave_team" &&
      !teamSlug
    ) {
      setError(tr("Выберите команду.", "Select a team."));
      return;
    }

    if (
      requestType !== "leave_team" &&
      accountType === "player"
    ) {
      if (!birthDate) {
        setError(tr("Укажите дату рождения игрока.", "Enter the player birth date."));
        return;
      }

      const parsedBirthDate = new Date(
        `${birthDate}T00:00:00`
      );
      const today = new Date();

      if (
        Number.isNaN(
          parsedBirthDate.getTime()
        ) ||
        parsedBirthDate > today
      ) {
        setError(tr("Укажите корректную дату рождения.", "Enter a valid birth date."));
        return;
      }

      let age =
        today.getFullYear() -
        parsedBirthDate.getFullYear();
      const monthDifference =
        today.getMonth() -
        parsedBirthDate.getMonth();

      if (
        monthDifference < 0 ||
        (monthDifference === 0 &&
          today.getDate() <
            parsedBirthDate.getDate())
      ) {
        age -= 1;
      }

      if (age < 10 || age > 70) {
        setError(
          tr("Дата рождения выглядит некорректно.", "The birth date appears to be invalid.")
        );
        return;
      }
    }

    if (!contactEmail.trim()) {
      setError(tr("Укажите контактный email.", "Enter a contact email."));
      return;
    }

    if (!proofUrl.trim()) {
      setError(tr("Добавьте ссылку-доказательство.", "Add a proof link."));
      return;
    }

    setSubmitting(true);

    try {
      const {
        data,
        error: submitError,
      } = await supabase.rpc(
        "submit_team_claim",
        {
          p_request_type: requestType,
          p_team_slug:
            requestType === "leave_team"
              ? null
              : teamSlug,
          p_account_type: accountType,
          p_team_role:
            requestType === "leave_team"
              ? null
              : teamRole,
          p_birth_date:
            requestType !== "leave_team" &&
            accountType === "player"
              ? birthDate
              : null,
          p_contact_email:
            contactEmail.trim(),
          p_contact_handle:
            contactHandle.trim() || null,
          p_proof_url: proofUrl.trim(),
          p_message:
            message.trim() || null,
        }
      );

      if (submitError) {
        throw submitError;
      }

      setLatestClaim(data);
      setSuccess(
        tr("Заявка отправлена на проверку.", "The request has been submitted for review.")
      );
      await refreshProfile();
    } catch (submitError) {
      console.error(submitError);
      setError(
        submitError.message ||
          tr("Не удалось отправить заявку.", "Could not submit the request.")
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || claimLoading) {
    return (
      <main className="min-h-screen bg-[#080d14] px-4 py-12 text-white">
        <div className="mx-auto max-w-5xl text-center text-gray-500">
          {tr("Загрузка...", "Loading...")}
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <Navigate to="/login" replace />
    );
  }

  if (!profile || !ownsProfile) {
    return (
      <main className="min-h-screen bg-[#080d14] px-4 py-12 text-white">
        <div className="mx-auto max-w-3xl rounded-3xl border border-red-500/20 bg-red-500/10 p-6 text-center text-red-300">
          {tr("У вас нет доступа к этой странице.", "You do not have access to this page.")}
        </div>
      </main>
    );
  }

  const hasPending =
    latestClaim?.status === "pending";

  return (
    <main className="min-h-screen bg-[#080d14] px-4 py-8 text-white md:px-8 md:py-12">
      <div className="mx-auto max-w-6xl">
        <Link
          to={`/profile/${encodeURIComponent(
            profile.username
          )}`}
          className="text-sm font-black text-orange-400 hover:text-orange-300"
        >
          ← {tr("Назад в профиль", "Back to profile")}
        </Link>

        <section className="mt-6 overflow-hidden rounded-[32px] border border-[#263548] bg-[#0f1722]">
          <div className="relative overflow-hidden border-b border-[#263548] bg-[linear-gradient(110deg,#7b2f12_0%,#3d2019_42%,#101925_100%)] px-6 py-9 md:px-8">
            <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_center,white_1px,transparent_1px)] [background-size:18px_18px]" />
            <div className="relative">
              <div className="text-xs font-black uppercase tracking-[0.22em] text-orange-300">
                {tr("Верификация команды", "Team verification")}
              </div>
              <h1 className="mt-3 text-3xl font-black md:text-4xl">
                {profile.verification_status === "verified" ? tr("Изменение профессионального профиля", "Edit professional profile") : tr("Подтверждение профессионального профиля", "Verify professional profile")}
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-orange-50/60">
                {profile.verification_status === "verified" ? tr("Смените команду, роль или отправьте заявку на получение статуса свободного агента.", "Change your team or role, or request free-agent status.") : tr("Оставьте реальные контакты и публичное доказательство вашей связи с командой.", "Provide real contact details and public proof of your connection to the team.")}
              </p>
            </div>
          </div>

          <div className="grid gap-6 p-5 md:p-7 xl:grid-cols-[1fr_340px]">
            <form
              onSubmit={handleSubmit}
              className="space-y-6"
            >
              {latestClaim && (
                <div
                  className={`rounded-2xl border p-4 ${
                    STATUS_META[
                      latestClaim.status
                    ]?.classes ||
                    STATUS_META.pending.classes
                  }`}
                >
                  <div className="font-black">
                    {latestClaim.status === "approved"
                      ? tr("Request approved", "Request approved")
                      : latestClaim.status === "rejected"
                        ? tr("Request rejected", "Request rejected")
                        : latestClaim.status === "pending"
                          ? tr("Request under review", "Request under review")
                          : tr("Статус заявки", "Request status")}
                  </div>
                  <p className="mt-1 text-sm opacity-80">
                    {latestClaim.status ===
                      "rejected" &&
                    latestClaim.rejection_reason
                      ? latestClaim.rejection_reason
                      : latestClaim.status === "approved"
                        ? tr("The professional profile has been verified.", "The professional profile has been verified.")
                        : latestClaim.status === "rejected"
                          ? tr("Correct the information and submit a new request.", "Correct the information and submit a new request.")
                          : tr("We will review the provided contact details and proof.", "We will review the provided contacts and proof.")}
                  </p>
                </div>
              )}

              {profile.verification_status ===
                "verified" && (
                <div className="rounded-3xl border border-[#29384a] bg-[#0a1018] p-5">
                  <div className="text-sm font-black text-white">
                    {tr("Что вы хотите изменить?", "What would you like to change?")}
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <button
                      type="button"
                      disabled={hasPending}
                      onClick={() =>
                        setRequestType(
                          "change_team"
                        )
                      }
                      className={`rounded-2xl border p-4 text-left transition ${
                        requestType ===
                        "change_team"
                          ? "border-orange-500/50 bg-orange-500/10 text-orange-300"
                          : "border-[#2b394b] text-gray-300 hover:border-[#41516a]"
                      } disabled:opacity-60`}
                    >
                      <div className="font-black">
                        {tr("Сменить команду или роль", "Change team or role")}
                      </div>
                      <div className="mt-2 text-xs leading-5 opacity-70">
                        {tr("Текущая информация останется в профиле до одобрения заявки.", "Your current information will remain visible until the request is approved.")}
                      </div>
                    </button>

                    <button
                      type="button"
                      disabled={hasPending}
                      onClick={() =>
                        setRequestType(
                          "leave_team"
                        )
                      }
                      className={`rounded-2xl border p-4 text-left transition ${
                        requestType ===
                        "leave_team"
                          ? "border-red-500/40 bg-red-500/10 text-red-300"
                          : "border-[#2b394b] text-gray-300 hover:border-[#41516a]"
                      } disabled:opacity-60`}
                    >
                      <div className="font-black">
                        {tr("Покинуть команду", "Leave team")}
                      </div>
                      <div className="mt-2 text-xs leading-5 opacity-70">
                        {tr("После одобрения в профиле появится статус Free Agent.", "After approval, your profile will show Free Agent status.")}
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {requestType !==
                "leave_team" && (
              <div className="rounded-3xl border border-[#29384a] bg-[#0a1018] p-5">
                <div className="text-sm font-black text-white">
                  {tr("Тип профессионального профиля", "Professional profile type")}
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {[
                    ["player", tr("Игрок", "Player")],
                    ["staff", tr("Персонал команды", "Team staff")],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      disabled={hasPending}
                      onClick={() =>
                        handleAccountType(value)
                      }
                      className={`rounded-2xl border p-4 text-left font-black transition ${
                        accountType === value
                          ? "border-orange-500/50 bg-orange-500/10 text-orange-300"
                          : "border-[#2b394b] text-gray-300 hover:border-[#41516a]"
                      } disabled:opacity-60`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              )}

              {requestType ===
                "leave_team" ? (
                <div className="rounded-3xl border border-red-500/20 bg-red-500/[0.05] p-5">
                  <div className="font-black text-red-300">
                    {tr("Заявка на выход из команды", "Request to leave team")}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-gray-400">
                    {tr("После одобрения команда будет удалена из профессионального профиля, а вы получите статус Free Agent. Тип аккаунта и профессиональная роль сохранятся.", "After approval, the team will be removed from your professional profile and you will receive Free Agent status. Your account type and professional role will remain unchanged.")}
                  </p>
                </div>
              ) : (
              <div className="grid gap-5 md:grid-cols-2">
                <label>
                  <span className="mb-2 block text-sm font-black text-gray-200">
                    {tr("Команда", "Team")}
                  </span>
                  <select
                    value={teamSlug}
                    disabled={hasPending}
                    onChange={(event) =>
                      setTeamSlug(
                        event.target.value
                      )
                    }
                    className="w-full rounded-2xl border border-[#2b394b] bg-[#0a1018] px-4 py-3.5 outline-none focus:border-orange-500 disabled:opacity-60"
                  >
                    <option value="">
                      {tr("Выберите команду", "Select a team")}
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

                <label>
                  <span className="mb-2 block text-sm font-black text-gray-200">
                    {tr("Роль", "Role")}
                  </span>
                  <select
                    value={teamRole}
                    disabled={hasPending}
                    onChange={(event) =>
                      setTeamRole(
                        event.target.value
                      )
                    }
                    className="w-full rounded-2xl border border-[#2b394b] bg-[#0a1018] px-4 py-3.5 outline-none focus:border-orange-500 disabled:opacity-60"
                  >
                    {(ROLE_OPTIONS[
                      accountType
                    ] || []).map((role) => (
                      <option
                        key={role.value}
                        value={role.value}
                      >
                        {role.value === "player"
                          ? tr("Игрок", "Player")
                          : role.value === "coach"
                            ? tr("Тренер", "Coach")
                            : role.value === "manager"
                              ? tr("Менеджер", "Manager")
                              : tr("Аналитик", "Analyst")}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              )}

              {requestType !==
                "leave_team" &&
                accountType === "player" && (
                <div className="rounded-3xl border border-orange-500/15 bg-orange-500/[0.035] p-5">
                  <label className="block">
                    <span className="mb-2 block text-sm font-black text-gray-200">
                      {tr("Дата рождения", "Birth date")}
                    </span>

                    <input
                      type="date"
                      value={birthDate}
                      disabled={hasPending}
                      max={new Date()
                        .toISOString()
                        .slice(0, 10)}
                      onChange={(event) =>
                        setBirthDate(
                          event.target.value
                        )
                      }
                      className="w-full rounded-2xl border border-[#3a4658] bg-[#0a1018] px-4 py-3.5 text-white outline-none focus:border-orange-500 disabled:opacity-60 sm:max-w-sm"
                    />

                    <p className="mt-3 text-xs leading-5 text-gray-500">
                      {tr("Дата рождения нужна для скаутинга и проверки возрастной категории. Она не публикуется в открытом профиле.", "The birth date is used for scouting and age verification. It is not shown on the public profile.")}
                    </p>
                  </label>
                </div>
              )}

              <div className="grid gap-5 md:grid-cols-2">
                <label>
                  <span className="mb-2 block text-sm font-black text-gray-200">
                    {tr("Контактный email", "Contact email")}
                  </span>
                  <input
                    type="email"
                    value={contactEmail}
                    disabled={hasPending}
                    onChange={(event) =>
                      setContactEmail(
                        event.target.value
                      )
                    }
                    placeholder="you@team.com"
                    className="w-full rounded-2xl border border-[#2b394b] bg-[#0a1018] px-4 py-3.5 outline-none placeholder:text-gray-700 focus:border-orange-500 disabled:opacity-60"
                  />
                </label>

                <label>
                  <span className="mb-2 block text-sm font-black text-gray-200">
                    {tr("Discord или Telegram", "Discord or Telegram")}
                  </span>
                  <input
                    value={contactHandle}
                    disabled={hasPending}
                    onChange={(event) =>
                      setContactHandle(
                        event.target.value
                      )
                    }
                    placeholder="@username"
                    className="w-full rounded-2xl border border-[#2b394b] bg-[#0a1018] px-4 py-3.5 outline-none placeholder:text-gray-700 focus:border-orange-500 disabled:opacity-60"
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-black text-gray-200">
                  {tr("Ссылка-доказательство", "Proof link")}
                </span>
                <input
                  type="url"
                  value={proofUrl}
                  disabled={hasPending}
                  onChange={(event) =>
                    setProofUrl(
                      event.target.value
                    )
                  }
                  placeholder={tr("FACEIT, ESEA, HLTV, Liquipedia, официальный сайт или соцсеть команды", "FACEIT, ESEA, HLTV, Liquipedia, the official website, or a team social account")}
                  className="w-full rounded-2xl border border-[#2b394b] bg-[#0a1018] px-4 py-3.5 outline-none placeholder:text-gray-700 focus:border-orange-500 disabled:opacity-60"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-black text-gray-200">
                  {tr("Комментарий", "Comment")}
                </span>
                <textarea
                  rows={5}
                  maxLength={1000}
                  value={message}
                  disabled={hasPending}
                  onChange={(event) =>
                    setMessage(
                      event.target.value
                    )
                  }
                  placeholder={tr("Расскажите, как можно подтвердить вашу роль...", "Explain how your role can be verified...")}
                  className="w-full resize-y rounded-2xl border border-[#2b394b] bg-[#0a1018] px-4 py-3.5 outline-none placeholder:text-gray-700 focus:border-orange-500 disabled:opacity-60"
                />
              </label>

              {error && (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
                  {error}
                </div>
              )}

              {success && (
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">
                  {success}
                </div>
              )}

              {!hasPending && (
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-2xl bg-orange-500 px-6 py-4 font-black text-white transition hover:bg-orange-400 disabled:opacity-60"
                >
                  {submitting
                    ? tr("Отправка...", "Submitting...")
                    : requestType === "leave_team"
                    ? tr("Отправить заявку на выход", "Submit leave request")
                    : profile.verification_status === "verified"
                      ? tr("Отправить изменения", "Submit changes")
                      : tr("Отправить заявку", "Submit request")}
                </button>
              )}
            </form>

            <aside className="space-y-5">
              <div className="rounded-3xl border border-[#29384a] bg-[#0a1018] p-5">
                <div className="text-xs font-black uppercase tracking-[0.18em] text-orange-400">
                  {tr("Предпросмотр", "Preview")}
                </div>

                <div className="mt-5 flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-[#2b394b] bg-[#070c12] p-2">
                    {selectedTeam?.logo ? (
                      <img
                        src={selectedTeam.logo}
                        alt={selectedTeam.name}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <span className="font-black text-orange-400">
                        TM
                      </span>
                    )}
                  </div>

                  <div>
                    <div className="font-black text-white">
                      {selectedTeam?.name ||
                        tr("Команда не выбрана", "No team selected")}
                    </div>
                    <div className="mt-1 text-sm text-gray-500">
                      {ROLE_OPTIONS[
                        accountType
                      ]?.find(
                        (role) =>
                          role.value ===
                          teamRole
                      )?.value === "player" ? tr("Игрок", "Player") : ROLE_OPTIONS[accountType]?.find((role) => role.value === teamRole)?.value === "coach" ? tr("Тренер", "Coach") : ROLE_OPTIONS[accountType]?.find((role) => role.value === teamRole)?.value === "manager" ? tr("Менеджер", "Manager") : ROLE_OPTIONS[accountType]?.find((role) => role.value === teamRole)?.value === "analyst" ? tr("Аналитик", "Analyst") : tr("Роль", "Role")}
                    </div>

                    {accountType === "player" &&
                      birthDate && (
                        <div className="mt-1 text-xs text-gray-600">
                          {tr("Дата рождения", "Birth date")}:{" "}
                          {new Intl.DateTimeFormat(
                            language === "ru" ? "ru-RU" : "en-US"
                          ).format(
                            new Date(
                              `${birthDate}T00:00:00`
                            )
                          )}
                        </div>
                      )}
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-[#29384a] bg-[#0a1018] p-5">
                <div className="font-black text-white">
                  {tr("Что подходит как доказательство", "What counts as proof")}
                </div>
                <div className="mt-4 space-y-3 text-sm leading-6 text-gray-500">
                  <p>• {tr("Профиль FACEIT или ESEA", "FACEIT or ESEA profile")}</p>
                  <p>• {tr("Страница HLTV или Liquipedia", "HLTV or Liquipedia page")}</p>
                  <p>• {tr("Официальный ростер команды", "Official team roster")}</p>
                  <p>• {tr("Пост в официальной соцсети", "Post from an official social account")}</p>
                  <p>• {tr("Рабочая почта команды", "Official team email address")}</p>
                </div>
              </div>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}