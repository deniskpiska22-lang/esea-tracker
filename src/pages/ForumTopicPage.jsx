import "../components/forum/forum.css";
import { useForumSession } from "../hooks/useForumSession.js";
import { useEffect, useState } from "react";
import { Navigate, useParams, useSearchParams } from "react-router-dom";
import { FiLock, FiMessageSquare } from "react-icons/fi";
import Link from "../components/SiteLink.jsx";
import {
  ForumAlert,
  ForumAuthor,
  ForumDate,
  ForumLoginNotice,
  ForumReport,
} from "../components/forum/ForumShared.jsx";
import {
  FORUM_PAGE_SIZE,
  forumCategory,
  forumError,
  forumTopicMetadata,
  forumTopicPath,
} from "../utils/forum.js";
import { useAuth } from "../context/AuthContext.jsx";
import { currentLanguage } from "../i18n/languages.js";
import { tx } from "../i18n/translate.js";
import { supabase } from "../lib/supabaseClient.js";

export default function ForumTopicPage() {
  const { id } = useParams();
  return <ForumTopic key={id} />;
}
function ForumTopic() {
  const { id, slug } = useParams();
  const { user } = useAuth();
  const session = useForumSession();
  const [params, setParams] = useSearchParams();
  const page = Math.min(
    10000,
    Math.max(0, Number.parseInt(params.get("page"), 10) || 0),
  );
  const [result, setResult] = useState(null);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const key = `${id}:${page}:${refresh}:${user?.id || ""}`;
  useEffect(() => {
    let active = true;
    async function load() {
      if (!supabase) {
        if (active)
          setResult({
            key,
            error: tx("Could not complete the request. Please try again."),
          });
        return;
      }
      if (!/^[0-9a-f-]{36}$/i.test(id)) {
        if (active) setResult({ key, missing: true });
        return;
      }
      const [topic, posts] = await Promise.all([
        supabase
          .from("forum_topics")
          .select(
            "*,profile:profiles!forum_topics_user_id_fkey(username,display_name,avatar_url)",
          )
          .eq("id", id)
          .maybeSingle(),
        supabase
          .from("forum_posts")
          .select(
            "*,profile:profiles!forum_posts_user_id_fkey(username,display_name,avatar_url)",
            { count: "exact" },
          )
          .eq("topic_id", id)
          .order("created_at")
          .order("id")
          .range(page * FORUM_PAGE_SIZE, (page + 1) * FORUM_PAGE_SIZE - 1),
      ]);
      if (active)
        setResult({
          key,
          topic: topic.data,
          posts: posts.data || [],
          count: posts.count || 0,
          error:
            topic.error || posts.error
              ? tx(forumError(topic.error || posts.error))
              : "",
          missing: !topic.data && !topic.error,
        });
    }
    load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 30000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [id, page, key]);
  const topic = result?.key === key ? result.topic : null;
  useEffect(() => {
    if (topic)
      window.dispatchEvent(
        new CustomEvent("forum-seo-update", {
          detail: forumTopicMetadata(topic, currentLanguage()),
        }),
      );
  }, [topic]);
  async function act(action, payload) {
    setBusy(true);
    setError("");
    try {
      const { data, error } = await supabase.rpc("forum_write", {
        p_action: action,
        p_payload: { topic_id: id, ...payload },
      });
      if (error) throw error;
      setRefresh((v) => v + 1);
      return data || {};
    } catch (e) {
      setError(tx(forumError(e)));
      return null;
    } finally {
      setBusy(false);
    }
  }
  async function reply(e) {
    e.preventDefault();
    const saved = await act("reply", { body });
    if (saved) {
      setBody("");
      const next = new URLSearchParams(params);
      next.set(
        "page",
        String(Math.floor((result.count || 0) / FORUM_PAGE_SIZE)),
      );
      setParams(next);
    }
  }
  const loading = !result || result.key !== key;
  const canonical = topic ? forumTopicPath(topic) : "";
  const current = `/forum/topic/${id}${slug ? `/${slug}` : ""}`;
  if (topic && current !== canonical)
    return (
      <Navigate to={`${canonical}${params.size ? `?${params}` : ""}`} replace />
    );
  return (
    <main className="forum-design forum-topic-page mx-auto max-w-[1040px] px-4 py-8 md:px-6 md:py-10">
      <Link to="/forum" className="forum-topic-back">
        ← {tx("All topics")}
      </Link>
      {loading ? (
        <p role="status" className="py-16 text-center text-slate-500">
          {tx("Loading...")}
        </p>
      ) : result.missing ? (
        <div className="py-16">
          <h1 className="text-2xl font-black">
            {tx("Topic not found or unavailable.")}
          </h1>
        </div>
      ) : result.error ? (
        <div className="mt-6 space-y-4">
          <ForumAlert>{result.error}</ForumAlert>
          <button
            onClick={() => setRefresh((v) => v + 1)}
            className="text-orange-400"
          >
            {tx("Retry")}
          </button>
        </div>
      ) : (
        <>
          <header className="forum-topic-heading mb-6 mt-6">
            <div className="mb-3 flex flex-wrap items-center gap-3 text-xs font-bold uppercase tracking-wide text-orange-300">
              <Link to={`/forum?category=${topic.category}`}>
                {tx(forumCategory(topic.category).label)}
              </Link>
              <span className="rounded bg-white/5 px-2 py-1 text-slate-500">
                {topic.language.toUpperCase()}
              </span>
              {topic.pinned && <span>{tx("Pinned")}</span>}
              {topic.locked && (
                <span className="inline-flex items-center gap-1 text-slate-400">
                  <FiLock />
                  {tx("Closed")}
                </span>
              )}
              {topic.hidden && (
                <span className="text-red-400">{tx("Hidden")}</span>
              )}
            </div>
            <h1 className="break-words text-2xl font-black leading-tight tracking-tight md:text-4xl">
              {topic.title}
            </h1>
            <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
              <FiMessageSquare />
              {topic.reply_count} {tx("Replies")}
            </div>
          </header>
          <article className="forum-post forum-post-original rounded-2xl border p-5 md:p-7">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
              <ForumAuthor profile={topic.profile} />
              <ForumDate value={topic.created_at} />
            </div>
            <p className="whitespace-pre-wrap break-words text-[15px] leading-8 text-slate-200 [overflow-wrap:anywhere]">
              {topic.body}
            </p>
            <div className="mt-6 border-t border-white/5 pt-4">
              <ForumReport topicId={id} />
            </div>
          </article>
          {session.moderator && (
            <div className="mt-4 flex flex-wrap gap-4 rounded-xl border border-orange-500/15 bg-orange-500/5 p-4 text-xs font-bold text-orange-300">
              <button
                disabled={busy}
                onClick={() => act("moderate_topic", { pinned: !topic.pinned })}
              >
                {tx(topic.pinned ? "Unpin" : "Pin topic")}
              </button>
              <button
                disabled={busy}
                onClick={() => act("moderate_topic", { locked: !topic.locked })}
              >
                {tx(topic.locked ? "Reopen topic" : "Close topic")}
              </button>
              <button
                disabled={busy}
                onClick={() => act("moderate_topic", { hidden: !topic.hidden })}
              >
                {tx(topic.hidden ? "Restore" : "Hide")}
              </button>
              <Link to="/forum/moderation">{tx("Moderation")}</Link>
            </div>
          )}
          <section className="mt-8 space-y-3" aria-label={tx("Replies")}>
            {result.posts.map((post) => (
              <article
                id={`post-${post.id}`}
                key={post.id}
                className={`forum-post rounded-2xl border p-5 md:p-6 ${post.hidden ? "opacity-50" : ""}`}
              >
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
                  <ForumAuthor profile={post.profile} />
                  <a href={`#post-${post.id}`}>
                    <ForumDate value={post.created_at} />
                  </a>
                </div>
                {post.hidden && (
                  <p className="mb-2 text-xs text-red-300">{tx("Hidden")}</p>
                )}
                <p className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-300 [overflow-wrap:anywhere]">
                  {post.body}
                </p>
                <div className="mt-4 flex flex-wrap items-start gap-4">
                  <ForumReport topicId={id} postId={post.id} />
                  {(session.moderator || post.user_id === user?.id) && (
                    <button
                      disabled={busy}
                      type="button"
                      onClick={() =>
                        act(post.hidden ? "restore_post" : "hide_post", {
                          post_id: post.id,
                        })
                      }
                      className="text-xs text-slate-500 hover:text-orange-300"
                    >
                      {tx(post.hidden ? "Restore" : "Hide")}
                    </button>
                  )}
                </div>
              </article>
            ))}
          </section>
          {(result.count > FORUM_PAGE_SIZE || page > 0) && (
            <nav
              aria-label={tx("Replies")}
              className="my-5 flex justify-center gap-6 text-sm"
            >
              <button
                disabled={!page}
                onClick={() => setParams({ page: String(page - 1) })}
                className="disabled:opacity-30"
              >
                ← {tx("Previous")}
              </button>
              <span>{page + 1}</span>
              <button
                disabled={(page + 1) * FORUM_PAGE_SIZE >= result.count}
                onClick={() => setParams({ page: String(page + 1) })}
                className="disabled:opacity-30"
              >
                {tx("Next")} →
              </button>
            </nav>
          )}
          <div className="mt-7">
            <ForumAlert>{error}</ForumAlert>
            {topic.locked ? (
              <p className="mt-4 flex items-center gap-2 rounded-xl border border-white/10 p-5 text-sm text-slate-400">
                <FiLock />
                {tx("This topic is closed.")}
              </p>
            ) : !user ? (
              <ForumLoginNotice />
            ) : session.blocked ? (
              <ForumAlert>
                {tx("Your forum posting access is temporarily restricted.")}
              </ForumAlert>
            ) : (
              <form
                onSubmit={reply}
                className="forum-editor forum-reply-editor mt-4"
              >
                <label
                  className="mb-3 block text-sm font-bold"
                  htmlFor="forum-reply"
                >
                  {tx("Join the discussion")}
                </label>
                <textarea
                  id="forum-reply"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  maxLength={10000}
                  required
                  rows={5}
                  className="w-full rounded-xl border border-white/10 bg-black/25 p-4 text-sm leading-7 outline-none focus:border-orange-400/60"
                />
                <div className="mt-4 flex items-center justify-between gap-4">
                  <span className="text-xs text-slate-500">
                    {body.length}/10000
                  </span>
                  <button
                    disabled={busy || !body.trim()}
                    className="forum-button"
                  >
                    {tx(busy ? "Publishing..." : "Post reply")}
                  </button>
                </div>
              </form>
            )}
          </div>
        </>
      )}
    </main>
  );
}
