import { resolveForumSession } from "../src/utils/forum.js";
import test from "node:test";
import assert from "node:assert/strict";
import {
  forumTopicMetadata,
  forumTopicPath,
  escapeForumSearch,
  forumError,
} from "../src/utils/forum.js";
import { LANGUAGES } from "../src/i18n/languages.js";
import catalog from "../src/i18n/forumCatalog.json" with { type: "json" };
import { renderProfile } from "../server/profileSeo.js";
import { loadForumMetadata } from "../server/forumSeo.js";
const topic = {
  id: "12345678-1111-2222-3333-123456789abc",
  title: "Nuke: как играть? <script>",
  body: "<img src=x onerror=alert(1)>",
  created_at: "2026-10-20T00:00:00Z",
  language: "ru",
  reply_count: 3,
  profile: { username: "test" },
};
test("readable topic URLs retain immutable UUID identity, even with Unicode titles", () => {
  assert.equal(
    forumTopicPath(topic),
    "/forum/topic/12345678-1111-2222-3333-123456789abc/nuke-как-играть-script",
  );
  assert.equal(
    forumTopicPath({ ...topic, title: "!!!" }),
    "/forum/topic/" + topic.id,
  );
  assert.ok(forumTopicPath({ ...topic, title: "x".repeat(200) }).length < 140);
});
test("forum filters treat wildcard characters as literal user input", () => {
  assert.equal(escapeForumSearch("100%_\\"), "100\\%\\_\\\\");
});
test("all forum and bracket labels have complete translations", () => {
  for (const [key, entry] of Object.entries(catalog))
    for (const { code } of LANGUAGES)
      if (code !== "en") assert.ok(entry[code]?.trim(), key + ":" + code);
});
test("forum metadata preserves author text and safely serializes hostile titles", () => {
  const html = renderProfile(
    '<html><head><title></title></head><body><div id="root"></div></body></html>',
    forumTopicMetadata(topic, "en"),
  );
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(!html.includes("<img src=x"));
  assert.ok(!html.includes('"headline":"Nuke: как играть? <script>"'));
  assert.equal(forumTopicMetadata(topic, "de").schema.inLanguage, "ru");
  assert.equal(
    forumTopicMetadata({ ...topic, hidden: true }, "ru").robots,
    "noindex,follow",
  );
});
test("SEO rejects invalid topic IDs before making database requests", async () => {
  assert.equal(
    await loadForumMetadata(
      {
        from() {
          throw Error("Unexpected query");
        },
      },
      "<script>",
      "en",
    ),
    null,
  );
});
test("rate limits and moderation denials have friendly errors without database details", () => {
  assert.equal(
    forumError({ message: "FORUM_RATE_LIMIT" }),
    "Please wait before posting again.",
  );
  assert.equal(
    forumError({ message: "FORUM_FORBIDDEN leaked table" }),
    "Could not complete the request. Please try again.",
  );
});

test("guest sessions and account changes never retain moderator permissions", () => {
  assert.deepEqual(resolveForumSession(null, undefined), {
    moderator: false,
    blocked: false,
  });
  assert.deepEqual(
    resolveForumSession({ userId: "old", moderator: true }, "new"),
    { moderator: false, blocked: false },
  );
  assert.equal(
    resolveForumSession({ userId: "current", moderator: true }, "current")
      .moderator,
    true,
  );
});
