import { forumTopicMetadata, forumTopicPath } from "../src/utils/forum.js";
import { escapeHtml } from "./profileSeo.js";
import { localizedPath } from "../src/i18n/languages.js";
import { translateText } from "../src/i18n/translate.js";
export async function loadForumMetadata(client, id, language) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  )
    return null;
  // SEO may use a server credential, so explicitly exclude moderated content.
  const { data: topic, error } = await client
    .from("forum_topics")
    .select(
      "*,profile:profiles!forum_topics_user_id_fkey(username,display_name,avatar_url)",
    )
    .eq("id", id)
    .eq("hidden", false)
    .maybeSingle();
  if (error) throw error;
  if (!topic) return null;
  const { data: posts, error: postError } = await client
    .from("forum_posts")
    .select(
      "body,created_at,profile:profiles!forum_posts_user_id_fkey(username,display_name)",
    )
    .eq("topic_id", id)
    .eq("hidden", false)
    .order("created_at")
    .limit(25);
  if (postError) throw postError;
  const t = (text) => translateText(text, language);
  const author = (profile) =>
    escapeHtml(
      profile?.display_name || profile?.username || t("Community member"),
    );
  const paragraph = (text) =>
    `<p style="white-space:pre-wrap;overflow-wrap:anywhere">${escapeHtml(text)}</p>`;
  const metadata = forumTopicMetadata(topic, language);
  return {
    ...metadata,
    localized: false,
    body: `<nav><a href="${localizedPath("/forum", language)}">${escapeHtml(t("All topics"))}</a></nav><article><p>${author(topic.profile)}</p>${paragraph(topic.body)}</article><h2>${escapeHtml(t("Replies"))}</h2>${(posts || []).map((post) => `<article><p>${author(post.profile)}</p>${paragraph(post.body)}</article>`).join("")}<p>${escapeHtml(t("Everyone can read the forum. Sign in or create an account to post."))}</p>`,
    path: forumTopicPath(topic),
  };
}
