import { useState } from "react";
import { useLocation } from "react-router-dom";
import Link from "../SiteLink.jsx";
import { tx } from "../../i18n/translate.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { supabase } from "../../lib/supabaseClient.js";
import { forumError } from "../../utils/forum.js";
import { formatUserDateTime } from "../../utils/userTime.js";

export function ForumDate({ value }) {
  return (
    <time dateTime={value}>
      {formatUserDateTime(value, {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })}
    </time>
  );
}
export function ForumAuthor({ profile }) {
  const label =
    profile?.display_name || profile?.username || tx("Community member");
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-orange-500/10 text-[10px] font-black text-orange-300">
        {profile?.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          label.slice(0, 2).toUpperCase()
        )}
      </span>
      {profile?.username ? (
        <Link
          className="truncate font-semibold text-slate-300 hover:text-orange-300"
          to={`/profile/${encodeURIComponent(profile.username)}`}
        >
          {label}
        </Link>
      ) : (
        label
      )}
    </span>
  );
}
export function ForumLoginNotice() {
  const location = useLocation();
  return (
    <div className="rounded-2xl border border-orange-400/15 bg-orange-500/5 p-5 text-sm leading-7 text-slate-400">
      <p>
        {tx(
          "Everyone can read the forum. Sign in or create an account to post.",
        )}
      </p>
      <div className="mt-2 flex gap-4">
        <Link
          to="/login"
          state={{ from: location }}
          className="font-bold text-orange-400"
        >
          {tx("Log in")}
        </Link>
        <Link
          to="/register"
          state={{ from: location }}
          className="font-bold text-slate-200"
        >
          {tx("Sign up")}
        </Link>
      </div>
    </div>
  );
}
export function ForumAlert({ children }) {
  return children ? (
    <p
      role="alert"
      className="rounded-xl border border-red-400/20 bg-red-400/5 p-4 text-sm text-red-300"
    >
      {children}
    </p>
  ) : null;
}
export function ForumReport({ topicId, postId }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  async function send(event) {
    event.preventDefault();
    setBusy(true);
    setStatus("");
    const { error } = await supabase.rpc("forum_write", {
      p_action: "report",
      p_payload: { topic_id: topicId, post_id: postId, reason },
    });
    setBusy(false);
    if (error) setStatus(tx(forumError(error)));
    else {
      setStatus(tx("Report sent to moderators."));
      setOpen(false);
    }
  }
  if (!user) return null;
  return (
    <div className="text-xs">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="text-slate-500 hover:text-orange-300"
      >
        {tx("Report")}
      </button>
      {status && (
        <p role="status" className="mt-2 text-slate-400">
          {status}
        </p>
      )}
      {open && (
        <form onSubmit={send} className="mt-3 flex max-w-xl flex-wrap gap-2">
          <label className="min-w-[200px] flex-1">
            <span className="sr-only">{tx("Report reason")}</span>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              maxLength={500}
              placeholder={tx("Report reason")}
              className="w-full rounded-lg border border-white/10 bg-black/30 p-3 text-white"
            />
          </label>
          <button
            disabled={busy || !reason.trim()}
            className="rounded-lg bg-orange-500 px-4 font-bold text-white disabled:opacity-40"
          >
            {tx("Send")}
          </button>
        </form>
      )}
    </div>
  );
}
