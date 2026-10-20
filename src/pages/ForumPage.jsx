import "../components/forum/forum.css";
import {
  ForumArtwork,
  ForumCategoryIcon,
  ForumEmptyState,
  ForumGuidelines,
  ForumWelcome,
} from "../components/forum/ForumVisuals.jsx";
import { useForumSession } from "../hooks/useForumSession.js";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  FiMessageSquare,
  FiPlus,
  FiSearch,
  FiArrowLeft,
  FiArrowUpRight,
  FiX,
  FiGlobe,
  FiBookmark,
  FiChevronLeft,
  FiChevronRight,
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
    <main className="forum-design mx-auto max-w-[1240px] px-4 py-6 md:px-6 md:py-8">
      <header className="forum-hero">
        <div className="forum-hero-copy">
          <div className="forum-eyebrow">{tx("ESEA community")}</div>
          <h1>
            {tx(
              mode === "new"
                ? "Create topic"
                : mode === "moderation"
                  ? "Forum moderation"
                  : "Forum",
            )}
          </h1>
          <p>{tx("Discuss ESEA, find teammates and share your ideas.")}</p>
          <div className="forum-hero-actions">
            {mode === "list" ? (
              <Link
                to={`/forum/new${category ? `?category=${category}` : ""}`}
                className="forum-button"
              >
                <FiPlus aria-hidden="true" />
                {tx("Create topic")}
              </Link>
            ) : (
              <Link to="/forum" className="forum-button forum-button-secondary">
                <FiArrowLeft aria-hidden="true" />
                {tx("All topics")}
              </Link>
            )}
            {session.moderator && (
              <Link
                to="/forum/moderation"
                className="forum-button forum-button-secondary"
              >
                <FiFlag aria-hidden="true" />
                {tx("Moderation")}
              </Link>
            )}
          </div>
        </div>
        <ForumArtwork />
      </header>
      {mode === "new" ? (
        <div className="forum-editor-layout">
          <div>
            {authLoading ? (
              <p className="p-6 text-sm text-slate-400" role="status">
                {tx("Loading...")}
              </p>
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
            )}
          </div>
          <ForumGuidelines />
        </div>
      ) : mode === "moderation" ? (
        <div className="mt-6">
          <ModerationQueue session={session} />
        </div>
      ) : (
        <>
          <nav className="forum-categories" aria-label={tx("Category")}>
            {FORUM_CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                data-category={c.id}
                className="forum-category"
                onClick={() =>
                  filter("category", category === c.id ? "" : c.id)
                }
                aria-pressed={category === c.id}
              >
                <span className="forum-category-top">
                  <span className="forum-category-icon">
                    <ForumCategoryIcon category={c.id} />
                  </span>
                  <FiArrowUpRight aria-hidden="true" />
                </span>
                <span className="forum-category-title">{tx(c.label)}</span>
                <span className="forum-category-description">
                  {tx(c.description)}
                </span>
              </button>
            ))}
          </nav>
          <div className="forum-directory">
            <section
              className="forum-topic-list"
              aria-labelledby="forum-topics-title"
            >
              <div className="forum-list-heading">
                <h2 id="forum-topics-title">
                  <FiMessageSquare aria-hidden="true" />
                  {tx(category ? forumCategory(category).label : "All topics")}
                  {result.key === key && !result.error && (
                    <span className="forum-result-count">{result.count}</span>
                  )}
                </h2>
                {(category || language || query) && (
                  <button
                    type="button"
                    className="forum-reset"
                    onClick={() => setParams({})}
                  >
                    <FiX aria-hidden="true" />
                    {tx("Reset filters")}
                  </button>
                )}
              </div>
              <div className="forum-toolbar">
                <form
                  key={query}
                  className="forum-search"
                  onSubmit={(e) => {
                    e.preventDefault();
                    filter("q", new FormData(e.currentTarget).get("q") || "");
                  }}
                >
                  <label htmlFor="forum-search" className="sr-only">
                    {tx("Search topics")}
                  </label>
                  <input
                    id="forum-search"
                    name="q"
                    defaultValue={query}
                    maxLength={100}
                    placeholder={tx("Search topics")}
                  />
                  <button type="submit" aria-label={tx("Search")}>
                    <FiSearch aria-hidden="true" />
                  </button>
                </form>
                <div className="forum-language">
                  <FiGlobe aria-hidden="true" />
                  <label htmlFor="forum-language" className="sr-only">
                    {tx("Topic language")}
                  </label>
                  <select
                    id="forum-language"
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
                </div>
              </div>
              <div className="forum-columns" aria-hidden="true">
                <span>{tx("Topics")}</span>
                <span className="text-center">{tx("Replies")}</span>
                <span>{tx("Last activity")}</span>
              </div>
              {result.error ? (
                <div className="space-y-4 p-6">
                  <ForumAlert>{result.error}</ForumAlert>
                  <button
                    onClick={() => setRefresh((r) => r + 1)}
                    className="forum-button forum-button-secondary"
                  >
                    {tx("Retry")}
                  </button>
                </div>
              ) : result.key !== key ? (
                <div
                  role="status"
                  className="flex min-h-80 items-center justify-center gap-3 text-sm text-slate-400"
                >
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-600 border-t-orange-400 motion-reduce:animate-none" />
                  {tx("Loading...")}
                </div>
              ) : !result.rows.length ? (
                <ForumEmptyState
                  filtered={!!(query || category || language)}
                  category={category}
                  onReset={() => setParams({})}
                />
              ) : (
                <div>
                  {result.rows.map((topic) => (
                    <article
                      key={topic.id}
                      className={`forum-row ${topic.pinned ? "forum-row-pinned" : ""}`}
                    >
                      <div className="min-w-0">
                        <div className="forum-row-topline">
                          <Link
                            className="forum-category-tag"
                            data-category={topic.category}
                            to={`/forum?category=${topic.category}`}
                          >
                            <ForumCategoryIcon category={topic.category} />
                            {tx(forumCategory(topic.category).label)}
                          </Link>
                          <span className="forum-language-tag">
                            {topic.language.toUpperCase()}
                          </span>
                          {topic.pinned && (
                            <span className="forum-pinned">
                              <FiBookmark aria-hidden="true" />
                              {tx("Pinned")}
                            </span>
                          )}
                          {topic.locked && <FiLock aria-label={tx("Closed")} />}
                        </div>
                        <Link
                          to={forumTopicPath(topic)}
                          className="forum-row-title"
                        >
                          {topic.title}
                        </Link>
                        <div className="forum-row-author">
                          <ForumAuthor profile={topic.profile} />
                        </div>
                      </div>
                      <div className="forum-row-replies">
                        <FiMessageSquare aria-hidden="true" />
                        <span>{topic.reply_count}</span>
                        <span className="sr-only">{tx("Replies")}</span>
                      </div>
                      <div className="forum-row-activity">
                        <ForumDate value={topic.last_activity_at} />
                      </div>
                    </article>
                  ))}
                </div>
              )}
              <nav className="forum-pagination" aria-label={tx("Topics")}>
                <span>
                  {tx("Page")} {page + 1}
                </span>
                <div>
                  <button
                    disabled={page === 0}
                    onClick={() => {
                      const next = new URLSearchParams(params);
                      next.set("page", String(page - 1));
                      setParams(next);
                    }}
                  >
                    <FiChevronLeft className="inline" /> {tx("Previous")}
                  </button>
                  <button
                    disabled={(page + 1) * FORUM_PAGE_SIZE >= result.count}
                    onClick={() => {
                      const next = new URLSearchParams(params);
                      next.set("page", String(page + 1));
                      setParams(next);
                    }}
                  >
                    {tx("Next")} <FiChevronRight className="inline" />
                  </button>
                </div>
              </nav>
            </section>
            <aside className="forum-sidebar">
              <ForumWelcome user={user} />
              <ForumGuidelines />
            </aside>
          </div>
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
    <form onSubmit={submit} className="forum-editor space-y-5">
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
        className="forum-button"
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
