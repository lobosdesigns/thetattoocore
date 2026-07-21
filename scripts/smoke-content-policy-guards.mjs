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
const notificationsPage = readFileSync("src/app/notifications/page.tsx", "utf8");
const postDetailPage = readFileSync("src/app/p/[id]/page.tsx", "utf8");
const threadDetailPage = readFileSync("src/app/t/[id]/page.tsx", "utf8");
const profilePage = readFileSync("src/app/u/[username]/page.tsx", "utf8");
const stuffDetailPage = readFileSync("src/app/stuff/[id]/page.tsx", "utf8");
const gigsDetailPage = readFileSync("src/app/gigs/[id]/page.tsx", "utf8");
const merchDetailPage = readFileSync("src/app/merch/[id]/page.tsx", "utf8");
const contentReportForm = readFileSync("src/app/content-report-form.tsx", "utf8");
const commentMediaMigration = readFileSync(
  "supabase/migrations/20260713185241_comment_media_attachments.sql",
  "utf8",
);
const tightenedCommentMediaMigration = readFileSync(
  "supabase/migrations/20260713191332_tighten_comment_media_policies.sql",
  "utf8",
);
const feedPostTagMigration = readFileSync(
  "supabase/migrations/20260721135422_feed_post_user_tags.sql",
  "utf8",
);
const feedPostTagNotificationMigration = readFileSync(
  "supabase/migrations/20260721141027_feed_post_tag_notifications.sql",
  "utf8",
);
const threadPostTagMigration = readFileSync(
  "supabase/migrations/20260721170000_thread_post_user_tags.sql",
  "utf8",
);
const gigTagMigration = readFileSync(
  "supabase/migrations/20260721201000_gig_user_tags.sql",
  "utf8",
);
const contentOwnerNotificationCleanupMigration = readFileSync(
  "supabase/migrations/20260721215000_content_owner_notification_cleanup.sql",
  "utf8",
);
const commentTagMigration = readFileSync(
  "supabase/migrations/20260721223000_comment_user_tags.sql",
  "utf8",
);
const contentAudienceEnumMigration = readFileSync(
  "supabase/migrations/20260721152000_content_audience_enum.sql",
  "utf8",
);
const feedGossipAudienceMigration = readFileSync(
  "supabase/migrations/20260721152100_feed_gossip_audience_policies.sql",
  "utf8",
);
const artistShopAudienceEnumMigration = readFileSync(
  "supabase/migrations/20260721193000_artist_shop_content_audience_enum.sql",
  "utf8",
);
const artistShopAudiencePolicyMigration = readFileSync(
  "supabase/migrations/20260721193100_artist_shop_post_visibility_policies.sql",
  "utf8",
);
const commentPrivacyInsertPoliciesMigration = readFileSync(
  "supabase/migrations/20260721162000_comment_privacy_insert_policies.sql",
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
    label: "content reports support suspected AI-generated content reason",
    ok:
      actions.includes('"suspected ai-generated content"') &&
      contentReportForm.includes('value="suspected ai-generated content"') &&
      contentReportForm.includes("Suspected AI-generated content") &&
      contentReportForm.includes("suspected AI-generated"),
  },
  {
    label: "Gig edit and archive actions hide raw backend errors from member redirects",
    ok:
      actions.includes('console.error("Gig archive failed.", error)') &&
      actions.includes('"Could not archive gig. It may be gone or owned by another account."') &&
      actions.includes('console.error("Gig update failed.", error)') &&
      actions.includes('"Could not update Gig. It may be gone or owned by another account."') &&
      actions.includes('console.error("Gig detail archive failed.", error)') &&
      actions.includes('"Could not archive Gig. It may be gone or owned by another account."') &&
      !actions.includes('error?.message ||\n          "Could not archive gig. It may be gone or owned by another account."') &&
      !actions.includes('error?.message ||\n          "Could not update Gig. It may be gone or owned by another account."') &&
      !actions.includes('error?.message ||\n          "Could not archive Gig. It may be gone or owned by another account."'),
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
      actions.includes("async function commentPermissionForOwner") &&
      actions.includes("cleanCommentPermissionValue") &&
      actions.includes('mediaFromForm(formData, "media")') &&
      actions.includes("Comment needs text, a photo, or a GIF.") &&
      actions.includes("Reply needs text, a photo, or a GIF.") &&
      actions.includes("Only followers can comment on this member's posts.") &&
      actions.includes("This member has turned off comments.") &&
      actions.includes("4U comment post lookup failed.") &&
      actions.includes("Gossip comment thread lookup failed.") &&
      actions.includes("Comments support photos and GIFs only.") &&
      actions.includes("Gossip comments support photos and GIFs only.") &&
      actions.includes("Comment images and GIFs can be up to 5 MB.") &&
      actions.includes('supabase.from("post_comment_media").insert') &&
      actions.includes('supabase.from("thread_comment_media").insert') &&
      actions.includes('supabase.rpc("delete_post_comment_for_current_user"') &&
      actions.includes('supabase.rpc("delete_thread_comment_for_current_user"'),
  },
  {
    label: "4U and Gossip comments support member tagging with notifications",
    ok:
      commentTagMigration.includes("create table if not exists public.post_comment_tags") &&
      commentTagMigration.includes("create table if not exists public.thread_comment_tags") &&
      commentTagMigration.includes("alter table public.post_comment_tags enable row level security") &&
      commentTagMigration.includes("alter table public.thread_comment_tags enable row level security") &&
      commentTagMigration.includes('create policy "Visible post comment tags can be read"') &&
      commentTagMigration.includes('create policy "Authors tag own post comments"') &&
      commentTagMigration.includes('create policy "Visible thread comment tags can be read"') &&
      commentTagMigration.includes('create policy "Authors tag own thread comments"') &&
      commentTagMigration.includes('create policy "Comment owners can delete comment tag notifications"') &&
      commentTagMigration.includes("grant select on public.post_comment_tags to anon, authenticated") &&
      commentTagMigration.includes("grant insert, delete on public.thread_comment_tags to authenticated") &&
      commentTagMigration.includes("prevent_restricted_post_comment_tags") &&
      commentTagMigration.includes("prevent_restricted_thread_comment_tags") &&
      commentTagMigration.includes("'feed_comment_tag'") &&
      commentTagMigration.includes("'thread_comment_tag'") &&
      actions.includes("async function syncCommentTags") &&
      actions.includes('tagTable: "post_comment_tags"') &&
      actions.includes('tagTable: "thread_comment_tags"') &&
      actions.includes('type: "feed_comment_tag"') &&
      actions.includes('type: "thread_comment_tag"') &&
      actions.includes('subjectType: "post_comment"') &&
      actions.includes('subjectType: "thread_comment"') &&
      actions.includes('formData.get("tagged_usernames")') &&
      postDetailPage.includes("post_comment_tags(profiles:profiles!post_comment_tags_tagged_profile_id_fkey") &&
      postDetailPage.includes("function CommentTaggedMemberLinks") &&
      postDetailPage.includes("<CommentTaggedMemberLinks") &&
      postDetailPage.includes('name="tagged_usernames"') &&
      threadDetailPage.includes("thread_comment_tags(profiles:profiles!thread_comment_tags_tagged_profile_id_fkey") &&
      threadDetailPage.includes("function CommentTaggedMemberLinks") &&
      threadDetailPage.includes("<CommentTaggedMemberLinks") &&
      threadDetailPage.includes('name="tagged_usernames"') &&
      notificationsPage.includes('| "feed_comment_tag"') &&
      notificationsPage.includes('| "thread_comment_tag"') &&
      notificationsPage.includes('type === "feed_comment_tag"') &&
      notificationsPage.includes('if (notification.subject_type === "post_comment")') &&
      notificationsPage.includes('if (notification.subject_type === "thread_comment")'),
  },
  {
    label: "comment insert policies enforce profile comment privacy",
    ok:
      commentPrivacyInsertPoliciesMigration.includes(
        'drop policy if exists "Users can comment on visible posts" on public.post_comments',
      ) &&
      commentPrivacyInsertPoliciesMigration.includes(
        'drop policy if exists "Users can comment on visible threads" on public.thread_comments',
      ) &&
      commentPrivacyInsertPoliciesMigration.includes(
        "join public.profiles post_owner on post_owner.id = feed_posts.author_id",
      ) &&
      commentPrivacyInsertPoliciesMigration.includes(
        "join public.profiles thread_owner on thread_owner.id = thread_posts.author_id",
      ) &&
      commentPrivacyInsertPoliciesMigration.includes(
        "coalesce(post_owner.comment_permission, 'everyone') = 'everyone'",
      ) &&
      commentPrivacyInsertPoliciesMigration.includes(
        "post_owner.comment_permission = 'followers'",
      ) &&
      commentPrivacyInsertPoliciesMigration.includes(
        "thread_owner.comment_permission = 'followers'",
      ) &&
      commentPrivacyInsertPoliciesMigration.includes("follows.status = 'accepted'") &&
      commentPrivacyInsertPoliciesMigration.includes(
        "feed_posts.author_id = (select auth.uid())",
      ) &&
      commentPrivacyInsertPoliciesMigration.includes(
        "thread_posts.author_id = (select auth.uid())",
      ) &&
      !commentPrivacyInsertPoliciesMigration.includes("security definer") &&
      !commentPrivacyInsertPoliciesMigration.includes("auth.role()"),
  },
  {
    label: "comment actions hide raw create, media, like, edit, delete, and hide errors",
    ok:
      actions.includes('console.error("Comment media upload failed.", error)') &&
      !actions.includes('error: error.message || "Could not upload comment media."') &&
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
    label: "4U posts support tagged member links with RLS-backed schema",
    ok:
      feedPostTagMigration.includes("create table if not exists public.feed_post_tags") &&
      feedPostTagMigration.includes("alter table public.feed_post_tags enable row level security") &&
      feedPostTagMigration.includes('create policy "Visible feed post tags can be read"') &&
      feedPostTagMigration.includes('create policy "Authors tag own feed posts"') &&
      feedPostTagMigration.includes("grant select on public.feed_post_tags to anon, authenticated") &&
      feedPostTagMigration.includes("grant insert, delete on public.feed_post_tags to authenticated") &&
      feedPostTagMigration.includes("prevent_restricted_feed_post_tags") &&
      actions.includes("function cleanTaggedUsernames") &&
      actions.includes("async function syncFeedPostTags") &&
      actions.includes('formData.get("tagged_usernames")') &&
      actions.includes('.from("feed_post_tags")') &&
      composer.includes('name="tagged_usernames"') &&
      composer.includes("Tag members: @artistname, @shopname") &&
      homePage.includes("function TaggedMemberLinks") &&
      homePage.includes("feed_post_tags(profiles:profiles!feed_post_tags_tagged_profile_id_fkey") &&
      postDetailPage.includes("function TaggedMemberLinks") &&
      postDetailPage.includes("feed_post_tags(profiles:profiles!feed_post_tags_tagged_profile_id_fkey") &&
      postDetailPage.includes('name="tagged_usernames"'),
  },
  {
    label: "4U and Gossip composer expose public and followers-only audiences",
    ok:
      composer.includes("Followers only") &&
      composer.includes("Visible to accepted followers and you.") &&
      composer.includes("Choose Public for everyone, Followers only") &&
      composer.includes("Choose Public for everyone, Followers only for accepted followers") &&
      composer.includes('value: "followers"') &&
      actions.includes("FEED_VISIBILITY_VALUES") &&
      actions.includes("THREAD_VISIBILITY_VALUES") &&
      actions.includes('"followers"') &&
      homePage.includes('visibility === "followers" ? "Followers" : null') &&
      postDetailPage.includes('post.visibility !== "public_preview" && !viewer.isSignedIn') &&
      threadDetailPage.includes('thread.visibility !== "public_preview" && !viewer.isSignedIn'),
  },
  {
    label: "Gossip supports verified artist and vendor audience with server and RLS guards",
    ok:
      contentAudienceEnumMigration.includes("'verified_professionals'") &&
      feedGossipAudienceMigration.includes("current_user_is_verified_artist_or_vendor") &&
      feedGossipAudienceMigration.includes("viewer.account_type in ('artist', 'vendor')") &&
      feedGossipAudienceMigration.includes("viewer.license_verified_at is not null") &&
      feedGossipAudienceMigration.includes("visibility <> 'verified_professionals'") &&
      feedGossipAudienceMigration.includes("current_user_can_view_thread_post") &&
      feedGossipAudienceMigration.includes("current_user_can_interact_with_thread_post") &&
      composer.includes("Verified artists and vendors") &&
      actions.includes("canPostVerifiedGossipAudience") &&
      actions.includes('visibility === "verified_professionals"') &&
      actions.includes("Verified artist and vendor Gossip posts require a verified artist or vendor account."),
  },
  {
    label: "4U and Gossip support verified artist/shop-only audience with server and RLS guards",
    ok:
      artistShopAudienceEnumMigration.includes("'verified_artists_shops'") &&
      artistShopAudiencePolicyMigration.includes("current_user_is_verified_artist_or_shop") &&
      artistShopAudiencePolicyMigration.includes("viewer.account_type in ('artist', 'studio')") &&
      artistShopAudiencePolicyMigration.includes("viewer.license_verified_at is not null") &&
      artistShopAudiencePolicyMigration.includes("current_user_can_view_feed_post") &&
      artistShopAudiencePolicyMigration.includes("current_user_can_view_thread_post") &&
      artistShopAudiencePolicyMigration.includes("visibility <> 'verified_artists_shops'") &&
      composer.includes("Artists and shops only") &&
      composer.includes("Visible only to verified artists and shops.") &&
      actions.includes("canPostVerifiedArtistShopAudience") &&
      actions.includes('visibility === "verified_artists_shops"') &&
      homePage.includes('visibility === "verified_artists_shops" ? "Artists and shops only" : null'),
  },
  {
    label: "feed and Gossip RLS policies inherit followers and professional audience visibility",
    ok:
      contentAudienceEnumMigration.includes("'followers'") &&
      feedGossipAudienceMigration.includes("current_user_is_accepted_follower") &&
      feedGossipAudienceMigration.includes("follows.status = 'accepted'") &&
      feedGossipAudienceMigration.includes("current_user_can_view_feed_post") &&
      feedGossipAudienceMigration.includes("current_user_can_interact_with_feed_post") &&
      feedGossipAudienceMigration.includes("Visible feed media can be read") &&
      feedGossipAudienceMigration.includes("Visible feed post tags can be read") &&
      feedGossipAudienceMigration.includes("Members can read visible post comment media") &&
      feedGossipAudienceMigration.includes("Thread media follows thread visibility") &&
      feedGossipAudienceMigration.includes("Members can read visible thread comment media") &&
      feedGossipAudienceMigration.includes("post_visibility = 'followers'") &&
      feedGossipAudienceMigration.includes("post_visibility = 'verified_professionals'") &&
      artistShopAudiencePolicyMigration.includes("post_visibility = 'verified_artists_shops'"),
  },
  {
    label: "4U post tags notify newly tagged members through feed preferences",
    ok:
      feedPostTagNotificationMigration.includes("notifications_type_check") &&
      feedPostTagNotificationMigration.includes("'feed_tag'") &&
      actions.includes("const existingTaggedIds = new Set") &&
      actions.includes("const newTagRows = rows.filter") &&
      actions.includes('title: "Tagged in a 4U post"') &&
      actions.includes('type: "feed_tag"') &&
      actions.includes('href: `/p/${postId}`') &&
      actions.includes('type === "feed_like"') &&
      actions.includes('type === "feed_comment"') &&
      actions.includes('type === "feed_tag"') &&
      actions.includes("notifyContentOwner({") &&
      notificationsPage.includes('| "feed_tag"') &&
      notificationsPage.includes('type === "feed_comment_tag"') &&
      notificationsPage.includes('type === "thread_comment_tag"'),
  },
  {
    label: "Gossip post tags are RLS-backed, visible, editable, and notify tagged members",
    ok:
      threadPostTagMigration.includes("create table if not exists public.thread_post_tags") &&
      threadPostTagMigration.includes("alter table public.thread_post_tags enable row level security") &&
      threadPostTagMigration.includes('create policy "Visible thread post tags can be read"') &&
      threadPostTagMigration.includes('create policy "Authors tag own thread posts"') &&
      threadPostTagMigration.includes('create policy "Authors remove own thread post tags"') &&
      threadPostTagMigration.includes("public.current_user_can_view_thread_post") &&
      threadPostTagMigration.includes("grant select on public.thread_post_tags to anon, authenticated") &&
      threadPostTagMigration.includes("grant insert, delete on public.thread_post_tags to authenticated") &&
      threadPostTagMigration.includes("prevent_restricted_thread_post_tags") &&
      threadPostTagMigration.includes("'thread_tag'") &&
      actions.includes("async function syncThreadPostTags") &&
      actions.includes('.from("thread_post_tags")') &&
      actions.includes('title: "Tagged in Gossip"') &&
      actions.includes('type: "thread_tag"') &&
      actions.includes('href: `/t/${threadId}`') &&
      actions.includes('type === "feed_tag"') &&
      composer.includes("Tag members: @artistname, @shopname") &&
      composer.includes("canPostVerifiedGossipAudience") &&
      homePage.includes("thread_post_tags(profiles:profiles!thread_post_tags_tagged_profile_id_fkey") &&
      homePage.includes("<TaggedMemberLinks tags={thread.thread_post_tags ?? []} />") &&
      homePage.includes('name="tagged_usernames"') &&
      threadDetailPage.includes("function TaggedMemberLinks") &&
      threadDetailPage.includes("thread_post_tags(profiles:profiles!thread_post_tags_tagged_profile_id_fkey") &&
      threadDetailPage.includes("<TaggedMemberLinks tags={thread.thread_post_tags ?? []} />") &&
      threadDetailPage.includes('name="tagged_usernames"') &&
      profilePage.includes("thread_post_tags(profiles:profiles!thread_post_tags_tagged_profile_id_fkey") &&
      profilePage.includes("<TaggedMemberLinks tags={thread.thread_post_tags ?? []} />") &&
      notificationsPage.includes('| "thread_tag"') &&
      notificationsPage.includes('type === "feed_comment_tag"') &&
      notificationsPage.includes('type === "thread_comment_tag"'),
  },
  {
    label: "Gigs support tagged member links with RLS-backed schema and notifications",
    ok:
      gigTagMigration.includes("create table if not exists public.gig_tags") &&
      gigTagMigration.includes("alter table public.gig_tags enable row level security") &&
      gigTagMigration.includes('create policy "Visible gig tags can be read"') &&
      gigTagMigration.includes('create policy "Authors tag own gigs"') &&
      gigTagMigration.includes('create policy "Authors remove own gig tags"') &&
      gigTagMigration.includes("grant select on public.gig_tags to anon, authenticated") &&
      gigTagMigration.includes("grant insert, delete on public.gig_tags to authenticated") &&
      gigTagMigration.includes("prevent_restricted_gig_tags") &&
      gigTagMigration.includes("notifications_type_check") &&
      gigTagMigration.includes("'gig_tag'") &&
      actions.includes("async function syncGigTags") &&
      actions.includes('.from("gig_tags")') &&
      actions.includes('title: "Tagged in a Gig"') &&
      actions.includes('type: "gig_tag"') &&
      actions.includes('href: `/gigs/${gigId}`') &&
      actions.includes('type === "gig_tag"') &&
      gigRoute.includes('formData.get("tagged_usernames")') &&
      gigRoute.includes('.from("gig_tags")') &&
      gigRoute.includes('type: "gig_tag"') &&
      gigRoute.includes('notificationPreferenceSelect("marketplace_gig")') &&
      gigRoute.includes("blockRelationshipExists") &&
      composer.includes('name="tagged_usernames"') &&
      composer.includes("Tag members: @artistname, @shopname") &&
      homePage.includes("gig_tags(profiles:profiles!gig_tags_tagged_profile_id_fkey") &&
      homePage.includes("<TaggedMemberLinks tags={gig.gig_tags ?? []} />") &&
      gigsDetailPage.includes("function TaggedMemberLinks") &&
      gigsDetailPage.includes("gig_tags(profiles:profiles!gig_tags_tagged_profile_id_fkey") &&
      gigsDetailPage.includes("<TaggedMemberLinks tags={gig.gig_tags ?? []} />") &&
      gigsDetailPage.includes('name="tagged_usernames"') &&
      profilePage.includes("gig_tags(profiles:profiles!gig_tags_tagged_profile_id_fkey") &&
      profilePage.includes("<TaggedMemberLinks tags={gig.gig_tags ?? []} />") &&
      notificationsPage.includes('| "gig_tag"') &&
      notificationsPage.includes('type === "gig_tag"') &&
      notificationsPage.includes('type === "thread_comment_tag"') &&
      notificationsPage.includes('return notification.href || `/gigs/${notification.subject_id}`'),
  },
  {
    label: "deleted or untagged 4U, Gossip, and Gig content cleans stale notifications",
    ok:
      contentOwnerNotificationCleanupMigration.includes(
        'create policy "Content owners can delete subject notifications"',
      ) &&
      contentOwnerNotificationCleanupMigration.includes("subject_type = 'feed_post'") &&
      contentOwnerNotificationCleanupMigration.includes("feed_posts.author_id = (select auth.uid())") &&
      contentOwnerNotificationCleanupMigration.includes("subject_type = 'thread_post'") &&
      contentOwnerNotificationCleanupMigration.includes("thread_posts.author_id = (select auth.uid())") &&
      contentOwnerNotificationCleanupMigration.includes("subject_type = 'gig'") &&
      contentOwnerNotificationCleanupMigration.includes("gigs.poster_id = (select auth.uid())") &&
      actions.includes("async function cleanupRemovedTagNotifications") &&
      actions.includes("async function cleanupSubjectNotifications") &&
      actions.includes('type: "feed_tag"') &&
      actions.includes('type: "thread_tag"') &&
      actions.includes('type: "gig_tag"') &&
      actions.includes('subjectType: "feed_post"') &&
      actions.includes('subjectType: "thread_post"') &&
      actions.includes('subjectType: "gig"') &&
      actions.includes('revalidatePath("/notifications")'),
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
