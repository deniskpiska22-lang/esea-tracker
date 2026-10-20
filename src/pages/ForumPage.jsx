import { useForumSession } from "../hooks/useForumSession.js";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  FiMessageSquare,
  FiPlus,
  FiSearch,
  FiArrowRight,
  FiLock,
  FiFlag,
} from "react-icons/fi";
import Link from "../components/SiteLink.jsx";
import {
  ForumAlert,
  ForumAuthor,
  ForumDate,
  ForumLoginNotice,
} from "../components/forum/ForumShared.jsx";
import {
  FORUM_CATEGORIES,
  FORUM_PAGE_SIZE,
  escapeForumSearch,
  forumCategory,
  forumError,
  forumTopicPath,
} from "../utils/forum.js";
import { tx } from "../i18n/translate.js";
import { currentLanguage, LANGUAGES } from "../i18n/languages.js";
import { useAuth } from "../context/AuthContext.jsx";
import { supabase } from "../lib/supabaseClient.js";

const field =
  "w-full rounded-xl border border-white/10 bg-[#080e16] px-4 py-3 text-sm text-white outline-none focus:border-orange-400/60";
export default function ForumPage({ mode = "list" }) {
  const { user, loading: authLoading } = useAuth();
  const session = useForumSession();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const category = FORUM_CATEGORIES.some((c) => c.id === params.get("category"))
    ? params.get("category")
    : "";
  const language = LANGUAGES.some((l) => l.code === params.get("language"))
    ? params.get("language")
    : "";
  const query = (params.get("q") || "").slice(0, 100);
  const page = Math.min(
    10000,
    Math.max(0, Number.parseInt(params.get("page"), 10) || 0),
  );
  const [search, setSearch] = useState(query);
  const [result, setResult] = useState({
    rows: [],
    count: 0,
    key: null,
    error: "",
  });
  const [refresh, setRefresh] = useState(0);
  const key = JSON.stringify([category, language, query, page, mode, refresh]);
  useEffect(() => {
    let active = true;
    async function load() {
      if (!supabase) {
        if (active)
          setResult({
            rows: [],
            count: 0,
            key,
            error: tx("Could not complete the request. Please try again."),
          });
        return;
      }
      if (mode !== "list") return;
      let request = supabase
        .from("forum_topics")
        .select(
          "id,title,category,language,pinned,locked,reply_count,created_at,last_activity_at,profile:profiles!forum_topics_user_id_fkey(username,display_name,avatar_url)",
          { count: "exact" },
        )
        .eq("hidden", false);
      if (category) request = request.eq("category", category);
      if (language) request = request.eq("language", language);
      if (query.trim())
        request = request.ilike(
          "title",
          `%${escapeForumSearch(query.trim())}%`,
        );
      const { data, count, error } = await request
        .order("pinned", { ascending: false })
        .order("last_activity_at", { ascending: false })
        .order("id")
        .range(page * FORUM_PAGE_SIZE, (page + 1) * FORUM_PAGE_SIZE - 1);
      if (active)
        setResult({
          rows: data || [],
          count: count || 0,
          key,
          error: error ? tx(forumError(error)) : "",
        });
    }
    load();
    const timer =
      mode === "list"
        ? window.setInterval(() => {
            if (document.visibilityState === "visible") load();
          }, 60000)
        : null;
    return () => {
      active = false;
      if (timer) window.clearInterval(timer);
    };
  }, [key, category, language, query, page, mode]);
  function filter(name, value) {
    const next = new URLSearchParams(params);
    if (value) next.set(name, value);
    else next.delete(name);
    next.delete("page");
    setParams(next);
  }
  return (
    <main className="mx-auto max-w-[1240px] px-4 py-8 md:px-6 md:py-12">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
        <div>
          <div className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-[.22em] text-orange-400">
            <span className="h-px w-7 bg-orange-400/50" />
            ESEA COMMUNITY
          </div>
          <h1 className="text-3xl font-black tracking-tight md:text-4xl">
            {tx(
              mode === "new"
                ? "Create topic"
                : mode === "moderation"
                  ? "Forum moderation"
                  : "Forum",
            )}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
            {tx("Discuss ESEA, find teammates and share your ideas.")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {session.moderator && (
            <Link
              to="/forum/moderation"
              className="rounded-xl border border-white/10 p-3 text-sm text-slate-300"
            >
              <FiFlag className="inline" /> {tx("Moderation")}
            </Link>
          )}
          {mode === "list" ? (
            <Link
              to="/forum/new"
              className="flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-sm font-black text-white transition hover:bg-orange-400"
            >
              <FiPlus />
              {tx("Create topic")}
            </Link>
          ) : (
            <Link to="/forum" className="text-sm font-bold text-orange-400">
              ← {tx("All topics")}
            </Link>
          )}
        </div>
      </div>
      {mode === "new" ? (
        authLoading ? (
          <p>{tx("Loading...")}</p>
        ) : !user ? (
          <ForumLoginNotice />
        ) : session.blocked ? (
          <ForumAlert>
            {tx("Your forum posting access is temporarily restricted.")}
          </ForumAlert>
        ) : (
          <TopicComposer
            onCreated={(topic) => navigate(forumTopicPath(topic))}
            initialCategory={category}
          />
        )
      ) : mode === "moderation" ? (
        <ModerationQueue session={session} />
      ) : (
        <>
          <div className="mb-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {FORUM_CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() =>
                  filter("category", category === c.id ? "" : c.id)
                }
                aria-pressed={category === c.id}
                className={`group rounded-2xl border p-5 text-left transition ${category === c.id ? "border-orange-400/40 bg-orange-500/[.08]" : "border-white/[.07] bg-[#0d141e] hover:border-orange-400/25"}`}
              >
                <span className="mb-4 flex h-9 w-9 items-center justify-center rounded-xl border border-orange-400/15 bg-orange-500/10 text-xl font-bold text-orange-300">
                  {c.icon}
                </span>
                <span className="block text-sm font-bold text-slate-100">
                  {tx(c.label)}
                </span>
                <span className="mt-2 block text-xs leading-5 text-slate-500">
                  {tx(c.description)}
                </span>
              </button>
            ))}
          </div>
          <section className="overflow-hidden rounded-2xl border border-white/[.07] bg-[#0b121c]">
            <div className="flex flex-wrap items-center gap-3 border-b border-white/[.07] p-4">
              <button
                type="button"
                className={`rounded-lg px-3 py-2 text-sm font-bold ${!category ? "bg-white/5 text-white" : "text-slate-400"}`}
                onClick={() => filter("category", "")}
              >
                {tx("All topics")}
              </button>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  filter("q", search);
                }}
                className="ml-auto flex min-w-0 flex-1 gap-2 sm:max-w-sm"
              >
                <label className="min-w-0 flex-1">
                  <span className="sr-only">{tx("Search topics")}</span>
                  <input
                    className={field}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    maxLength={100}
                    placeholder={tx("Search topics")}
                  />
                </label>
                <button
                  className="rounded-xl border border-white/10 px-3 text-slate-400 hover:text-orange-300"
                  aria-label={tx("Search")}
                >
                  <FiSearch />
                </button>
              </form>
              <label>
                <span className="sr-only">{tx("Topic language")}</span>
                <select
                  className={field}
                  value={language}
                  onChange={(e) => filter("language", e.target.value)}
                >
                  <option value="">{tx("All languages")}</option>
                  {LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="hidden grid-cols-[1fr_70px_190px] gap-5 border-b border-white/5 px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-500 md:grid">
              <span>{tx("Topics")}</span>
              <span className="text-center">{tx("Replies")}</span>
              <span>{tx("Last activity")}</span>
            </div>
            {result.error ? (
              <div className="space-y-4 p-6">
                <ForumAlert>{result.error}</ForumAlert>
                <button
                  onClick={() => setRefresh((r) => r + 1)}
                  className="text-orange-400"
                >
                  {tx("Retry")}
                </button>
              </div>
            ) : result.key !== key ? (
              <p
                role="status"
                className="p-12 text-center text-sm text-slate-500"
              >
                {tx("Loading...")}
              </p>
            ) : !result.rows.length ? (
              <div className="px-5 py-14 text-center">
                <FiMessageSquare className="mx-auto mb-4 text-3xl text-slate-600" />
                <h2 className="font-bold text-slate-200">
                  {tx(
                    query || category || language
                      ? "No topics match these filters."
                      : "No topics yet. Start the first discussion.",
                  )}
                </h2>
                <Link
                  to="/forum/new"
                  className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-orange-400"
                >
                  {tx("Create topic")}
                  <FiArrowRight />
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {result.rows.map((topic) => (
                  <div
                    key={topic.id}
                    className="grid gap-3 px-5 py-5 transition hover:bg-white/[.025] md:grid-cols-[1fr_70px_190px] md:items-center md:gap-5"
                  >
                    <div className="min-w-0">
                      <div className="mb-2 flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-wide">
                        <span className="text-orange-300/80">
                          {tx(forumCategory(topic.category).label)}
                        </span>
                        <span className="rounded bg-white/5 px-1.5 py-0.5 text-slate-500">
                          {topic.language.toUpperCase()}
                        </span>
                        {topic.pinned && (
                          <span className="text-amber-400">{tx("Pinned")}</span>
                        )}
                        {topic.locked && <FiLock aria-label={tx("Closed")} />}
                      </div>
                      <Link
                        to={forumTopicPath(topic)}
                        className="block break-words text-base font-bold leading-6 text-white hover:text-orange-300"
                      >
                        {topic.title}
                      </Link>
                      <div className="mt-3 text-xs text-slate-500">
                        <ForumAuthor profile={topic.profile} />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-300 md:justify-center">
                      <FiMessageSquare className="text-slate-600" />
                      {topic.reply_count}
                      <span className="text-xs font-normal text-slate-500 md:hidden">
                        {tx("Replies")}
                      </span>
                    </div>
                    <div className="text-xs leading-5 text-slate-500">
                      <ForumDate value={topic.last_activity_at} />
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between border-t border-white/5 p-4 text-xs text-slate-500">
              <span>
                {result.count} {tx("Topics")}
              </span>
              <div className="flex gap-4">
                <button
                  disabled={page === 0}
                  onClick={() => {
                    const next = new URLSearchParams(params);
                    next.set("page", String(page - 1));
                    setParams(next);
                  }}
                  className="font-bold text-slate-300 disabled:opacity-30"
                >
                  ← {tx("Previous")}
                </button>
                <span>{page + 1}</span>
                <button
                  disabled={(page + 1) * FORUM_PAGE_SIZE >= result.count}
                  onClick={() => {
                    const next = new URLSearchParams(params);
                    next.set("page", String(page + 1));
                    setParams(next);
                  }}
                  className="font-bold text-slate-300 disabled:opacity-30"
                >
                  {tx("Next")} →
                </button>
              </div>
            </div>
          </section>
          <aside className="mt-5 rounded-2xl border border-white/5 bg-white/[.015] p-5 text-xs leading-6 text-slate-500">
            <strong className="text-slate-300">{tx("Community rules")}</strong>
            <p>
              {tx(
                "Be respectful. No spam, harassment or personal data. Report problems to moderators.",
              )}
            </p>
            {!user && (
              <p className="mt-2">
                {tx(
                  "Everyone can read the forum. Sign in or create an account to post.",
                )}
              </p>
            )}
          </aside>
        </>
      )}
    </main>
  );
}
function TopicComposer({ onCreated, initialCategory }) {
  const [form, setForm] = useState({
    title: "",
    body: "",
    category: initialCategory || "esea",
    language: currentLanguage(),
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  function update(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { data, error } = await supabase.rpc("forum_write", {
        p_action: "create",
        p_payload: form,
      });
      if (error) throw error;
      onCreated({ ...form, id: data.id });
    } catch (e) {
      setError(tx(forumError(e)));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      onSubmit={submit}
      className="max-w-3xl space-y-5 rounded-2xl border border-white/10 bg-[#0d141e] p-5 md:p-7"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-sm font-bold">
          <span>{tx("Category")}</span>
          <select
            name="category"
            value={form.category}
            onChange={update}
            className={field}
          >
            {FORUM_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {tx(c.label)}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2 text-sm font-bold">
          <span>{tx("Topic language")}</span>
          <select
            name="language"
            value={form.language}
            onChange={update}
            className={field}
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block space-y-2 text-sm font-bold">
        <span>{tx("Topic title")}</span>
        <input
          name="title"
          value={form.title}
          onChange={update}
          required
          minLength={5}
          maxLength={140}
          className={field}
        />
      </label>
      <label className="block space-y-2 text-sm font-bold">
        <span>{tx("Message")}</span>
        <textarea
          name="body"
          value={form.body}
          onChange={update}
          required
          minLength={10}
          maxLength={10000}
          rows={9}
          className={field}
        />
      </label>
      <p className="text-xs leading-6 text-slate-500">
        {tx(
          "Be respectful. No spam, harassment or personal data. Report problems to moderators.",
        )}
      </p>
      <ForumAlert>{error}</ForumAlert>
      <button
        disabled={
          busy || form.title.trim().length < 5 || form.body.trim().length < 10
        }
        className="rounded-xl bg-orange-500 px-5 py-3 text-sm font-black disabled:opacity-40"
      >
        {tx(busy ? "Publishing..." : "Publish topic")}
      </button>
    </form>
  );
}
function ModerationQueue({ session }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    if (session.moderator)
      supabase
        .from("forum_reports")
        .select(
          "*,topic:forum_topics(id,title,user_id,hidden),post:forum_posts(id,body,user_id,hidden)",
        )
        .eq("resolved", false)
        .order("created_at")
        .limit(100)
        .then(({ data, error }) => {
          if (active) {
            setRows(data || []);
            setError(error ? tx(forumError(error)) : "");
          }
        });
    return () => {
      active = false;
    };
  }, [session.moderator, refresh]);
  async function act(action, payload) {
    setBusy(true);
    const { error } = await supabase.rpc("forum_write", {
      p_action: action,
      p_payload: payload,
    });
    setBusy(false);
    setError(error ? tx(forumError(error)) : "");
    if (!error) setRefresh((v) => v + 1);
  }
  if (!session.moderator)
    return (
      <p className="text-sm text-slate-400">
        {tx("This section is available to moderators.")}
      </p>
    );
  return (
    <div className="space-y-4">
      <ForumAlert>{error}</ForumAlert>
      {rows === null ? (
        <p>{tx("Loading...")}</p>
      ) : !rows.length ? (
        <p className="rounded-2xl border border-white/10 p-8 text-slate-400">
          {tx("No unresolved reports.")}
        </p>
      ) : (
        rows.map((row) => (
          <article
            key={row.id}
            className="space-y-4 rounded-2xl border border-white/10 bg-[#0d141e] p-5"
          >
            <Link
              to={forumTopicPath(row.topic)}
              className="font-bold text-orange-300"
            >
              {row.topic.title}
            </Link>
            {row.post && (
              <p className="whitespace-pre-wrap break-words text-sm text-slate-300">
                {row.post.body}
              </p>
            )}
            <p className="text-sm text-slate-400">{row.reason}</p>
            <div className="flex flex-wrap gap-4 text-xs font-bold">
              <button
                disabled={busy}
                onClick={() =>
                  act(row.post ? "hide_post" : "moderate_topic", {
                    topic_id: row.topic_id,
                    post_id: row.post_id,
                    hidden: true,
                  })
                }
              >
                {tx("Hide")}
              </button>
              <button
                disabled={busy}
                onClick={() => act("resolve_report", { id: row.id })}
              >
                {tx("Resolve report")}
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  act("block_user", {
                    user_id: row.post?.user_id || row.topic.user_id,
                  })
                }
                className="text-red-300"
              >
                {tx("Restrict author for 7 days")}
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  act("unblock_user", {
                    user_id: row.post?.user_id || row.topic.user_id,
                  })
                }
              >
                {tx("Restore posting access")}
              </button>
            </div>
          </article>
        ))
      )}
    </div>
  );
}
