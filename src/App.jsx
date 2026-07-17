import { useState } from "react";
import {
  Link,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";

import { useAuth } from "./context/AuthContext";

function App() {
  const location = useLocation();
  const navigate = useNavigate();

  const {
    user,
    profile,
    loading,
    signOut,
  } = useAuth();

  const [menuOpen, setMenuOpen] =
    useState(false);

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
      path: "/media",
      label: "Media",
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

            {profile?.is_admin && (
              <Link
                to="/admin/verifications"
                className={`rounded-xl border px-3 py-2 font-black transition ${
                  isActive(
                    "/admin/verifications"
                  )
                    ? "border-orange-500 bg-orange-500/10 text-orange-300"
                    : "border-orange-500/30 bg-orange-500/[0.06] text-orange-400 hover:border-orange-500/60 hover:bg-orange-500/10 hover:text-orange-300"
                }`}
              >
                Админ-панель
              </Link>
            )}
          </div>

          <div className="relative flex shrink-0 items-center gap-2">
            {loading ? (
              <div className="h-10 w-24 animate-pulse rounded-xl bg-white/5" />
            ) : user ? (
              <>
                <button
                  type="button"
                  onClick={() =>
                    setMenuOpen(
                      (open) => !open
                    )
                  }
                  className="flex items-center gap-2 rounded-xl border border-[#293548] bg-[#111823] px-3 py-2 text-sm font-bold transition hover:border-orange-500/50"
                >
                  <span className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-orange-500 text-xs font-black">
                    {profile?.avatar_url ? (
                      <img
                        src={
                          profile.avatar_url
                        }
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

                  <span className="hidden max-w-32 truncate sm:block">
                    {profile?.username ||
                      user.email}
                  </span>

                  <span className="text-gray-500">
                    ▾
                  </span>
                </button>

                {menuOpen && (
                  <div className="absolute right-0 top-12 w-56 overflow-hidden rounded-xl border border-[#293548] bg-[#111823] shadow-2xl">
                    <div className="border-b border-[#243041] px-4 py-3">
                      <div className="truncate font-bold">
                        {profile?.username ||
                          "Пользователь"}
                      </div>

                      <div className="truncate text-xs text-gray-500">
                        {user.email}
                      </div>

                      {profile?.is_admin && (
                        <div className="mt-2 inline-flex rounded-full border border-orange-500/30 bg-orange-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-orange-300">
                          Administrator
                        </div>
                      )}
                    </div>

                    <Link
                      to={`/profile/${encodeURIComponent(
                        profile?.username || ""
                      )}`}
                      onClick={closeMenu}
                      className="block w-full px-4 py-3 text-left text-sm font-bold text-white transition hover:bg-white/5"
                    >
                      Мой профиль
                    </Link>

                    {profile?.is_admin && (
                      <Link
                        to="/admin/verifications"
                        onClick={closeMenu}
                        className="flex w-full items-center justify-between border-t border-[#243041] px-4 py-3 text-left text-sm font-black text-orange-300 transition hover:bg-orange-500/10"
                      >
                        <span>
                          Админ-панель
                        </span>

                        <span>→</span>
                      </Link>
                    )}

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
                  className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-black transition hover:bg-orange-600"
                >
                  Регистрация
                </Link>
              </>
            )}
          </div>
        </div>

        <div className="flex gap-5 overflow-x-auto border-t border-white/5 px-4 py-2 text-sm md:hidden">
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

          {profile?.is_admin && (
            <Link
              to="/admin/verifications"
              className={
                isActive(
                  "/admin/verifications"
                )
                  ? "font-black text-orange-300"
                  : "font-black text-orange-400"
              }
            >
              Admin
            </Link>
          )}
        </div>
      </nav>

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