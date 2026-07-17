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
import teams from "./data/teams";
import playerTeams from "./data/playerTeams.json";
import playerAverageRatings from "./data/playerAverageRatings.json";

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, loading, signOut } = useAuth();

  const searchRef = useRef(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [search, setSearch] = useState("");
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [faceitLink, setFaceitLink] = useState("");
  const [contact, setContact] = useState("");
  const [note, setNote] = useState("");
  const [submittingTeam, setSubmittingTeam] = useState(false);

  const isActive = (path) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  const navigation = [
    { path: "/", label: "Home" },
    { path: "/rankings", label: "Rankings" },
    { path: "/media", label: "Media" },
    { path: "/about", label: "About" },
  ];

  const searchablePlayers = useMemo(
    () =>
      Object.keys(playerTeams).map((nickname) => ({
        nickname,
        team: playerTeams[nickname],
        rating: playerAverageRatings[nickname] ?? null,
      })),
    []
  );

  const normalizedSearch = search.trim().toLowerCase();

  const filteredTeams = useMemo(() => {
    if (!normalizedSearch) return [];

    return teams
      .filter((team) =>
        String(team.name || "")
          .toLowerCase()
          .includes(normalizedSearch)
      )
      .slice(0, 6);
  }, [normalizedSearch]);

  const filteredPlayers = useMemo(() => {
    if (!normalizedSearch) return [];

    return searchablePlayers
      .filter((player) =>
        player.nickname.toLowerCase().includes(normalizedSearch)
      )
      .slice(0, 6);
  }, [normalizedSearch, searchablePlayers]);

  function closeSearch() {
    setShowSearch(false);
    setSearch("");
  }

  function openTeam(team) {
    navigate(`/team/${team.slug}`);
    closeSearch();
  }

  function openPlayer(player) {
    navigate(`/players/${encodeURIComponent(player.nickname)}`);
    closeSearch();
  }

  function handleSearchKey(event) {
    if (event.key === "Escape") {
      closeSearch();
      return;
    }

    if (event.key !== "Enter" || !normalizedSearch) return;

    if (filteredTeams.length > 0) {
      openTeam(filteredTeams[0]);
      return;
    }

    if (filteredPlayers.length > 0) {
      openPlayer(filteredPlayers[0]);
    }
  }

  useEffect(() => {
    if (!showSearch) return undefined;

    function handleKeyDown(event) {
      if (event.key === "Escape") closeSearch();
    }

    function handleMouseDown(event) {
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target)
      ) {
        closeSearch();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("mousedown", handleMouseDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("mousedown", handleMouseDown);
    };
  }, [showSearch]);

  async function handleSignOut() {
    try {
      await signOut();
      setMenuOpen(false);
      navigate("/");
    } catch (error) {
      console.error("Failed to sign out:", error);
    }
  }

  async function submitTeam() {
    if (!teamName.trim() || !faceitLink.trim() || !contact.trim()) {
      alert("Fill in Team Name, Faceit Link and Contact");
      return;
    }

    setSubmittingTeam(true);

    try {
      const response = await fetch("/api/submit-team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamName: teamName.trim(),
          faceitLink: faceitLink.trim(),
          contact: contact.trim(),
          note: note.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Failed to send");
        return;
      }

      alert("Team submitted successfully!");
      setTeamName("");
      setFaceitLink("");
      setContact("");
      setNote("");
      setShowSubmitModal(false);
    } catch (error) {
      console.error(error);
      alert("Server error");
    } finally {
      setSubmittingTeam(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#05070a] text-white">
      <nav className="sticky top-0 z-50 border-b border-white/5 bg-[#0b0f14]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 md:px-8">
          <Link
            to="/"
            className="shrink-0 text-xl font-bold text-orange-500 transition hover:text-orange-400 md:text-2xl"
          >
            ESEA Tracker
          </Link>

          <div className="hidden items-center gap-6 text-sm md:flex">
            {navigation.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`border-b pb-1 transition ${
                  isActive(item.path)
                    ? "border-orange-500 text-white"
                    : "border-transparent text-gray-400 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>

          <div className="relative flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setShowSearch(true)}
              className="flex h-10 items-center gap-2 rounded-xl border border-[#293548] bg-[#111823] px-3 text-sm font-bold text-gray-300 transition hover:border-orange-500/50 hover:text-white"
              aria-label="Search teams and players"
            >
              <span aria-hidden="true">🔍</span>
              <span className="hidden lg:inline">Search</span>
            </button>

            <button
              type="button"
              onClick={() => setShowSubmitModal(true)}
              className="hidden h-10 items-center rounded-xl bg-orange-500 px-4 text-sm font-black text-white transition hover:bg-orange-600 sm:inline-flex"
            >
              + Submit Team
            </button>

            {loading ? (
              <div className="h-10 w-24 animate-pulse rounded-xl bg-white/5" />
            ) : user ? (
              <>
                <button
                  type="button"
                  onClick={() => setMenuOpen((open) => !open)}
                  className="flex h-10 items-center gap-2 rounded-xl border border-[#293548] bg-[#111823] px-3 text-sm font-bold transition hover:border-orange-500/50"
                >
                  <span className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-orange-500 text-xs font-black">
                    {profile?.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      (profile?.username || user.email || "U")
                        .charAt(0)
                        .toUpperCase()
                    )}
                  </span>

                  <span className="hidden max-w-32 truncate sm:block">
                    {profile?.username || user.email}
                  </span>

                  <span className="text-gray-500">▾</span>
                </button>

                {menuOpen && (
                  <div className="absolute right-0 top-12 w-52 overflow-hidden rounded-xl border border-[#293548] bg-[#111823] shadow-2xl">
                    <div className="border-b border-[#243041] px-4 py-3">
                      <div className="truncate font-bold">
                        {profile?.username || "Пользователь"}
                      </div>
                      <div className="truncate text-xs text-gray-500">
                        {user.email}
                      </div>
                    </div>

                    <Link
                      to={`/profile/${encodeURIComponent(
                        profile?.username || ""
                      )}`}
                      onClick={() => setMenuOpen(false)}
                      className="block w-full px-4 py-3 text-left text-sm font-bold text-white transition hover:bg-white/5"
                    >
                      Мой профиль
                    </Link>

                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="w-full border-t border-[#243041] px-4 py-3 text-left text-sm font-bold text-red-300 transition hover:bg-white/5"
                    >
                      Выйти
                    </button>
                  </div>
                )}
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="rounded-xl px-3 py-2 text-sm font-bold text-gray-300 transition hover:text-white"
                >
                  Войти
                </Link>
                <Link
                  to="/register"
                  className="hidden rounded-xl bg-orange-500 px-4 py-2 text-sm font-black transition hover:bg-orange-600 lg:inline-flex"
                >
                  Регистрация
                </Link>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-5 overflow-x-auto border-t border-white/5 px-4 py-2 text-sm md:hidden">
          {navigation.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={
                isActive(item.path)
                  ? "text-orange-400"
                  : "text-gray-400"
              }
            >
              {item.label}
            </Link>
          ))}

          <button
            type="button"
            onClick={() => setShowSubmitModal(true)}
            className="ml-auto shrink-0 font-bold text-orange-400"
          >
            + Submit Team
          </button>
        </div>
      </nav>

      <Outlet />

      {showSearch && (
        <div
          className="fixed inset-0 z-[100] flex items-start justify-center bg-black/75 px-4 pt-24"
          onClick={closeSearch}
        >
          <div
            ref={searchRef}
            className="w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-[#0b0f14] shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-white/5 p-4">
              <input
                autoFocus
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={handleSearchKey}
                placeholder="Search teams or players..."
                className="w-full rounded-xl border border-[#293548] bg-[#0f131a] p-3 text-white outline-none placeholder:text-gray-600 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15"
              />
            </div>

            <div className="max-h-[450px] overflow-y-auto">
              {!normalizedSearch && (
                <div className="p-6 text-center text-gray-500">
                  Enter a team or player name
                </div>
              )}

              {filteredTeams.length > 0 && (
                <>
                  <div className="px-4 py-2 text-xs font-semibold uppercase text-gray-500">
                    Teams
                  </div>

                  {filteredTeams.map((team) => (
                    <button
                      type="button"
                      key={team.slug}
                      onClick={() => openTeam(team)}
                      className="flex w-full items-center gap-3 border-b border-white/5 p-3 text-left transition hover:bg-[#121a25]"
                    >
                      {team.flag ? (
                        <img
                          src={team.flag}
                          alt=""
                          className="h-5 w-5 object-contain"
                        />
                      ) : (
                        <div className="h-5 w-5 rounded bg-white/5" />
                      )}

                      {team.logo ? (
                        <img
                          src={team.logo}
                          alt=""
                          className="h-9 w-9 object-contain"
                        />
                      ) : (
                        <div className="h-9 w-9 rounded-lg bg-white/5" />
                      )}

                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate font-medium text-white">
                          {team.name}
                        </span>
                        <span className="text-xs text-gray-400">
                          {team.division || "Team"}
                        </span>
                      </div>
                    </button>
                  ))}
                </>
              )}

              {filteredPlayers.length > 0 && (
                <>
                  <div className="px-4 py-2 text-xs font-semibold uppercase text-gray-500">
                    Players
                  </div>

                  {filteredPlayers.map((player) => {
                    const playerTeam = teams.find(
                      (team) =>
                        team.name === player.team ||
                        team.slug === player.team
                    );

                    return (
                      <button
                        type="button"
                        key={player.nickname}
                        onClick={() => openPlayer(player)}
                        className="flex w-full items-center justify-between border-b border-white/5 p-3 text-left transition hover:bg-[#121a25]"
                      >
                        <div className="flex items-center gap-3">
                          <div className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg bg-white/5">
                            {playerTeam?.logo && (
                              <img
                                src={playerTeam.logo}
                                alt=""
                                className="absolute inset-0 h-full w-full scale-125 object-contain opacity-20"
                              />
                            )}

                            <img
                              src={`/players/${player.nickname}.png`}
                              alt={player.nickname}
                              onError={(event) => {
                                event.currentTarget.onerror = null;
                                event.currentTarget.src =
                                  "/player-silhouette.png";
                              }}
                              className="relative z-10 h-12 w-12 object-cover"
                            />
                          </div>

                          <div className="flex flex-col">
                            <span className="font-medium text-white">
                              {player.nickname}
                            </span>
                            <span className="text-xs text-gray-400">
                              {player.team || "No team"}
                            </span>
                          </div>
                        </div>

                        {typeof player.rating === "number" && (
                          <span className="text-sm font-medium text-green-400">
                            {player.rating.toFixed(2)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </>
              )}

              {normalizedSearch &&
                filteredTeams.length === 0 &&
                filteredPlayers.length === 0 && (
                  <div className="p-6 text-center text-gray-500">
                    No results found
                  </div>
                )}
            </div>
          </div>
        </div>
      )}

      {showSubmitModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 px-4"
          onClick={() => setShowSubmitModal(false)}
        >
          <div
            className="w-full max-w-[420px] rounded-2xl border border-white/10 bg-[#0b0f14] p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">Submit Team</h2>
                <p className="mt-1 text-sm text-gray-500">
                  Send a team for review
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowSubmitModal(false)}
                className="text-xl text-gray-500 transition hover:text-white"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <input
              className="mb-3 w-full rounded-xl border border-[#293548] bg-[#121a25] p-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15"
              placeholder="Team Name"
              value={teamName}
              onChange={(event) => setTeamName(event.target.value)}
            />

            <input
              className="mb-3 w-full rounded-xl border border-[#293548] bg-[#121a25] p-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15"
              placeholder="FACEIT Link"
              value={faceitLink}
              onChange={(event) => setFaceitLink(event.target.value)}
            />

            <input
              className="mb-3 w-full rounded-xl border border-[#293548] bg-[#121a25] p-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15"
              placeholder="Contact"
              value={contact}
              onChange={(event) => setContact(event.target.value)}
            />

            <textarea
              className="mb-4 min-h-24 w-full resize-y rounded-xl border border-[#293548] bg-[#121a25] p-3 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15"
              placeholder="Note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowSubmitModal(false)}
                className="w-full rounded-xl border border-white/5 bg-[#121a25] py-3 font-bold text-gray-300 transition hover:bg-[#17202c]"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={submitTeam}
                disabled={submittingTeam}
                className="w-full rounded-xl bg-orange-500 py-3 font-black transition hover:bg-orange-600 disabled:cursor-wait disabled:opacity-60"
              >
                {submittingTeam ? "Sending..." : "Send"}
              </button>
            </div>
          </div>
        </div>
      )}

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