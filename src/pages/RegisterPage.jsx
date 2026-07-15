import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";

const USERNAME_RE = /^[a-zA-Z0-9_]{3,24}$/;

export default function RegisterPage() {
  const { user, loading: authLoading } = useAuth();
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  if (!authLoading && user) return <Navigate to="/" replace />;

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const username = form.username.trim();
    const email = form.email.trim().toLowerCase();

    if (!USERNAME_RE.test(username)) {
      setError("Логин: 3–24 символа, только латинские буквы, цифры и _. ");
      return;
    }

    if (form.password.length < 8) {
      setError("Пароль должен содержать минимум 8 символов.");
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError("Пароли не совпадают.");
      return;
    }

    if (!supabase) {
      setError("Supabase не настроен. Проверь переменные окружения.");
      return;
    }

    setSubmitting(true);

    try {
      const { data: existingProfile, error: profileError } = await supabase
        .from("profiles")
        .select("id")
        .ilike("username", username)
        .maybeSingle();

      if (profileError) throw profileError;
      if (existingProfile) {
        setError("Этот логин уже занят.");
        return;
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password: form.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: { username, display_name: username },
        },
      });

      if (signUpError) throw signUpError;

      if (data.session) {
        setSuccess("Аккаунт создан. Вы уже вошли.");
      } else {
        setSuccess("Аккаунт создан. Подтвердите email по ссылке в письме.");
      }

      setForm({ username: "", email: "", password: "", confirmPassword: "" });
    } catch (err) {
      console.error(err);
      setError(err.message || "Не удалось создать аккаунт.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-[calc(100vh-73px)] items-center justify-center bg-[#070a0f] px-4 py-12">
      <section className="w-full max-w-md rounded-3xl border border-[#243041] bg-[#111823] p-6 shadow-2xl md:p-8">
        <div className="mb-7 text-center">
          <div className="text-sm font-bold uppercase tracking-[0.25em] text-orange-400">ESEA Tracker</div>
          <h1 className="mt-2 text-3xl font-black">Создать аккаунт</h1>
          <p className="mt-2 text-sm text-gray-400">Логин будет отображаться на сайте.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <AuthInput label="Логин" name="username" value={form.username} onChange={updateField} autoComplete="username" placeholder="player123" />
          <AuthInput label="Email" name="email" type="email" value={form.email} onChange={updateField} autoComplete="email" placeholder="you@example.com" />
          <AuthInput label="Пароль" name="password" type="password" value={form.password} onChange={updateField} autoComplete="new-password" placeholder="Минимум 8 символов" />
          <AuthInput label="Повторите пароль" name="confirmPassword" type="password" value={form.confirmPassword} onChange={updateField} autoComplete="new-password" placeholder="Повторите пароль" />

          {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>}
          {success && <div className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-300">{success}</div>}

          <button disabled={submitting} className="w-full rounded-xl bg-orange-500 px-5 py-3 font-black transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60">
            {submitting ? "Создание..." : "Создать аккаунт"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-400">
          Уже есть аккаунт? <Link to="/login" className="font-bold text-orange-400 hover:text-orange-300">Войти</Link>
        </p>
      </section>
    </main>
  );
}

function AuthInput({ label, ...props }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-gray-300">{label}</span>
      <input {...props} required className="w-full rounded-xl border border-[#2b3748] bg-[#0b0f14] px-4 py-3 text-white outline-none transition placeholder:text-gray-600 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15" />
    </label>
  );
}
