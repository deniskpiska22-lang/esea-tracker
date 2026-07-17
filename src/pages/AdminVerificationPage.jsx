import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Link,
  Navigate,
} from "react-router-dom";

import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import teams from "../data/teams";

const ROLE_LABELS = {
  player: "Player",
  coach: "Coach",
  manager: "Manager",
  analyst: "Analyst",
};

function formatDate(value) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function AdminVerificationPage() {
  const {
    profile,
    loading: authLoading,
  } = useAuth();

  const [claims, setClaims] =
    useState([]);
  const [loading, setLoading] =
    useState(true);
  const [error, setError] =
    useState("");
  const [processingId, setProcessingId] =
    useState(null);
  const [rejectionReasons, setRejectionReasons] =
    useState({});

  const teamBySlug = useMemo(
    () =>
      new Map(
        teams.map((team) => [
          team.slug,
          team,
        ])
      ),
    []
  );

  const loadClaims = useCallback(async () => {
    setLoading(true);
    setError("");

    const { data, error: loadError } =
      await supabase
        .from("team_claim_requests")
        .select(`
          *,
          profiles:user_id (
            username,
            display_name,
            avatar_url
          )
        `)
        .eq("status", "pending")
        .order("created_at", {
          ascending: true,
        });

    if (loadError) {
      console.error(loadError);
      setError(
        "Не удалось загрузить заявки."
      );
    } else {
      setClaims(
        Array.isArray(data) ? data : []
      );
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    if (profile?.is_admin) {
      loadClaims();
    }
  }, [profile?.is_admin, loadClaims]);

  async function reviewClaim(
    claim,
    decision
  ) {
    const reason =
      rejectionReasons[claim.id]?.trim();

    if (
      decision === "rejected" &&
      !reason
    ) {
      setError(
        "Для отклонения укажите причину."
      );
      return;
    }

    setProcessingId(claim.id);
    setError("");

    const { error: reviewError } =
      await supabase.rpc(
        "review_team_claim",
        {
          p_claim_id: claim.id,
          p_decision: decision,
          p_rejection_reason:
            decision === "rejected"
              ? reason
              : null,
        }
      );

    if (reviewError) {
      console.error(reviewError);
      setError(
        reviewError.message ||
          "Не удалось обработать заявку."
      );
    } else {
      setClaims((current) =>
        current.filter(
          (item) =>
            item.id !== claim.id
        )
      );
    }

    setProcessingId(null);
  }

  if (authLoading || loading) {
    return (
      <main className="min-h-screen bg-[#080d14] px-4 py-12 text-white">
        <div className="text-center text-gray-500">
          Загрузка заявок...
        </div>
      </main>
    );
  }

  if (!profile?.is_admin) {
    return (
      <Navigate to="/" replace />
    );
  }

  return (
    <main className="min-h-screen bg-[#080d14] px-4 py-8 text-white md:px-8 md:py-12">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.2em] text-orange-400">
              Admin panel
            </div>
            <h1 className="mt-2 text-4xl font-black">
              Верификация команд
            </h1>
            <p className="mt-2 text-gray-500">
              Проверяйте контакты и публичные доказательства перед подтверждением.
            </p>
          </div>

          <Link
            to="/"
            className="rounded-xl border border-[#2b394b] px-4 py-2.5 font-black text-gray-300"
          >
            На главную
          </Link>
        </div>

        {error && (
          <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">
            {error}
          </div>
        )}

        {claims.length === 0 ? (
          <div className="mt-8 rounded-3xl border border-[#263548] bg-[#0f1722] p-12 text-center text-gray-500">
            Активных заявок нет.
          </div>
        ) : (
          <div className="mt-8 grid gap-6">
            {claims.map((claim) => {
              const team =
                teamBySlug.get(
                  claim.team_slug
                );
              const userProfile =
                claim.profiles;

              return (
                <article
                  key={claim.id}
                  className="overflow-hidden rounded-[30px] border border-[#263548] bg-[#0f1722]"
                >
                  <div className="grid gap-6 p-6 lg:grid-cols-[240px_1fr_280px]">
                    <div>
                      <div className="flex items-center gap-4">
                        {userProfile?.avatar_url ? (
                          <img
                            src={userProfile.avatar_url}
                            alt=""
                            className="h-16 w-16 rounded-2xl object-cover"
                          />
                        ) : (
                          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#080d14] font-black text-orange-400">
                            {String(
                              userProfile?.display_name ||
                                userProfile?.username ||
                                "?"
                            )
                              .slice(0, 2)
                              .toUpperCase()}
                          </div>
                        )}

                        <div>
                          <div className="font-black text-white">
                            {userProfile?.display_name ||
                              userProfile?.username}
                          </div>
                          <div className="mt-1 text-sm text-gray-500">
                            @{userProfile?.username}
                          </div>
                        </div>
                      </div>

                      <div className="mt-5 text-xs text-gray-600">
                        Отправлено
                      </div>
                      <div className="mt-1 text-sm text-gray-400">
                        {formatDate(
                          claim.created_at
                        )}
                      </div>
                    </div>

                    <div className="space-y-5">
                      <div className="flex items-center gap-4">
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[#2b394b] bg-[#080d14] p-2">
                          {team?.logo ? (
                            <img
                              src={team.logo}
                              alt={team.name}
                              className="h-full w-full object-contain"
                            />
                          ) : (
                            <span className="font-black text-orange-400">
                              TM
                            </span>
                          )}
                        </div>

                        <div>
                          <div className="text-xl font-black text-white">
                            {team?.name ||
                              claim.team_slug}
                          </div>
                          <div className="mt-1 text-sm text-orange-300">
                            {claim.account_type ===
                            "player"
                              ? "Player"
                              : "Team Staff"}{" "}
                            •{" "}
                            {ROLE_LABELS[
                              claim.team_role
                            ]}
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-2xl border border-[#29384a] bg-[#0a1018] p-4">
                          <div className="text-xs text-gray-600">
                            Email
                          </div>
                          <a
                            href={`mailto:${claim.contact_email}`}
                            className="mt-1 block break-all font-bold text-white hover:text-orange-400"
                          >
                            {claim.contact_email}
                          </a>
                        </div>

                        <div className="rounded-2xl border border-[#29384a] bg-[#0a1018] p-4">
                          <div className="text-xs text-gray-600">
                            Discord / Telegram
                          </div>
                          <div className="mt-1 font-bold text-white">
                            {claim.contact_handle ||
                              "Не указан"}
                          </div>
                        </div>
                      </div>

                      <div>
                        <div className="text-xs text-gray-600">
                          Доказательство
                        </div>
                        <a
                          href={claim.proof_url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 block break-all font-bold text-orange-400 hover:text-orange-300"
                        >
                          {claim.proof_url}
                        </a>
                      </div>

                      {claim.message && (
                        <div>
                          <div className="text-xs text-gray-600">
                            Комментарий
                          </div>
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-300">
                            {claim.message}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="space-y-3">
                      <button
                        type="button"
                        disabled={
                          processingId ===
                          claim.id
                        }
                        onClick={() =>
                          reviewClaim(
                            claim,
                            "approved"
                          )
                        }
                        className="w-full rounded-2xl bg-emerald-500 px-5 py-3.5 font-black text-white transition hover:bg-emerald-400 disabled:opacity-60"
                      >
                        Подтвердить
                      </button>

                      <textarea
                        rows={4}
                        value={
                          rejectionReasons[
                            claim.id
                          ] || ""
                        }
                        onChange={(event) =>
                          setRejectionReasons(
                            (current) => ({
                              ...current,
                              [claim.id]:
                                event.target
                                  .value,
                            })
                          )
                        }
                        placeholder="Причина отклонения..."
                        className="w-full resize-y rounded-2xl border border-[#2b394b] bg-[#0a1018] px-4 py-3 text-sm outline-none placeholder:text-gray-700 focus:border-red-500"
                      />

                      <button
                        type="button"
                        disabled={
                          processingId ===
                          claim.id
                        }
                        onClick={() =>
                          reviewClaim(
                            claim,
                            "rejected"
                          )
                        }
                        className="w-full rounded-2xl border border-red-500/35 bg-red-500/10 px-5 py-3.5 font-black text-red-300 transition hover:bg-red-500 hover:text-white disabled:opacity-60"
                      >
                        Отклонить
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
