import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Link,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";

import { useAuth } from "./context/AuthContext";
import { useLanguage } from "./context/LanguageContext";
import teams from "./data/teams";
import playerTeams from "./data/playerTeams.json";
import playerAverageRatings from "./data/playerAverageRatings.json";

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const { language, setLanguage, tr } = useLanguage();

  const {
    user,
    profile,
    loading,
    signOut,
  } = useAuth();

  const [menuOpen, setMenuOpen] =
    useState(false);

  const searchRef = useRef(null);
  const submitRef = useRef(null);

  const [showSearch, setShowSearch] =
    useState(false);
  const [search, setSearch] =
    useState("");

  const [showSubmitTeam, setShowSubmitTeam] =
    useState(false);
  const [teamName, setTeamName] =
    useState("");
  const [faceitLink, setFaceitLink] =
    useState("");
  const [contact, setContact] =
    useState("");
  const [note, setNote] =
    useState("");
  const [submittingTeam, setSubmittingTeam] =
    useState(false);

  const searchablePlayers = useMemo(
    () =>
      Object.keys(playerTeams).map(
        (nickname) => ({
          nickname,
          team: playerTeams[nickname],
          rating:
            playerAverageRatings[
              nickname
            ] ?? null,
        })
      ),
    []
  );

  const normalizedSearch =
    search.trim().toLowerCase();

  const filteredTeams = useMemo(() => {
    if (!normalizedSearch) {
      return [];
    }

    return teams
      .filter((team) =>
        String(team.name || "")
          .toLowerCase()
          .includes(normalizedSearch)
      )
      .slice(0, 6);
  }, [normalizedSearch]);

  const filteredPlayers =
    useMemo(() => {
      if (!normalizedSearch) {
        return [];
      }

      return searchablePlayers
        .filter((player) =>
          player.nickname
            .toLowerCase()
            .includes(normalizedSearch)
        )
        .slice(0, 6);
    }, [
      normalizedSearch,
      searchablePlayers,
    ]);

  function closeSearch() {
    setShowSearch(false);
    setSearch("");
  }

  function closeSubmitTeam() {
    if (submittingTeam) {
      return;
    }

    setShowSubmitTeam(false);
  }

  function openTeam(team) {
    closeSearch();
    navigate(`/teams/${team.slug}`);
  }

  function openPlayer(player) {
    closeSearch();
    navigate(
      `/players/${encodeURIComponent(
        player.nickname
      )}`
    );
  }

  function handleSearchKey(event) {
    if (event.key === "Escape") {
      closeSearch();
      return;
    }

    if (
      event.key !== "Enter" ||
      !normalizedSearch
    ) {
      return;
    }

    if (filteredTeams.length > 0) {
      openTeam(filteredTeams[0]);
      return;
    }

    if (filteredPlayers.length > 0) {
      openPlayer(filteredPlayers[0]);
    }
  }

  async function submitTeam(event) {
    event.preventDefault();

    if (
      !teamName.trim() ||
      !faceitLink.trim() ||
      !contact.trim()
    ) {
      window.alert(
        tr("Заполните название команды, ссылку FACEIT и контакт.", "Fill in the team name, FACEIT link, and contact details.")
      );
      return;
    }

    setSubmittingTeam(true);

    try {
      const response = await fetch(
        "/api/submit-team",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            teamName: teamName.trim(),
            faceitLink:
              faceitLink.trim(),
            contact: contact.trim(),
            note: note.trim(),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            tr("Не удалось отправить команду.", "Could not submit the team.")
        );
      }

      window.alert(
        tr("Команда успешно отправлена!", "Team submitted successfully!")
      );

      setTeamName("");
      setFaceitLink("");
      setContact("");
      setNote("");
      setShowSubmitTeam(false);
    } catch (error) {
      console.error(
        "Failed to submit team:",
        error
      );

      window.alert(
        error.message ||
          tr("Ошибка сервера.", "Server error.")
      );
    } finally {
      setSubmittingTeam(false);
    }
  }

  useEffect(() => {
    function handleKeyDown(event) {
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "k"
      ) {
        event.preventDefault();
        setMenuOpen(false);
        setShowSubmitTeam(false);
        setShowSearch(true);
        return;
      }

      if (event.key !== "Escape") {
        return;
      }

      if (showSearch) {
        closeSearch();
      }

      if (
        showSubmitTeam &&
        !submittingTeam
      ) {
        setShowSubmitTeam(false);
      }
    }

    function handleMouseDown(event) {
      if (
        showSearch &&
        searchRef.current &&
        !searchRef.current.contains(
          event.target
        )
      ) {
        closeSearch();
      }

      if (
        showSubmitTeam &&
        submitRef.current &&
        !submitRef.current.contains(
          event.target
        ) &&
        !submittingTeam
      ) {
        setShowSubmitTeam(false);
      }
    }

    window.addEventListener(
      "keydown",
      handleKeyDown
    );
    window.addEventListener(
      "mousedown",
      handleMouseDown
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
      window.removeEventListener(
        "mousedown",
        handleMouseDown
      );
    };
  }, [
    showSearch,
    showSubmitTeam,
    submittingTeam,
  ]);

  const isActive = (path) => {
    if (path === "/") {
      return location.pathname === "/";
    }

    return location.pathname.startsWith(
      path
    );
  };

  const navigation = [
    {
      path: "/",
      label: "Home",
    },
    {
      path: "/rankings",
      label: "Rankings",
    },
    {
      path: "/calendar",
      label: "Events",
    },
    {
      path: "/about",
      label: "About",
    },
  ];

  async function handleSignOut() {
    try {
      await signOut();
      setMenuOpen(false);
      navigate("/");
    } catch (error) {
      console.error(
        "Failed to sign out:",
        error
      );
    }
  }

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <div className="min-h-screen bg-[#05070a] text-white">
      

      <nav className="sticky top-0 z-50 border-b border-white/5 bg-[#070b11]/90 shadow-[0_14px_40px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
        <div className="mx-auto max-w-[1440px] px-4 md:px-6 xl:px-8">
          <div className="flex h-[72px] items-center gap-4">
            <Link
              to="/"
              className="group flex shrink-0 items-center gap-3"
              onClick={closeMenu}
            >
              <span className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl border border-orange-400/25 bg-[linear-gradient(145deg,#ff8a1f,#d94b09)] text-sm font-black text-white shadow-[0_8px_24px_rgba(249,115,22,0.28)]">
                ET
                <span className="absolute inset-x-1 top-0 h-px bg-white/60" />
              </span>

              <span className="hidden sm:block">
                <span className="block text-[17px] font-black leading-none tracking-[-0.02em] text-white transition group-hover:text-orange-300">
                  ESEA Tracker
                </span>
                <span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.22em] text-gray-600">
                  Community Hub
                </span>
              </span>
            </Link>

            <div className="hidden min-w-0 flex-1 items-center justify-center lg:flex">
              <div className="flex items-center rounded-2xl border border-white/[0.06] bg-white/[0.025] p-1.5">
                {navigation.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                      isActive(item.path)
                        ? "bg-white/[0.07] text-white shadow-sm"
                        : "text-gray-500 hover:bg-white/[0.04] hover:text-gray-200"
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>

            <div className="ml-auto flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setShowSearch(true);
                }}
                className="group hidden h-11 w-[230px] items-center gap-3 rounded-2xl border border-white/[0.08] bg-[#0d131d] px-4 text-left text-sm transition hover:border-orange-500/35 hover:bg-[#111a27] md:flex xl:w-[270px]"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.05] text-sm text-gray-400 transition group-hover:bg-orange-500/10 group-hover:text-orange-300">
                  ⌕
                </span>

                <span className="min-w-0 flex-1 truncate text-gray-500 transition group-hover:text-gray-300">
                  Search teams & players
                </span>

                <span className="rounded-md border border-white/[0.08] bg-white/[0.04] px-2 py-1 text-[10px] font-black text-gray-600">
                  Ctrl K
                </span>
              </button>

              

              {profile?.is_admin && (
                <Link
                  to="/admin/verifications"
                  className={`hidden h-11 items-center rounded-2xl border px-4 text-sm font-black transition xl:flex ${
                    isActive("/admin/verifications")
                      ? "border-orange-500/50 bg-orange-500/10 text-orange-300"
                      : "border-white/[0.08] bg-white/[0.03] text-gray-400 hover:border-orange-500/30 hover:text-orange-300"
                  }`}
                >
                  Admin
                </Link>
              )}

              {loading ? (
                <div className="h-11 w-28 animate-pulse rounded-2xl bg-white/5" />
              ) : user ? (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() =>
                      setMenuOpen((open) => !open)
                    }
                    className={`flex h-11 items-center gap-2 rounded-2xl border bg-[#0d131d] px-2.5 text-sm font-bold transition ${
                      menuOpen
                        ? "border-orange-500/45"
                        : "border-white/[0.08] hover:border-orange-500/30"
                    }`}
                  >
                    <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-xl bg-[linear-gradient(145deg,#fb923c,#ea580c)] text-xs font-black text-white">
                      {profile?.avatar_url ? (
                        <img
                          src={profile.avatar_url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        (
                          profile?.username ||
                          user.email ||
                          "U"
                        )
                          .charAt(0)
                          .toUpperCase()
                      )}
                    </span>

                    <span className="hidden max-w-28 truncate text-gray-200 sm:block">
                      {profile?.username || user.email}
                    </span>

                    <span
                      className={`hidden text-xs text-gray-600 transition sm:block ${
                        menuOpen ? "rotate-180" : ""
                      }`}
                    >
                      ▾
                    </span>
                  </button>

                  {menuOpen && (
                    <div className="absolute right-0 top-14 w-64 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0d131d]/98 p-2 shadow-[0_24px_70px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
                      <div className="rounded-xl bg-white/[0.035] px-3 py-3">
                        <div className="truncate font-black text-white">
                          {profile?.username || tr("Пользователь", "User")}
                        </div>

                        <div className="mt-1 truncate text-xs text-gray-600">
                          {user.email}
                        </div>

                        {profile?.is_admin && (
                          <div className="mt-3 inline-flex rounded-lg border border-orange-500/25 bg-orange-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-orange-300">
                            Administrator
                          </div>
                        )}
                      </div>

                      <div className="mt-2 flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2">
                        <span className="text-xs font-bold text-gray-500">
                          {tr("Язык", "Language")}
                        </span>

                        <div className="flex rounded-lg border border-white/[0.08] bg-black/20 p-0.5">
                          <button
                            type="button"
                            onClick={() => setLanguage("en")}
                            className={`rounded-md px-2 py-1 text-[11px] font-black transition ${
                              language === "en"
                                ? "bg-orange-500 text-white"
                                : "text-gray-500 hover:text-white"
                            }`}
                          >
                            EN
                          </button>

                          <button
                            type="button"
                            onClick={() => setLanguage("ru")}
                            className={`rounded-md px-2 py-1 text-[11px] font-black transition ${
                              language === "ru"
                                ? "bg-orange-500 text-white"
                                : "text-gray-500 hover:text-white"
                            }`}
                          >
                            RU
                          </button>
                        </div>
                      </div>

                      <div className="mt-2 space-y-1">
                        <Link
                          to={`/profile/${encodeURIComponent(
                            profile?.username || ""
                          )}`}
                          onClick={closeMenu}
                          className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-bold text-gray-300 transition hover:bg-white/[0.05] hover:text-white"
                        >
                          <span>{tr("Мой профиль", "My profile")}</span>
                          <span className="text-gray-600">→</span>
                        </Link>

                        <Link
                          to={`/profile/${encodeURIComponent(
                            profile?.username || ""
                          )}/edit`}
                          onClick={closeMenu}
                          className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-bold text-gray-300 transition hover:bg-white/[0.05] hover:text-white"
                        >
                          <span>{tr("Настройки", "Settings")}</span>
                          <span className="text-gray-600">⚙</span>
                        </Link>

                        {profile?.is_admin && (
                          <Link
                            to="/admin/verifications"
                            onClick={closeMenu}
                            className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-black text-orange-300 transition hover:bg-orange-500/10"
                          >
                            <span>{tr("Админ-панель", "Admin panel")}</span>
                            <span>→</span>
                          </Link>
                        )}

                        <button
                          type="button"
                          onClick={handleSignOut}
                          className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-bold text-red-300 transition hover:bg-red-500/10"
                        >
                          <span>{tr("Выйти", "Log out")}</span>
                          <span>↗</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="hidden h-11 items-center rounded-2xl px-3 text-sm font-bold text-gray-400 transition hover:bg-white/[0.04] hover:text-white sm:flex"
                  >
                    {tr("Войти", "Log in")}
                  </Link>

                  <Link
                    to="/register"
                    className="flex h-11 items-center rounded-2xl border border-orange-400/20 bg-orange-500/10 px-4 text-sm font-black text-orange-300 transition hover:bg-orange-500 hover:text-white"
                  >
                    {tr("Регистрация", "Sign up")}
                  </Link>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 border-t border-white/[0.05] py-2.5 lg:hidden">
            <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {navigation.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`shrink-0 rounded-xl px-3 py-2 text-sm font-bold transition ${
                    isActive(item.path)
                      ? "bg-white/[0.07] text-white"
                      : "text-gray-500 hover:text-gray-200"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setShowSearch(true)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-gray-300 transition hover:border-orange-500/30 hover:text-orange-300"
              aria-label="Search"
            >
              ⌕
            </button>

            <button
              type="button"
              onClick={() => setShowSubmitTeam(true)}
              className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-[linear-gradient(135deg,#ff8a1f,#ea580c)] px-3 text-xs font-black text-white shadow-[0_8px_20px_rgba(249,115,22,0.2)]"
            >
              <span className="text-base">+</span>
              <span className="hidden min-[420px]:inline">
                Team
              </span>
            </button>
          </div>
        </div>
      </nav>



      {showSearch && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/75 px-4 pt-24 backdrop-blur-sm">
          <div
            ref={searchRef}
            className="w-full max-w-2xl overflow-hidden rounded-3xl border border-[#293548] bg-[#0b0f14] shadow-2xl"
          >
            <div className="flex items-center gap-3 border-b border-white/5 p-4">
              <span className="text-xl">
                🔍
              </span>

              <input
                autoFocus
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                onKeyDown={
                  handleSearchKey
                }
                placeholder="Search teams or players..."
                className="min-w-0 flex-1 bg-transparent py-2 text-white outline-none placeholder:text-gray-600"
              />

              <button
                type="button"
                onClick={closeSearch}
                className="rounded-lg px-3 py-2 text-gray-500 transition hover:bg-white/5 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="max-h-[65vh] overflow-y-auto">
              {!normalizedSearch && (
                <div className="p-10 text-center text-gray-500">
                  {tr("Введите название команды или ник игрока", "Enter a team name or player nickname")}
                </div>
              )}

              {normalizedSearch &&
                filteredTeams.length ===
                  0 &&
                filteredPlayers.length ===
                  0 && (
                  <div className="p-10 text-center text-gray-500">
                    {tr("Ничего не найдено", "Nothing found")}
                  </div>
                )}

              {filteredTeams.length >
                0 && (
                <div>
                  <div className="px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-gray-600">
                    Teams
                  </div>

                  {filteredTeams.map(
                    (team) => (
                      <button
                        key={team.slug}
                        type="button"
                        onClick={() =>
                          openTeam(team)
                        }
                        className="flex w-full items-center gap-4 border-t border-white/5 px-4 py-3 text-left transition hover:bg-white/[0.04]"
                      >
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/5 p-1.5">
                          {team.logo ? (
                            <img
                              src={
                                team.logo
                              }
                              alt=""
                              className="h-full w-full object-contain"
                            />
                          ) : (
                            <span className="font-black text-orange-400">
                              {String(
                                team.name ||
                                  "TM"
                              )
                                .slice(0, 2)
                                .toUpperCase()}
                            </span>
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="truncate font-black text-white">
                            {team.name}
                          </div>

                          <div className="mt-1 text-xs text-gray-500">
                            {team.division ||
                              "Team"}
                          </div>
                        </div>
                      </button>
                    )
                  )}
                </div>
              )}

              {filteredPlayers.length >
                0 && (
                <div>
                  <div className="px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-gray-600">
                    Players
                  </div>

                  {filteredPlayers.map(
                    (player) => (
                      <button
                        key={
                          player.nickname
                        }
                        type="button"
                        onClick={() =>
                          openPlayer(
                            player
                          )
                        }
                        className="flex w-full items-center justify-between gap-4 border-t border-white/5 px-4 py-4 text-left transition hover:bg-white/[0.04]"
                      >
                        <div className="min-w-0">
                          <div className="truncate font-black text-white">
                            {
                              player.nickname
                            }
                          </div>

                          <div className="mt-1 truncate text-xs text-gray-500">
                            {player.team ||
                              "Free agent"}
                          </div>
                        </div>

                        {player.rating !==
                          null && (
                          <div className="shrink-0 rounded-lg border border-orange-500/20 bg-orange-500/10 px-2.5 py-1 text-xs font-black text-orange-300">
                            {Number(
                              player.rating
                            ).toFixed(2)}
                          </div>
                        )}
                      </button>
                    )
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showSubmitTeam && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 px-4 py-8 backdrop-blur-sm">
          <form
            ref={submitRef}
            onSubmit={submitTeam}
            className="w-full max-w-lg overflow-hidden rounded-3xl border border-[#293548] bg-[#0b0f14] shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/5 px-6 py-5">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.18em] text-orange-400">
                  ESEA Tracker
                </div>

                
              </div>

              <button
                type="button"
                onClick={
                  closeSubmitTeam
                }
                disabled={
                  submittingTeam
                }
                className="rounded-lg px-3 py-2 text-gray-500 transition hover:bg-white/5 hover:text-white disabled:opacity-50"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 p-6">
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-gray-300">
                  Team name *
                </span>

                <input
                  value={teamName}
                  onChange={(event) =>
                    setTeamName(
                      event.target.value
                    )
                  }
                  maxLength={100}
                  className="w-full rounded-xl border border-[#293548] bg-[#111823] px-4 py-3 outline-none transition focus:border-orange-500"
                  placeholder="Team name"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-bold text-gray-300">
                  FACEIT link *
                </span>

                <input
                  type="url"
                  value={faceitLink}
                  onChange={(event) =>
                    setFaceitLink(
                      event.target.value
                    )
                  }
                  className="w-full rounded-xl border border-[#293548] bg-[#111823] px-4 py-3 outline-none transition focus:border-orange-500"
                  placeholder="https://www.faceit.com/..."
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-bold text-gray-300">
                  Contact *
                </span>

                <input
                  value={contact}
                  onChange={(event) =>
                    setContact(
                      event.target.value
                    )
                  }
                  maxLength={150}
                  className="w-full rounded-xl border border-[#293548] bg-[#111823] px-4 py-3 outline-none transition focus:border-orange-500"
                  placeholder="Telegram, Discord or email"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-bold text-gray-300">
                  Note
                </span>

                <textarea
                  value={note}
                  onChange={(event) =>
                    setNote(
                      event.target.value
                    )
                  }
                  rows={4}
                  maxLength={500}
                  className="w-full resize-y rounded-xl border border-[#293548] bg-[#111823] px-4 py-3 outline-none transition focus:border-orange-500"
                  placeholder="Division, roster or additional information..."
                />
              </label>
            </div>

            <div className="flex justify-end gap-3 border-t border-white/5 px-6 py-5">
              <button
                type="button"
                onClick={
                  closeSubmitTeam
                }
                disabled={
                  submittingTeam
                }
                className="rounded-xl border border-white/10 px-5 py-3 font-bold text-gray-300 transition hover:bg-white/5 disabled:opacity-50"
              >
                Cancel
              </button>

              
            </div>
          </form>
        </div>
      )}

      <Outlet />

      <a
        href="https://t.me/LisssTzz1"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-4 right-4 z-50 rounded-full bg-orange-500 px-4 py-3 font-bold text-white shadow-lg transition-colors hover:bg-orange-600"
      >
        💬 Feedback
      </a>
    </div>
  );
}

export default App;