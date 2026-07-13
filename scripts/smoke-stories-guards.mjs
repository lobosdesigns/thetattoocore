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
const actions = readFileSync("src/app/actions.ts", "utf8");
const composer = readFileSync("src/app/floating-composer.tsx", "utf8");
const composerShell = readFileSync("src/app/floating-composer-shell.tsx", "utf8");
const homePage = readFileSync("src/app/page.tsx", "utf8");
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
    label: "story creation action requires a profile, image media, and 24-hour expiry",
    ok:
      actions.includes("export async function createStoryPost") &&
      actions.includes("await requireProfile()") &&
      actions.includes("Stories need a photo or GIF.") &&
      actions.includes('metadata.mediaType !== "image"') &&
      actions.includes("24 * 60 * 60 * 1000") &&
      actions.includes('.from("story_posts")') &&
      actions.includes('.from("story_media")'),
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
      composerShell.includes('"stories", "feed"'),
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
      homePage.includes('.from("story_posts")') &&
      homePage.includes('.gt("expires_at", new Date().toISOString())') &&
      homePage.includes("<StoriesRail isSignedIn={isSignedIn} stories={visibleStories} />"),
  },
  {
    label: "plan records Stories as started for launch",
    ok:
      productPlan.includes("Stories: add temporary story posts") &&
      productPlan.includes("Started for launch with a 24-hour image/GIF story foundation"),
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
