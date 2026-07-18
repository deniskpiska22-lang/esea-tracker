import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Link,
  useLocation,
} from "react-router-dom";

import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";

const MAX_COMMENT_LENGTH = 1000;

function formatCommentDate(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getInitials(profile) {
  const source =
    profile?.display_name ||
    profile?.username ||
    "?";

  return String(source)
    .trim()
    .slice(0, 2)
    .toUpperCase();
}

export default function MatchComments({ matchId }) {
  const location = useLocation();
  const {
    user,
    profile,
    loading: authLoading,
  } = useAuth();

  const [comments, setComments] = useState([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState("");

  const remainingCharacters =
    MAX_COMMENT_LENGTH - body.length;

  const loadComments = useCallback(async () => {
    if (!supabase || !matchId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { data, error: loadError } = await supabase
        .from("match_comments")
        .select(`
          id,
          match_id,
          user_id,
          body,
          created_at,
          updated_at,
          profile:profiles!match_comments_user_profile_fkey (
            username,
            display_name,
            avatar_url
          )
        `)
        .eq("match_id", matchId)
        .order("created_at", {
          ascending: false,
        });

      if (loadError) throw loadError;

      setComments(
        Array.isArray(data)
          ? data
          : []
      );
    } catch (loadError) {
      console.error(
        "Failed to load comments:",
        loadError
      );

      setError(
        "Could not load comments."
      );
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  useEffect(() => {
    if (!supabase || !matchId) {
      return undefined;
    }

    const channel = supabase
      .channel(`match-comments:${matchId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "match_comments",
          filter: `match_id=eq.${matchId}`,
        },
        () => {
          loadComments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchId, loadComments]);

  async function handleSubmit(event) {
    event.preventDefault();

    const trimmedBody = body.trim();

    if (!user || !trimmedBody || submitting) {
      return;
    }

    if (trimmedBody.length > MAX_COMMENT_LENGTH) {
      setError(
        `A comment cannot be longer than ${MAX_COMMENT_LENGTH} characters.`
      );
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const { error: insertError } = await supabase
        .from("match_comments")
        .insert({
          match_id: matchId,
          user_id: user.id,
          body: trimmedBody,
        });

      if (insertError) throw insertError;

      setBody("");
      await loadComments();
    } catch (submitError) {
      console.error(
        "Failed to submit comment:",
        submitError
      );

      setError(
        "Could not post the comment."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(commentId) {
    if (!user || deletingId) {
      return;
    }

    const shouldDelete = window.confirm(
      "Delete this comment?"
    );

    if (!shouldDelete) return;

    setDeletingId(commentId);
    setError("");

    try {
      const { error: deleteError } = await supabase
        .from("match_comments")
        .delete()
        .eq("id", commentId)
        .eq("user_id", user.id);

      if (deleteError) throw deleteError;

      setComments((current) =>
        current.filter(
          (comment) => comment.id !== commentId
        )
      );
    } catch (deleteError) {
      console.error(
        "Failed to delete comment:",
        deleteError
      );

      setError(
        "Could not delete the comment."
      );
    } finally {
      setDeletingId(null);
    }
  }

  const commentCountLabel = useMemo(() => {
    const count = comments.length;

    if (count === 1) {
      return "1 comment";
    }

    if (count >= 2 && count <= 4) {
      return `${count} comments`;
    }

    return `${count} comments`;
  }, [comments.length]);

  return (
    <section className="mt-10 overflow-hidden rounded-2xl border border-[#243041] bg-[#111823]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#243041] px-5 py-4">
        <div>
          <h2 className="text-2xl font-black">
            Comments
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            {commentCountLabel}
          </p>
        </div>
      </div>

      <div className="p-5 md:p-6">
        {authLoading ? (
          <div className="rounded-xl border border-[#243041] bg-[#0b0f14] p-4 text-sm text-gray-500">
            Checking authentication...
          </div>
        ) : user ? (
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-[#243041] bg-[#0b0f14] p-4"
          >
            <div className="mb-3 flex items-center gap-3">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt=""
                  className="h-10 w-10 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-500/15 text-sm font-black text-orange-400">
                  {getInitials(profile)}
                </div>
              )}

              <div>
                <div className="font-bold">
                  {profile?.display_name ||
                    profile?.username ||
                    "User"}
                </div>

                {profile?.username && (
                  <div className="text-xs text-gray-500">
                    @{profile.username}
                  </div>
                )}
              </div>
            </div>

            <textarea
              value={body}
              onChange={(event) =>
                setBody(
                  event.target.value.slice(
                    0,
                    MAX_COMMENT_LENGTH
                  )
                )
              }
              rows={4}
              maxLength={MAX_COMMENT_LENGTH}
              placeholder="Write a comment about the match..."
              className="w-full resize-y rounded-xl border border-[#2b3748] bg-[#111823] px-4 py-3 text-white outline-none transition placeholder:text-gray-600 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15"
            />

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div
                className={`text-xs ${
                  remainingCharacters < 100
                    ? "text-orange-400"
                    : "text-gray-500"
                }`}
              >
                {remainingCharacters} characters remaining
              </div>

              <button
                type="submit"
                disabled={submitting || !body.trim()}
                className="rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-black text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting
                  ? "Posting..."
                  : "Post"}
              </button>
            </div>
          </form>
        ) : (
          <div className="rounded-xl border border-[#243041] bg-[#0b0f14] p-4 text-center text-sm text-gray-400">
            <Link
              to="/login"
              state={{ from: location }}
              className="font-bold text-orange-400 transition-colors hover:text-orange-300 hover:underline"
            >
              Log in
            </Link>{" "}
            or{" "}
            <Link
              to="/register"
              state={{ from: location }}
              className="font-bold text-orange-400 transition-colors hover:text-orange-300 hover:underline"
            >
              sign up
            </Link>
            , to leave a comment.
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-xl border border-yellow-500/25 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-300">
            {error}
          </div>
        )}

        <div className="mt-6">
          {loading ? (
            <div className="py-8 text-center text-sm text-gray-500">
              Loading comments...
            </div>
          ) : comments.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#2b3748] px-5 py-10 text-center">
              <div className="font-bold">
                No comments yet
              </div>

              <div className="mt-1 text-sm text-gray-500">
                Be the first to discuss this match.
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {comments.map((comment) => {
                const author = comment.profile || null;
                const authorName =
                  author?.display_name ||
                  author?.username ||
                  "Deleted user";
                const isOwnComment =
                  user?.id === comment.user_id;

                return (
                  <article
                    key={comment.id}
                    className="rounded-2xl border border-[#243041] bg-[#0b0f14] p-4"
                  >
                    <div className="flex items-start gap-3">
                      {author?.avatar_url ? (
                        <img
                          src={author.avatar_url}
                          alt=""
                          className="h-11 w-11 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#1a2432] text-sm font-black text-orange-400">
                          {getInitials(author)}
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="min-w-0">
                            {author?.username ? (
                              <Link
                                to={`/profile/${encodeURIComponent(
                                  author.username
                                )}`}
                                className="font-black transition-colors hover:text-orange-400"
                              >
                                {authorName}
                              </Link>
                            ) : (
                              <div className="font-black">
                                {authorName}
                              </div>
                            )}

                            <div className="mt-0.5 text-xs text-gray-500">
                              {formatCommentDate(
                                comment.created_at
                              )}
                            </div>
                          </div>

                          {isOwnComment && (
                            <button
                              type="button"
                              disabled={deletingId === comment.id}
                              onClick={() =>
                                handleDelete(comment.id)
                              }
                              className="text-xs font-semibold text-gray-500 transition-colors hover:text-red-400 disabled:cursor-wait disabled:opacity-50"
                            >
                              {deletingId === comment.id
                                ? "Deleting..."
                                : "Delete"}
                            </button>
                          )}
                        </div>

                        <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-gray-200">
                          {comment.body}
                        </p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}