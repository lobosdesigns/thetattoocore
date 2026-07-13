import { readFileSync } from "node:fs";

const actions = readFileSync("src/app/actions.ts", "utf8");
const gigRoute = readFileSync("src/app/api/gigs/route.ts", "utf8");
const composer = readFileSync("src/app/floating-composer.tsx", "utf8");
const mediaInput = readFileSync("src/app/media-input.tsx", "utf8");
const sensitiveGate = readFileSync("src/app/sensitive-content-gate.tsx", "utf8");
const signupPage = readFileSync("src/app/signup/page.tsx", "utf8");
const accountProfileForm = readFileSync("src/app/account/profile-form.tsx", "utf8");
const termsPage = readFileSync("src/app/terms/page.tsx", "utf8");
const privacyPage = readFileSync("src/app/privacy/page.tsx", "utf8");
const supportPage = readFileSync("src/app/support/page.tsx", "utf8");
const postDetailPage = readFileSync("src/app/p/[id]/page.tsx", "utf8");
const threadDetailPage = readFileSync("src/app/t/[id]/page.tsx", "utf8");
const commentMediaMigration = readFileSync(
  "supabase/migrations/20260713185241_comment_media_attachments.sql",
  "utf8",
);

const memberUploadSource = [composer, mediaInput].join("\n");
const policyCopySource = [
  signupPage,
  accountProfileForm,
  termsPage,
  privacyPage,
  supportPage,
].join("\n");
const forbiddenMemberUploadSnippets = [
  'name="is_sensitive"',
  'name="sensitive_reason"',
  "Mark sensitive",
  "Sensitive upload",
  "body-art nudity context",
];

const checks = [
  {
    label: "server create actions default new uploads to non-sensitive",
    ok:
      actions.includes("function sensitiveFields()") &&
      actions.includes("visible nudity is not allowed") &&
      actions.includes("is_sensitive: false") &&
      actions.includes("sensitive_reason: null") &&
      actions.includes("const sensitive = sensitiveFields()") &&
      actions.includes("is_indexable: visibility === \"public_preview\" && !sensitive.is_sensitive"),
  },
  {
    label: "gigs API create path defaults new uploads to non-sensitive",
    ok:
      gigRoute.includes("const isSensitive = false") &&
      gigRoute.includes("const safeSensitiveReason = null") &&
      gigRoute.includes("is_indexable: visibility === \"public_preview\" && !isSensitive") &&
      gigRoute.includes("is_sensitive: isSensitive") &&
      gigRoute.includes("sensitive_reason: safeSensitiveReason"),
  },
  {
    label: "member upload forms do not expose sensitive or nudity bypass fields",
    ok: forbiddenMemberUploadSnippets.every(
      (snippet) => !memberUploadSource.includes(snippet),
    ),
  },
  {
    label: "member upload copy reinforces optimization and launch video limits",
    ok:
      mediaInput.includes("Phone photos are resized before upload.") &&
      mediaInput.includes("Video upload is intentionally capped for now. More video features are coming soon.") &&
      mediaInput.includes("MP4/MOV preferred") &&
      composer.includes("video/mp4,video/quicktime"),
  },
  {
    label: "sensitive legacy gate requires login or adult confirmation",
    ok:
      sensitiveGate.includes("You must sign in to see content") &&
      sensitiveGate.includes("Confirm 18+ to see content") &&
      sensitiveGate.includes("Sensitive non-nude body-art media requires login and 18+ confirmation.") &&
      sensitiveGate.includes("/login?return_to=") &&
      sensitiveGate.includes("acceptAdultTerms"),
  },
  {
    label: "public policy copy keeps no-visible-nudity launch stance",
    ok:
      policyCopySource.includes("No visible nudity") &&
      policyCopySource.includes("No visible nudity for launch") &&
      policyCopySource.includes("visible nudity is not allowed") &&
      policyCopySource.includes("crop or cover") &&
      policyCopySource.includes("Pornography") &&
      policyCopySource.includes("sexual solicitation"),
  },
  {
    label: "comment media schema is authenticated, image-only, and size-limited",
    ok:
      commentMediaMigration.includes("create table if not exists public.post_comment_media") &&
      commentMediaMigration.includes("create table if not exists public.thread_comment_media") &&
      commentMediaMigration.includes("alter table public.post_comment_media enable row level security") &&
      commentMediaMigration.includes("alter table public.thread_comment_media enable row level security") &&
      commentMediaMigration.includes("media_type = 'image'") &&
      commentMediaMigration.includes("5242880") &&
      commentMediaMigration.includes("'image/gif'") &&
      commentMediaMigration.includes("grant select, insert, delete on public.post_comment_media to authenticated") &&
      commentMediaMigration.includes("grant select, insert, delete on public.thread_comment_media to authenticated") &&
      !commentMediaMigration.includes(" to anon"),
  },
  {
    label: "comment create actions accept optional photo and GIF attachments",
    ok:
      actions.includes("async function uploadCommentMedia") &&
      actions.includes('mediaFromForm(formData, "media")') &&
      actions.includes("Comment needs text, a photo, or a GIF.") &&
      actions.includes("Reply needs text, a photo, or a GIF.") &&
      actions.includes("Comments support photos and GIFs only.") &&
      actions.includes("Gossip comments support photos and GIFs only.") &&
      actions.includes("Comment images and GIFs can be up to 5 MB.") &&
      actions.includes('supabase.from("post_comment_media").insert') &&
      actions.includes('supabase.from("thread_comment_media").insert') &&
      actions.includes('supabase.rpc("delete_post_comment_for_current_user"') &&
      actions.includes('supabase.rpc("delete_thread_comment_for_current_user"'),
  },
  {
    label: "4U and Gossip detail pages render comment media with lightbox controls",
    ok:
      [postDetailPage, threadDetailPage].every(
        (source) =>
          source.includes("import { MediaInput }") &&
          source.includes("type CommentMedia") &&
          source.includes("function CommentMediaPreview") &&
          source.includes("MediaLightbox") &&
          source.includes("image/jpeg,image/png,image/webp,image/gif") &&
          source.includes("maxImageBytes={5 * 1024 * 1024}") &&
          source.includes("videoAllowed={false}"),
      ) &&
      postDetailPage.includes("post_comment_media(id, storage_bucket, storage_path, media_type, mime_type, width, height)") &&
      postDetailPage.includes("CommentMediaPreview media={comment.post_comment_media[0]}") &&
      threadDetailPage.includes("thread_comment_media(id, storage_bucket, storage_path, media_type, mime_type, width, height)") &&
      threadDetailPage.includes("CommentMediaPreview media={comment.thread_comment_media[0]}"),
  },
];

const failures = checks.filter((check) => !check.ok);

for (const check of checks) {
  console.log(`${check.ok ? "PASS" : "FAIL"} ${check.label}`);
}

if (failures.length) {
  console.error(`${failures.length} content policy guard smoke check(s) failed.`);
  process.exit(1);
}
