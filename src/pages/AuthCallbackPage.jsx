import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = window.setTimeout(() => navigate("/", { replace: true }), 1200);
    return () => window.clearTimeout(timer);
  }, [navigate]);

  return (
    <main className="flex min-h-[calc(100vh-73px)] items-center justify-center bg-[#070a0f] px-4 text-center">
      <div>
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-orange-500/20 border-t-orange-500" />
        <h1 className="mt-5 text-xl font-black">Подтверждаем аккаунт…</h1>
        <p className="mt-2 text-gray-400">Сейчас вы вернётесь на сайт.</p>
      </div>
    </main>
  );
}
