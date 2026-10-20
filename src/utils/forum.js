import { localizedPath } from "../i18n/languages.js";
import { translateText } from "../i18n/translate.js";
export const FORUM_CATEGORIES = [
  {
    id: "esea",
    label: "ESEA & teams",
    description: "Matches, rosters and rankings",
    icon: "◈",
  },
  {
    id: "recruitment",
    label: "Find a team or player",
    description: "LFT, LFP, coaches and stand-ins",
    icon: "+",
  },
  {
    id: "tactics",
    label: "Tactics & veto",
    description: "Maps, strategies, picks and bans",
    icon: "⌘",
  },
  {
    id: "feedback",
    label: "Feedback & bugs",
    description: "Ideas and issues with the site",
    icon: "↗",
  },
];
export const FORUM_PAGE_SIZE = 25;
export const forumCategory = (id) =>
  FORUM_CATEGORIES.find((item) => item.id === id) || FORUM_CATEGORIES[0];
export function forumTopicPath(topic) {
  const slug = String(topic.title || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80)
    .replace(/-$/, "");
  return `/forum/topic/${topic.id}${slug ? `/${slug}` : ""}`;
}
export function forumError(error) {
  const message = String(error?.message || "");
  return message.includes("FORUM_RATE_LIMIT")
    ? "Please wait before posting again."
    : message.includes("FORUM_LOCKED")
      ? "This topic is closed."
      : message.includes("FORUM_BLOCKED")
        ? "Your forum posting access is temporarily restricted."
        : message.includes("FORUM_LOGIN_REQUIRED")
          ? "Log in to join the discussion."
          : message.includes("FORUM_PROFILE_REQUIRED")
            ? "Your profile is still loading. Please try again."
            : message.includes("FORUM_NOT_FOUND")
              ? "Topic not found or unavailable."
              : "Could not complete the request. Please try again.";
}
export function forumTopicMetadata(topic, language) {
  const t = (value) => translateText(value, language);
  const path = localizedPath(forumTopicPath(topic), language);
  return {
    title: `${topic.title} | ${t("Forum")} — ESEA Tracker`,
    heading: topic.title,
    description: topic.body.replace(/\s+/g, " ").slice(0, 180),
    canonicalPath: path,
    routePath: path,
    language,
    alternates: [],
    robots: topic.hidden
      ? "noindex,follow"
      : "index,follow,max-image-preview:large",
    schema: {
      "@context": "https://schema.org",
      "@type": "DiscussionForumPosting",
      headline: topic.title,
      text: topic.body,
      datePublished: topic.created_at,
      inLanguage: topic.language,
      author: {
        "@type": "Person",
        name:
          topic.profile?.display_name ||
          topic.profile?.username ||
          t("Community member"),
      },
      url: `https://eseatracker.ru${path}`,
      commentCount: topic.reply_count || 0,
    },
  };
}
export const escapeForumSearch = (value) =>
  value.replace(/[\\%_]/g, "\\$&").slice(0, 100);
