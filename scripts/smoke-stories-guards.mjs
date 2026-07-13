import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/20260712195500_stories_foundation.sql",
  "utf8",
);
const policyTighteningMigration = readFileSync(
  "supabase/migrations/20260712201500_tighten_story_media_policies.sql",
  "utf8",
);
const postPolicyTighteningMigration = readFileSync(
  "supabase/migrations/20260713011855_tighten_story_post_updates.sql",
  "utf8",
);
const storyModerationMigration = readFileSync(
  "supabase/migrations/20260713012809_story_moderation_admin.sql",
  "utf8",
);
const storyPolicyConsolidationMigration = readFileSync(
  "supabase/migrations/20260713013247_consolidate_story_post_policies.sql",
  "utf8",
);
const storyViewsMigration = readFileSync(
  "supabase/migrations/20260713095318_story_view_events.sql",
  "utf8",
);
const storyReactionsMigration = readFileSync(
  "supabase/migrations/20260713114000_story_reactions.sql",
  "utf8",
);
const storyReactionNotificationsMigration = readFileSync(
  "supabase/migrations/20260713115500_story_reaction_notifications.sql",
  "utf8",
);
const actions = readFileSync("src/app/actions.ts", "utf8");
const adminActions = readFileSync("src/app/admin/actions.ts", "utf8");
const adminContent = readFileSync("src/app/admin/content/page.tsx", "utf8");
const adminReports = readFileSync("src/app/admin/reports/page.tsx", "utf8");
const composer = readFileSync("src/app/floating-composer.tsx", "utf8");
const composerShell = readFileSync("src/app/floating-composer-shell.tsx", "utf8");
const homePage = readFileSync("src/app/page.tsx", "utf8");
const notificationsPage = readFileSync("src/app/notifications/page.tsx", "utf8");
const profilePage = readFileSync("src/app/u/[username]/page.tsx", "utf8");
const storyCreateButton = readFileSync("src/app/story-create-button.tsx", "utf8");
const productPlan = readFileSync("docs/PRODUCT_PLAN.md", "utf8");

const checks = [
  {
    label: "stories migration creates temporary story tables with RLS",
    ok:
      migration.includes("create table if not exists public.story_posts") &&
      migration.includes("create table if not exists public.story_media") &&
      migration.includes("expires_at timestamptz not null default (now() + interval '24 hours')") &&
      migration.includes("alter table public.story_posts enable row level security") &&
      migration.includes("alter table public.story_media enable row level security"),
  },
  {
    label: "stories migration keeps active stories temporary and non-sensitive for public previews",
    ok:
      migration.includes("story_posts_expiry_check") &&
      migration.includes("expires_at > now()") &&
      migration.includes("visibility = 'public_preview'") &&
      migration.includes("and not is_sensitive") &&
      migration.includes("is_sensitive = false"),
  },
  {
    label: "story media starts image-only with safe metadata limits",
    ok:
      migration.includes("media_type text not null default 'image' check (media_type = 'image')") &&
      migration.includes("file_size_bytes between 1 and 10485760") &&
      migration.includes("story_media_metadata_check") &&
      migration.includes("story_media_story_sort_idx"),
  },
  {
    label: "story media owner policies avoid overlapping authenticated select",
    ok:
      policyTighteningMigration.includes('drop policy if exists "Users manage own story media"') &&
      policyTighteningMigration.includes('for insert') &&
      policyTighteningMigration.includes('for update') &&
      policyTighteningMigration.includes('for delete') &&
      !policyTighteningMigration.includes('for all'),
  },
  {
    label: "story post updates cannot create sensitive or long-running stories",
    ok:
      postPolicyTighteningMigration.includes('drop policy if exists "Users archive own stories"') &&
      postPolicyTighteningMigration.includes('create policy "Users update own stories safely"') &&
      postPolicyTighteningMigration.includes("is_sensitive = false") &&
      postPolicyTighteningMigration.includes("sensitive_reason is null") &&
      postPolicyTighteningMigration.includes("expires_at <= created_at + interval '25 hours'"),
  },
  {
    label: "story posts are wired into admin moderation safely",
    ok:
      storyModerationMigration.includes("alter type public.report_subject_type add value if not exists 'story_post'") &&
      storyModerationMigration.includes('create policy "Moderators can review story posts"') &&
      storyModerationMigration.includes('create policy "Moderators can update story posts"') &&
      adminActions.includes('| "story_post"') &&
      adminActions.includes("story_posts") &&
      adminContent.includes('["story_post", "Stories"]') &&
      adminContent.includes('.from("story_posts")') &&
      adminReports.includes('"story_post"') &&
      adminReports.includes('reportSubjectKey("story_post", story.id)'),
  },
  {
    label: "story viewers can report stories from the lightbox",
    ok:
      actions.includes('story_post: { ownerColumn: "author_id", table: "story_posts" }') &&
      homePage.includes("ContentReportForm") &&
      homePage.includes('subjectType="story_post"') &&
      homePage.includes('returnHash="stories"') &&
      homePage.includes("React to story") &&
      homePage.includes("Send a DM reply"),
  },
  {
    label: "story post read and update policies are consolidated",
    ok:
      storyPolicyConsolidationMigration.includes('drop policy if exists "Visible active stories can be read"') &&
      storyPolicyConsolidationMigration.includes('create policy "Anon can read public active stories"') &&
      storyPolicyConsolidationMigration.includes('create policy "Members can read visible or moderated stories"') &&
      storyPolicyConsolidationMigration.includes('create policy "Members update own safe stories or moderate stories"') &&
      storyPolicyConsolidationMigration.includes("private.current_user_can_moderate()") &&
      storyPolicyConsolidationMigration.includes("expires_at <= created_at + interval '25 hours'"),
  },
  {
    label: "story creation action requires a profile, image media, and 24-hour expiry",
    ok:
      actions.includes("export async function createStoryPost") &&
      actions.includes("await requireProfile()") &&
      actions.includes("Stories need a photo or GIF.") &&
      actions.includes('metadata.mediaType !== "image"') &&
      actions.includes("24 * 60 * 60 * 1000") &&
      actions.includes("const storyId = crypto.randomUUID()") &&
      actions.includes("await supabase.storage.from(MEDIA_BUCKET).remove([storagePath])") &&
      actions.includes("function storyMediaMetadataFields") &&
      actions.includes("...storyMediaMetadataFields(metadata)") &&
      actions.includes('.from("story_posts")') &&
      actions.includes('.from("story_media")'),
  },
  {
    label: "story owners can end active stories from the rail",
    ok:
      actions.includes("export async function endStoryPost") &&
      actions.includes("const writeClient = createAdminClient() ?? supabase") &&
      actions.includes('moderation_status: "hidden"') &&
      actions.includes('.eq("author_id", userId)') &&
      homePage.includes("endStoryPost") &&
      homePage.includes("currentUserId") &&
      homePage.includes('aria-label="End story"'),
  },
  {
    label: "story viewers can reply through DMs",
    ok:
      actions.includes("export async function replyToStory") &&
      actions.includes("Story reply:") &&
      actions.includes('subject_type: "story_post"') &&
      actions.includes('href: `/messages?c=${conversationId}`') &&
      actions.includes("ensureDirectConversation") &&
      actions.includes("blockRelationshipExists") &&
      homePage.includes("replyToStory") &&
      homePage.includes("canReplyToStory") &&
      homePage.includes('placeholder="Reply to story"') &&
      homePage.includes('aria-label={`Reply ${reaction}`}') &&
      homePage.includes("footer={"),
  },
  {
    label: "story creation does not expose sensitive upload bypasses",
    ok:
      actions.includes("is_sensitive: false") &&
      actions.includes("sensitive_reason: null") &&
      !composer.includes('name="is_sensitive"') &&
      !composer.includes('name="sensitive_reason"'),
  },
  {
    label: "floating composer has a stories mode and observes the stories rail",
    ok:
      composerShell.includes('| "stories"') &&
      composerShell.includes('label: "Story"') &&
      composerShell.includes('if (hash === "#stories") return "stories"') &&
      composerShell.includes('get(\n      "compose",') &&
      composerShell.includes("window.history.replaceState") &&
      composerShell.includes('"stories", "feed"') &&
      composerShell.includes('"ttc-open-composer"') &&
      composerShell.includes("setActiveMode(mode)") &&
      storyCreateButton.includes('detail: { mode: "stories" }') &&
      homePage.includes("<StoryCreateButton"),
  },
  {
    label: "story composer is members-first, image-only, and launch-policy clear",
    ok:
      composer.includes("action={createStoryPost}") &&
      composer.includes('<VisibilityControl\n                defaultValue="members"') &&
      composer.includes("Stories are temporary image/GIF posts") &&
      composer.includes("No visible nudity") &&
      composer.includes("videoAllowed={false}") &&
      composer.includes("Post story"),
  },
  {
    label: "home page loads active stories and renders a real stories rail",
    ok:
      homePage.includes("type StoryPost =") &&
      homePage.includes("function StoriesRail") &&
      homePage.includes('id="stories"') &&
      homePage.includes("Stories") &&
      homePage.includes("24h") &&
      homePage.includes('.from("story_posts")') &&
      homePage.includes("author_id, caption") &&
      homePage.includes('.gt("expires_at", new Date().toISOString())') &&
      storyCreateButton.includes("Add") &&
      homePage.includes("stories={visibleStories}"),
  },
  {
    label: "story viewer carries caption and author context",
    ok:
      homePage.includes("storyDescription") &&
      homePage.includes("description={storyDescription}") &&
      homePage.includes("title={storyTitle}") &&
      homePage.includes("{story.caption}"),
  },
  {
    label: "story views are RLS-protected and deduplicated per viewer",
    ok:
      storyViewsMigration.includes("create table if not exists public.story_views") &&
      storyViewsMigration.includes("unique (story_id, viewer_id)") &&
      storyViewsMigration.includes("alter table public.story_views enable row level security") &&
      storyViewsMigration.includes('create policy "Members can record visible story views"') &&
      storyViewsMigration.includes('create policy "Authors can read their story views"') &&
      storyViewsMigration.includes("story_views_story_viewed_idx"),
  },
  {
    label: "story rail records signed-in views and shows owner counts",
    ok:
      actions.includes("export async function recordStoryView") &&
      actions.includes('.from("story_views").upsert') &&
      actions.includes('onConflict: "story_id,viewer_id"') &&
      homePage.includes("recordStoryView") &&
      homePage.includes("openAction={") &&
      homePage.includes("story_views(count)") &&
      homePage.includes("storyViewCount") &&
      homePage.includes("ownerStoryFooter") &&
      homePage.includes("Story stats") &&
      homePage.includes("Expires in {timeUntil(story.expires_at)}"),
  },
  {
    label: "profile pages surface active stories safely",
    ok:
      profilePage.includes("type StoryPost =") &&
      profilePage.includes("function ProfileStoryCard") &&
      profilePage.includes("function ProfileStoryPrompt") &&
      profilePage.includes('.from("story_posts")') &&
      profilePage.includes('.gt("expires_at", new Date().toISOString())') &&
      profilePage.includes("const visibleStory =") &&
      profilePage.includes("<ProfileStoryCard") &&
      profilePage.includes("<ProfileStoryPrompt />") &&
      profilePage.includes('href="/?compose=stories#stories"') &&
      profilePage.includes("recordStoryView.bind(null, story.id)") &&
      profilePage.includes("endStoryPost") &&
      productPlan.includes("profile-page active story cards"),
  },
  {
    label: "story reactions are RLS-protected and toggleable",
    ok:
      storyReactionsMigration.includes("create table if not exists public.story_reactions") &&
      storyReactionsMigration.includes("alter table public.story_reactions enable row level security") &&
      storyReactionsMigration.includes("story_reactions_unique_member") &&
      storyReactionsMigration.includes('create policy "Members react to visible stories"') &&
      storyReactionsMigration.includes('create policy "Members update own story reactions"') &&
      storyReactionsMigration.includes('create policy "Members remove own story reactions"') &&
      actions.includes("export async function toggleStoryReaction") &&
      actions.includes('.from("story_reactions").upsert') &&
      actions.includes('onConflict: "story_id,reactor_id"') &&
      actions.includes('type: "story_reaction"') &&
      actions.includes('notificationPreferenceSelect("feed")') &&
      homePage.includes("toggleStoryReaction") &&
      homePage.includes("story_reactions(count)") &&
      homePage.includes("storyReactionCount"),
  },
  {
    label: "story reaction notifications are allowed by notification type guard",
    ok:
      storyReactionNotificationsMigration.includes("'story_reaction'") &&
      storyReactionNotificationsMigration.includes("booking_deposit_paid") &&
      storyReactionNotificationsMigration.includes("notifications_type_check") &&
      notificationsPage.includes('| "story_reaction"') &&
      notificationsPage.includes('type === "story_reaction"') &&
      notificationsPage.includes('if (type === "story_post") return "Story"'),
  },
  {
    label: "plan records Stories as started for launch",
    ok:
      productPlan.includes("Stories: add temporary story posts") &&
      productPlan.includes("DM-backed story replies") &&
      productPlan.includes("deduplicated signed-in view counts") &&
      productPlan.includes("quick story reactions with in-app alerts") &&
      productPlan.includes("opened-story owner stats"),
  },
];

const failures = checks.filter((check) => !check.ok);

for (const check of checks) {
  console.log(`${check.ok ? "PASS" : "FAIL"} ${check.label}`);
}

if (failures.length) {
  console.error(`${failures.length} stories guard smoke check(s) failed.`);
  process.exit(1);
}
