import { readFileSync } from "node:fs";

const actions = readFileSync("src/app/actions.ts", "utf8");
const gigRoute = readFileSync("src/app/api/gigs/route.ts", "utf8");
const composer = readFileSync("src/app/floating-composer.tsx", "utf8");
const mediaInput = readFileSync("src/app/media-input.tsx", "utf8");
const sensitiveGate = readFileSync("src/app/sensitive-content-gate.tsx", "utf8");
const signupPage = readFileSync("src/app/signup/page.tsx", "utf8");
const accountProfileForm = readFileSync("src/app/account/profile-form.tsx", "utf8");
const productPlan = readFileSync("docs/PRODUCT_PLAN.md", "utf8");
const termsPage = readFileSync("src/app/terms/page.tsx", "utf8");
const privacyPage = readFileSync("src/app/privacy/page.tsx", "utf8");
const supportPage = readFileSync("src/app/support/page.tsx", "utf8");
const homePage = readFileSync("src/app/page.tsx", "utf8");
const postDetailPage = readFileSync("src/app/p/[id]/page.tsx", "utf8");
const threadDetailPage = readFileSync("src/app/t/[id]/page.tsx", "utf8");
const stuffDetailPage = readFileSync("src/app/stuff/[id]/page.tsx", "utf8");
const gigsDetailPage = readFileSync("src/app/gigs/[id]/page.tsx", "utf8");
const merchDetailPage = readFileSync("src/app/merch/[id]/page.tsx", "utf8");
const commentMediaMigration = readFileSync(
  "supabase/migrations/20260713185241_comment_media_attachments.sql",
  "utf8",
);
const tightenedCommentMediaMigration = readFileSync(
  "supabase/migrations/20260713191332_tighten_comment_media_policies.sql",
  "utf8",
);

const memberUploadSource = [composer, mediaInput].join("\n");
const currentCreateCopySource = [actions, composer].join("\n");
const staleCreateLabels = [
  "Feed post needs",
  "Feed posts need",
  "Feed post published",
  "Could not publish feed",
  "Thread post needs",
  "Thread posts support",
  "Thread posted",
  "Could not publish thread",
  "Marketplace listing published",
  "Listing title needs",
];
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
  "managed video pipeline",
  "private video tools",
  "Cloudflare",
  "Supabase",
  "server",
  "Stream",
];
const commentActionNames = [
  "createPostComment",
  "togglePostCommentLike",
  "editPostComment",
  "deletePostComment",
  "hidePostComment",
  "blockPostCommentAuthor",
  "createThreadComment",
  "toggleThreadCommentLike",
  "editThreadComment",
  "deleteThreadComment",
  "hideThreadComment",
  "blockThreadCommentAuthor",
];

function actionBody(name) {
  const start = actions.indexOf(`export async function ${name}`);
  if (start === -1) return "";

  const next = actions.indexOf("\nexport async function ", start + 1);

  return actions.slice(start, next === -1 ? undefined : next);
}

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
    label: "gigs API create path hides raw publish and upload errors",
    ok:
      gigRoute.includes('console.error("Gig publish failed.", error)') &&
      gigRoute.includes('"Could not publish gig. Please try again."') &&
      gigRoute.includes('console.error("Gig image upload failed.", uploadError)') &&
      gigRoute.includes('"Gig was created, but the image could not upload."') &&
      gigRoute.includes('console.error("Gig image attach failed.", mediaError)') &&
      gigRoute.includes('"Gig was created, but the image could not attach."') &&
      !gigRoute.includes('error?.message || "Could not publish gig."') &&
      !gigRoute.includes('uploadError.message || "Gig created, but image upload failed."') &&
      !gigRoute.includes('mediaError.message || "Gig created, but image could not attach."'),
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
      mediaInput.includes("Video upload is capped for now. Keep clips short, clear, and ready for review.") &&
      mediaInput.includes("Use short MP4/MOV clips.") &&
      mediaInput.includes("Videos keep their original quality") &&
      mediaInput.includes("Video will keep its original quality. Keep it short") &&
      !mediaInput.includes("Videos stay raw for now") &&
      !mediaInput.includes("Video will upload as-is for now") &&
      mediaInput.includes("MP4/MOV preferred") &&
      composer.includes("video/mp4,video/quicktime"),
  },
  {
    label: "shared image uploads expose crop tools before upload",
    ok:
      mediaInput.includes('type CropAspect = "original" | "square" | "portrait" | "landscape" | "banner"') &&
      mediaInput.includes("function cropRectForImage") &&
      mediaInput.includes("function cropPreviewAspectRatio") &&
      mediaInput.includes("async function cropAndCompressImageFile") &&
      mediaInput.includes("Edit crop") &&
      mediaInput.includes("Crop preview") &&
      mediaInput.includes("Preview the framing, then apply before publishing.") &&
      mediaInput.includes("Apply crop") &&
      mediaInput.includes("Left / right focus") &&
      mediaInput.includes("Up / down focus") &&
      mediaInput.includes("const inputRef = useRef<HTMLInputElement>(null)") &&
      accountProfileForm.includes("<MediaInput") &&
      productPlan.includes("Image upload flows should let members adjust photos") &&
      productPlan.includes("Private license/business verification documents should stay unedited evidence uploads"),
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
    label: "public policy copy keeps no-visible-nudity stance",
    ok:
      policyCopySource.includes("No visible nudity") &&
      policyCopySource.includes("No visible nudity.") &&
      policyCopySource.includes("visible nudity is not allowed") &&
      policyCopySource.includes("crop or cover") &&
      policyCopySource.includes("Pornography") &&
      policyCopySource.includes("sexual solicitation"),
  },
  {
    label: "create-flow copy uses 4U, Gossip, and Stuff launch labels",
    ok:
      currentCreateCopySource.includes("4U caption needs at least 3 characters.") &&
      currentCreateCopySource.includes("4U posts need a photo or reel.") &&
      currentCreateCopySource.includes("Gossip post needs at least 3 characters.") &&
      currentCreateCopySource.includes("Gossip posts support images right now.") &&
      currentCreateCopySource.includes("Stuff title needs at least 3 characters.") &&
      staleCreateLabels.every((label) => !currentCreateCopySource.includes(label)),
  },
  {
    label: "4U post and saved actions hide raw backend errors from member redirects",
    ok:
      actions.includes("console.error(`${kind} media upload failed.`, error)") &&
      actions.includes('"Could not upload media. Please try again."') &&
      actions.includes('console.error("4U post publish failed.", error)') &&
      actions.includes('"Could not publish 4U post. Please try again."') &&
      actions.includes('console.error("4U post media attach failed.", mediaError)') &&
      actions.includes('"Media uploaded but could not attach to the post. Please try again."') &&
      actions.includes('console.error("4U post edit failed.", error)') &&
      actions.includes('"Could not edit 4U post. It may be gone or owned by another account."') &&
      actions.includes('console.error("4U post delete failed.", error)') &&
      actions.includes('"Could not delete 4U post. It may be gone or owned by another account."') &&
      actions.includes('console.error("4U post like failed.", result.error)') &&
      actions.includes('"Could not update like. Please try again."') &&
      actions.includes('console.error("Saved item update failed.", result.error)') &&
      actions.includes('"Could not update saved item. Please try again."') &&
      !actions.includes('error.message || "Could not upload media."') &&
      !actions.includes('error.message || "Could not publish 4U post."') &&
      !actions.includes('mediaError.message || "Media uploaded but could not attach to the post."') &&
      !actions.includes('error?.message ||\n          "Could not edit 4U post. It may be gone or owned by another account."') &&
      !actions.includes('error?.message ||\n          "Could not delete 4U post. It may be gone or owned by another account."') &&
      !actions.includes('result.error.message || "Could not update like."') &&
      !actions.includes('result.error.message || "Could not update saved item."'),
  },
  {
    label: "Gossip and Stuff create actions hide raw backend errors from member redirects",
    ok:
      actions.includes('console.error("Gossip post publish failed.", error)') &&
      actions.includes('"Could not publish Gossip post. Please try again."') &&
      actions.includes('console.error("Gossip post media attach failed.", mediaError)') &&
      actions.includes('"Image uploaded but could not attach to the Gossip post. Please try again."') &&
      actions.includes('console.error("Stuff listing publish failed.", error)') &&
      actions.includes('"Could not publish Stuff listing. Please try again."') &&
      actions.includes('console.error("Stuff listing media attach failed.", mediaError)') &&
      actions.includes('"Media uploaded but could not attach to the Stuff listing. Please try again."') &&
      !actions.includes('error.message || "Could not publish Gossip post."') &&
      !actions.includes('mediaError.message ||\n            "Image uploaded but could not attach to the Gossip post."') &&
      !actions.includes('error.message || "Could not publish Stuff listing."') &&
      !actions.includes('mediaError.message ||\n            "Media uploaded but could not attach to the Stuff listing."'),
  },
  {
    label: "Gossip edit delete and like actions hide raw backend errors from member redirects",
    ok:
      actions.includes('console.error("Gossip post edit failed.", error)') &&
      actions.includes('"Could not edit Gossip post. It may be gone or owned by another account."') &&
      actions.includes('console.error("Gossip post delete failed.", error)') &&
      actions.includes('"Could not delete Gossip post. It may be gone or owned by another account."') &&
      actions.includes('console.error("Gossip post like failed.", result.error)') &&
      actions.includes('"Could not update Gossip like. Please try again."') &&
      !actions.includes('error?.message ||\n          "Could not edit Gossip post. It may be gone or owned by another account."') &&
      !actions.includes('error?.message ||\n          "Could not delete Gossip post. It may be gone or owned by another account."') &&
      !actions.includes('result.error.message || "Could not update thread like."'),
  },
  {
    label: "Stuff edit and archive actions hide raw backend errors from member redirects",
    ok:
      actions.includes('console.error("Stuff listing update failed.", error)') &&
      actions.includes('"Could not update Stuff listing. It may be gone or owned by another account."') &&
      actions.includes('console.error("Stuff listing archive failed.", error)') &&
      actions.includes('"Could not archive Stuff listing. It may be gone or owned by another account."') &&
      !actions.includes('error?.message ||\n          "Could not update Stuff listing. It may be gone or owned by another account."') &&
      !actions.includes('error?.message ||\n          "Could not archive Stuff listing. It may be gone or owned by another account."'),
  },
  {
    label: "content report action hides raw backend errors from member redirects",
    ok:
      actions.includes('console.error("Content report create failed.", error)') &&
      actions.includes('"You already have an open report for that item."') &&
      actions.includes('"Could not send report. Please try again."') &&
      !actions.includes('error.message || "Could not send report."'),
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
    label: "comment media policies inherit parent visibility and hidden-comment guards",
    ok:
      tightenedCommentMediaMigration.includes("join public.feed_posts") &&
      tightenedCommentMediaMigration.includes("join public.thread_posts") &&
      tightenedCommentMediaMigration.includes("post_comments.deleted_at is null") &&
      tightenedCommentMediaMigration.includes("thread_comments.deleted_at is null") &&
      tightenedCommentMediaMigration.includes("post_comment_hides") &&
      tightenedCommentMediaMigration.includes("thread_comment_hides") &&
      tightenedCommentMediaMigration.includes("adult_terms_accepted_at is not null") &&
      tightenedCommentMediaMigration.includes("feed_posts.moderation_status = 'active'") &&
      tightenedCommentMediaMigration.includes("thread_posts.moderation_status = 'active'") &&
      tightenedCommentMediaMigration.includes("feed_posts.author_id = (select auth.uid())") &&
      tightenedCommentMediaMigration.includes("thread_posts.author_id = (select auth.uid())"),
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
    label: "comment actions hide raw create, media, like, edit, delete, and hide errors",
    ok:
      actions.includes('console.error("4U comment media upload failed.", upload?.error)') &&
      actions.includes('"Could not upload comment media. Please try again."') &&
      actions.includes('console.error("4U comment create failed.", error)') &&
      actions.includes('"Could not add comment. Please try again."') &&
      actions.includes('console.error("4U comment media attach failed.", mediaError)') &&
      actions.includes('"Could not attach comment media. Please try again."') &&
      actions.includes('console.error("4U comment like failed.", result.error)') &&
      actions.includes('"Could not update comment like. Please try again."') &&
      actions.includes('console.error("4U comment edit failed.", error)') &&
      actions.includes('"Could not edit comment. Please try again."') &&
      actions.includes('console.error("4U comment delete failed.", error)') &&
      actions.includes('"Could not delete comment. Please try again."') &&
      actions.includes('console.error("4U comment hide failed.", error)') &&
      actions.includes('"Could not hide comment. Please try again."') &&
      actions.includes('console.error("Gossip comment media upload failed.", upload?.error)') &&
      actions.includes('console.error("Gossip comment create failed.", error)') &&
      actions.includes('"Could not add thread comment. Please try again."') &&
      actions.includes('console.error("Gossip comment media attach failed.", mediaError)') &&
      actions.includes('console.error("Gossip comment like failed.", result.error)') &&
      actions.includes('console.error("Gossip comment edit failed.", error)') &&
      actions.includes('console.error("Gossip comment delete failed.", error)') &&
      actions.includes('console.error("Gossip comment hide failed.", error)') &&
      !actions.includes('upload?.error || "Could not upload comment media."') &&
      !actions.includes('error.message || "Could not add comment."') &&
      !actions.includes('mediaError.message || "Could not attach comment media."') &&
      !actions.includes('result.error.message || "Could not update comment like."') &&
      !actions.includes('error.message || "Could not edit comment."') &&
      !actions.includes('error.message || "Could not delete comment."') &&
      !actions.includes('error.message || "Could not hide comment."') &&
      !actions.includes('error.message || "Could not add thread comment."'),
  },
  {
    label: "comment actions sanitize return paths before redirect and revalidation",
    ok:
      actions.includes("function cleanReturnPath") &&
      actions.includes("function revalidateReturnPath") &&
      commentActionNames.every((name) => {
        const body = actionBody(name);

        return (
          body.includes("cleanReturnPath(formData.get(\"return_path\")") &&
          body.includes("revalidateReturnPath(returnPath)") &&
          !body.includes("revalidatePath(returnPath)")
        );
      }),
  },
  {
    label: "home ranking filters blocked profiles before personalization",
    ok:
      homePage.includes('from("user_blocks")') &&
      homePage.includes("blocker_id.eq.") &&
      homePage.includes("blocked_id.eq.") &&
      homePage.includes("const blockedProfileIds = new Set") &&
      homePage.includes("const feedFetchLimit = feedLimit + pageSize") &&
      homePage.includes("const gossipFetchLimit = gossipLimit + pageSize") &&
      homePage.includes("const rankedFeedPosts = rankFeedPosts") &&
      homePage.includes("const visibleFeedPosts = rankedFeedPosts.slice(0, feedLimit)") &&
      homePage.includes("const hasMoreFeed =") &&
      homePage.includes("(feedPosts?.length ?? 0) === feedFetchLimit") &&
      homePage.includes("function profileIsNotBlocked") &&
      homePage.includes("unblockedFeedPosts") &&
      homePage.includes("unblockedThreadPosts") &&
      homePage.includes("unblockedListings") &&
      homePage.includes("unblockedGigs") &&
      homePage.includes("unblockedMerchProducts") &&
      homePage.includes("unblockedStories") &&
      homePage.includes("feedPosts: unblockedFeedPosts") &&
      homePage.includes("threadPosts: unblockedThreadPosts"),
  },
  {
    label: "direct detail pages hide blocked profile content",
    ok:
      [
        postDetailPage,
        threadDetailPage,
        stuffDetailPage,
        gigsDetailPage,
        merchDetailPage,
      ].every(
        (source) =>
          source.includes("async function hasBlockRelationship") &&
          source.includes('from("user_blocks")') &&
          source.includes("blocker_id.eq.") &&
          source.includes("blocked_id.eq.") &&
          source.includes("notFound();"),
      ) &&
      postDetailPage.includes("!isOwnPost") &&
      threadDetailPage.includes("!isOwnThread") &&
      stuffDetailPage.includes("!isOwnListing") &&
      gigsDetailPage.includes("!isOwnGig") &&
      merchDetailPage.includes("!product.is_official") &&
      merchDetailPage.includes("!isOwnProduct"),
  },
  {
    label: "4U and Gossip detail comments hide blocked profiles",
    ok:
      [postDetailPage, threadDetailPage].every(
        (source) =>
          source.includes("async function getBlockedProfileIds") &&
          source.includes("const blockedCommentProfileIds") &&
          source.includes("const commentFetchLimit = commentLimit + commentsPageSize") &&
          source.includes(".is(\"parent_id\", null)") &&
          source.includes(".limit(commentFetchLimit)") &&
          source.includes("const visibleTopLevelIds = visibleTopLevelComments.map") &&
          source.includes(".in(\"parent_id\", visibleTopLevelIds)") &&
          source.includes("visibleComments: [...visibleTopLevelComments, ...visibleReplies]") &&
          source.includes("blockedCommentProfileIds.has(comment.profiles.id)") &&
          source.includes("comment.profiles.id === userId"),
      ),
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
      postDetailPage.includes("const commentMedia = asArray(comment.post_comment_media)") &&
      postDetailPage.includes("CommentMediaPreview media={commentMedia[0]}") &&
      threadDetailPage.includes("thread_comment_media(id, storage_bucket, storage_path, media_type, mime_type, width, height)") &&
      threadDetailPage.includes("const commentMedia = asArray(comment.thread_comment_media)") &&
      threadDetailPage.includes("CommentMediaPreview media={commentMedia[0]}"),
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
