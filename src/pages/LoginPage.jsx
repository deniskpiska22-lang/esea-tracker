import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const destination = location.state?.from || "/";
  if (!authLoading && user) return <Navigate to={destination} replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!supabase) {
      setError("Supabase не настроен. Проверь переменные окружения.");
      return;
    }

    setSubmitting(true);

    try {
      const value = login.trim();

      if (value.includes("@")) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: value.toLowerCase(),
          password,
        });
        if (signInError) throw signInError;
      } else {
        const { data, error: invokeError } = await supabase.functions.invoke(
          "login-with-username",
          { body: { username: value, password } }
        );

        if (invokeError) throw invokeError;
        if (data?.error) throw new Error(data.error);
        if (!data?.access_token || !data?.refresh_token) {
          throw new Error("Сервер входа по логину пока не настроен.");
        }

        const { error: sessionError } = await supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        });
        if (sessionError) throw sessionError;
      }

      navigate(destination, { replace: true });
    } catch (err) {
      console.error(err);
      setError(
        err.message?.includes("Invalid login credentials")
          ? "Неверный логин или пароль."
          : err.message || "Не удалось войти."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-[calc(100vh-73px)] items-center justify-center bg-[#070a0f] px-4 py-12">
      <section className="w-full max-w-md rounded-3xl border border-[#243041] bg-[#111823] p-6 shadow-2xl md:p-8">
        <div className="mb-7 text-center">
          <div className="text-sm font-bold uppercase tracking-[0.25em] text-orange-400">ESEA Tracker</div>
          <h1 className="mt-2 text-3xl font-black">Вход</h1>
          <p className="mt-2 text-sm text-gray-400">Введите логин и пароль. Email тоже поддерживается.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-gray-300">Логин</span>
            <input value={login} onChange={(event) => setLogin(event.target.value)} required autoComplete="username" placeholder="player123" className="w-full rounded-xl border border-[#2b3748] bg-[#0b0f14] px-4 py-3 text-white outline-none transition placeholder:text-gray-600 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15" />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-bold text-gray-300">Пароль</span>
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" placeholder="Ваш пароль" className="w-full rounded-xl border border-[#2b3748] bg-[#0b0f14] px-4 py-3 text-white outline-none transition placeholder:text-gray-600 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15" />
          </label>

          {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>}

          <button disabled={submitting} className="w-full rounded-xl bg-orange-500 px-5 py-3 font-black transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60">
            {submitting ? "Вход..." : "Войти"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-400">
          Нет аккаунта? <Link to="/register" className="font-bold text-orange-400 hover:text-orange-300">Регистрация</Link>
        </p>
      </section>
    </main>
  );
}
