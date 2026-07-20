import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const authLogin = readFileSync("src/app/auth/login/route.ts", "utf8");
const legacyLoginActions = readFileSync("src/app/login/actions.ts", "utf8");
const authSignup = readFileSync("src/app/auth/signup/route.ts", "utf8");
const authConfirm = readFileSync("src/app/auth/confirm/route.ts", "utf8");
const authResendConfirmation = readFileSync(
  "src/app/auth/resend-confirmation/route.ts",
  "utf8",
);
const forgotPasswordActions = readFileSync("src/app/forgot-password/actions.ts", "utf8");
const forgotPasswordPage = readFileSync("src/app/forgot-password/page.tsx", "utf8");
const resetPasswordActions = readFileSync("src/app/reset-password/actions.ts", "utf8");
const resetPasswordForm = readFileSync(
  "src/app/reset-password/reset-password-form.tsx",
  "utf8",
);
const adClickRoute = readFileSync("src/app/api/ad-click/route.ts", "utf8");
const loginPage = readFileSync("src/app/login/page.tsx", "utf8");
const signupPage = readFileSync("src/app/signup/page.tsx", "utf8");
const notificationActions = readFileSync("src/app/notifications/actions.ts", "utf8");
const notificationBell = readFileSync("src/app/notification-bell-link.tsx", "utf8");
const notificationPage = readFileSync("src/app/notifications/page.tsx", "utf8");
const mainActions = readFileSync("src/app/actions.ts", "utf8");
const messageActions = readFileSync("src/app/messages/actions.ts", "utf8");
const messagePage = readFileSync("src/app/messages/page.tsx", "utf8");
const messageThread = readFileSync("src/app/messages/message-thread.tsx", "utf8");
const publicSmoke = readFileSync("scripts/smoke-public-routes.mjs", "utf8");
const urls = readFileSync("src/lib/urls.ts", "utf8");
const profilePage = readFileSync("src/app/u/[username]/page.tsx", "utf8");
const profileActions = readFileSync("src/app/u/[username]/actions.ts", "utf8");
const gigsDetailPage = readFileSync("src/app/gigs/[id]/page.tsx", "utf8");
const postDetailPage = readFileSync("src/app/p/[id]/page.tsx", "utf8");
const stuffDetailPage = readFileSync("src/app/stuff/[id]/page.tsx", "utf8");
const threadDetailPage = readFileSync("src/app/t/[id]/page.tsx", "utf8");
const homePage = readFileSync("src/app/page.tsx", "utf8");
const termsPage = readFileSync("src/app/terms/page.tsx", "utf8");
const privacyPage = readFileSync("src/app/privacy/page.tsx", "utf8");
const supportPage = readFileSync("src/app/support/page.tsx", "utf8");
const settingsPage = readFileSync("src/app/settings/page.tsx", "utf8");
const accountActions = readFileSync("src/app/account/actions.ts", "utf8");
const accountPage = readFileSync("src/app/account/page.tsx", "utf8");
const accountSettingsWorkspace = readFileSync(
  "src/app/account/account-settings-workspace.tsx",
  "utf8",
);
const profileForm = readFileSync("src/app/account/profile-form.tsx", "utf8");
const mediaInput = readFileSync("src/app/media-input.tsx", "utf8");
const floatingComposer = readFileSync("src/app/floating-composer.tsx", "utf8");
const searchPage = readFileSync("src/app/search/page.tsx", "utf8");
const merchDetailPage = readFileSync("src/app/merch/[id]/page.tsx", "utf8");
const merchCheckoutSuccessPage = readFileSync(
  "src/app/merch/checkout/success/page.tsx",
  "utf8",
);
const middlewareSource = readFileSync("src/middleware.ts", "utf8");
const readinessDoc = readFileSync("docs/APP_STORE_READINESS.md", "utf8");
const helpCenter = readFileSync("src/lib/help-center.ts", "utf8");
const helpCenterSearch = readFileSync("src/app/help/help-center-search.tsx", "utf8");
const nextConfig = readFileSync("next.config.ts", "utf8");
const productPlan = readFileSync("docs/PRODUCT_PLAN.md", "utf8");
const siteConfig = readFileSync("src/lib/site.ts", "utf8");
const publicSource = [
  authLogin,
  authConfirm,
  adClickRoute,
  loginPage,
  signupPage,
  notificationActions,
  messageActions,
  messageThread,
  urls,
  profilePage,
  gigsDetailPage,
  postDetailPage,
  stuffDetailPage,
  threadDetailPage,
  homePage,
  termsPage,
  privacyPage,
  supportPage,
  settingsPage,
  accountActions,
  accountPage,
  siteConfig,
].join("\n");
const publicCopySource = [
  loginPage,
  signupPage,
  profilePage,
  gigsDetailPage,
  postDetailPage,
  stuffDetailPage,
  threadDetailPage,
  homePage,
  termsPage,
  privacyPage,
  supportPage,
  accountPage,
  profileForm,
  mediaInput,
  floatingComposer,
  searchPage,
  merchDetailPage,
  merchCheckoutSuccessPage,
  helpCenter,
  helpCenterSearch,
].join("\n");
const privateContactSnippets = [
  "lobo3319@gmail.com",
  "lobosden@hotmail.com",
  "D@k0t",
  "Dakota",
  "Calder",
];
const forbiddenPublicInfraSnippets = [
  "Cloudflare",
  "Supabase",
  "HostGator",
  "Stripe",
  "service key",
  "service role",
  "server webhook",
  "payment-provider",
  "hosted checkout",
  "hosted setup",
  "hosted payout",
  "Cloudflare Stream",
  "test mode",
  "test-mode",
];
const publicRoadmapSnippets = [
  "future ads",
  "future public Merch",
  "future booking deposits",
  "future sponsored placements",
  "future translated UI",
  "Calendar connections come later",
  "More buying and selling tools are coming soon",
  "planned ad system",
  "planned Merch",
  "Translation planned",
  "future calendar connection guidance",
  "planned for launch support",
  "planned for the booking tools",
  "Public discovery should stay limited",
  "production purchases still need",
  "privacy shape we are building toward",
  "launch foundation and should be reviewed",
  "Store and app-review screenshots should avoid",
  "production seller approval",
  "fulfillment rules are ready",
  "mobile app store submission",
  "not final legal advice",
  "If translation is added",
  "should use hosted checkout",
  "provider-backed",
  "APNs",
  "FCM",
];
const clientConsoleSnippets = [
  "console.log(",
  "console.debug(",
  "console.info(",
  "console.warn(",
  "console.error(",
];

function collectFiles(dir, predicate, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);

    if (entry.isDirectory()) {
      collectFiles(path, predicate, files);
      continue;
    }

    if (predicate(path)) files.push(path);
  }

  return files;
}

const clientConsoleFiles = collectFiles("src/app", (path) => path.endsWith(".tsx")).filter(
  (path) => {
    const source = readFileSync(path, "utf8");
    return (
      source.startsWith('"use client";') &&
      clientConsoleSnippets.some((snippet) => source.includes(snippet))
    );
  },
);
const productionDebugSnippets = [
  "console.log(",
  "console.debug(",
  "console.info(",
  "console.trace(",
  "debugger;",
];
const productionDebugFiles = [
  ...collectFiles("src", (path) => /\.(ts|tsx)$/.test(path)),
  ...collectFiles("native/thetattoocore-mobile", (path) =>
    /\.(ts|tsx|js|jsx|swift|kt|java)$/.test(path) && !path.includes("node_modules"),
  ),
].filter((path) => {
  const source = readFileSync(path, "utf8");
  return productionDebugSnippets.some((snippet) => source.includes(snippet));
});

const checks = [
  {
    label: "auth login rejects protocol-relative return paths",
    ok:
      authLogin.includes('!text.startsWith("/")') &&
      authLogin.includes('text.startsWith("//")') &&
      authLogin.includes('return "/account"') &&
      authLogin.includes('console.error("Signin request failed.", error)') &&
      authLogin.includes(
        '"Could not sign in. Check your email and password, then try again."',
      ) &&
      !authLogin.includes('error.message || "Could not sign in."') &&
      legacyLoginActions.includes('console.error("Signin request failed.", error)') &&
      legacyLoginActions.includes(
        '"Could not sign in. Check your email and password, then try again."',
      ) &&
      !legacyLoginActions.includes('error.message || "Could not sign in"'),
  },
  {
    label: "login page does not render protocol-relative return paths",
    ok:
      loginPage.includes('params.return_to?.startsWith("/")') &&
      loginPage.includes("!params.return_to.startsWith(\"//\")") &&
      loginPage.includes('!params.return_to.includes("\\\\")') &&
      authLogin.includes("function cleanReturnTo") &&
      authLogin.includes('text.includes("\\\\")'),
  },
  {
    label: "signup form is separated from login page",
    ok:
      loginPage.includes("signupHref") &&
      !loginPage.includes('action="/auth/signup"') &&
      !loginPage.includes('name="age_confirmed"') &&
      signupPage.includes('action="/auth/signup"') &&
      signupPage.includes('name="age_confirmed"'),
  },
  {
    label: "signup confirmation preserves only safe internal return paths",
    ok:
      signupPage.includes('params.return_to?.startsWith("/")') &&
      signupPage.includes("!params.return_to.startsWith(\"//\")") &&
      signupPage.includes('!params.return_to.includes("\\\\")') &&
      signupPage.includes('name="return_to"') &&
      authSignup.includes("function cleanReturnTo") &&
      authSignup.includes("text.startsWith(\"//\")") &&
      authSignup.includes('text.includes("\\\\")') &&
      authResendConfirmation.includes("function cleanReturnTo") &&
      authResendConfirmation.includes('text.includes("\\\\")') &&
      authSignup.includes("emailRedirectTo") &&
      authSignup.includes("encodeURIComponent(returnTo)") &&
      signupPage.includes("loginHref") &&
      authConfirm.includes("next?.startsWith(\"/\")") &&
      authConfirm.includes("!next.startsWith(\"//\")") &&
      authConfirm.includes('!next.includes("\\\\")'),
  },
  {
    label: "signup and confirmation resend hide raw auth-provider errors",
    ok:
      authSignup.includes('console.error("Signup request failed.", error)') &&
      authSignup.includes('"Could not create account. Please try again."') &&
      !authSignup.includes('error.message || "Could not create account."') &&
      authSignup.includes("function cleanReturnTo") &&
      authSignup.includes("text.startsWith(\"//\")") &&
      authSignup.includes('text.includes("\\\\")') &&
      authSignup.includes("emailRedirectTo") &&
      authSignup.includes("encodeURIComponent(returnTo)") &&
      authSignup.includes("Signup request sent. Check inbox and junk for the confirmation email.") &&
      authSignup.includes("You must confirm you are 18 or older to create an account.") &&
      authSignup.includes("Enter an email and password to create an account.") &&
      authSignup.includes("returnTo") &&
      authLogin.includes("Could not sign in. Check your email and password, then try again.") &&
      authConfirm.includes("Could not confirm your email") &&
      authConfirm.includes("next?.startsWith(\"/\")") &&
      authConfirm.includes("!next.startsWith(\"//\")") &&
      authConfirm.includes('!next.includes("\\\\")') &&
      authSignup.includes("signupRedirect") &&
      authResendConfirmation.includes(
        'console.error("Confirmation resend failed.", error)',
      ) &&
      authResendConfirmation.includes(
        '"Could not resend confirmation email. Please try again."',
      ) &&
      authResendConfirmation.includes("emailRedirectTo: `${siteUrl}/auth/confirm?next=${encodeURIComponent(returnTo)}`") &&
      !authResendConfirmation.includes('request.headers.get("origin")') &&
      !authResendConfirmation.includes(
        'error.message || "Could not resend confirmation email."',
      ),
  },
  {
    label: "auth confirm rejects protocol-relative next paths",
    ok:
      authConfirm.includes('next?.startsWith("/")') &&
      authConfirm.includes("!next.startsWith(\"//\")") &&
      authConfirm.includes('!next.includes("\\\\")') &&
      authConfirm.includes(': "/account"'),
  },
  {
    label: "password recovery hides raw provider errors and uses canonical links",
    ok:
      forgotPasswordActions.includes("import { siteUrl }") &&
      forgotPasswordActions.includes("redirectTo: `${siteUrl}/auth/confirm?next=/reset-password`") &&
      forgotPasswordActions.includes('console.error("Password reset request failed.", error)') &&
      forgotPasswordActions.includes('"Could not send reset email. Please try again."') &&
      !forgotPasswordActions.includes('formData.get("origin")') &&
      !forgotPasswordActions.includes('error.message || "Could not send reset email"') &&
      !forgotPasswordPage.includes('name="origin"') &&
      resetPasswordActions.includes('console.error("Password update failed.", error)') &&
      resetPasswordActions.includes('"Could not update password. Please try again."') &&
      !resetPasswordActions.includes('error.message || "Could not update password."') &&
      forgotPasswordPage.includes('autoComplete="email"') &&
      resetPasswordForm.includes('"Could not open that reset link. Please request a new one."') &&
      resetPasswordForm.includes('"Could not update password. Please try again."') &&
      !resetPasswordForm.includes("setMessage(error.message)"),
  },
  {
    label: "client components avoid browser console error details",
    ok: clientConsoleFiles.length === 0,
    message:
      clientConsoleFiles.length === 0
        ? ""
        : `client console calls found in: ${clientConsoleFiles
            .map((path) => relative(process.cwd(), path))
            .join(", ")}`,
  },
  {
    label: "production app and native wrapper avoid debug console traces",
    ok: productionDebugFiles.length === 0,
    message:
      productionDebugFiles.length === 0
        ? ""
        : `debug trace calls found in: ${productionDebugFiles
            .map((path) => relative(process.cwd(), path))
            .join(", ")}`,
  },
  {
    label: "adult terms acceptance hides raw backend errors from member redirects",
    ok:
      mainActions.includes('console.error("Adult terms acceptance failed.", error)') &&
      mainActions.includes('"Finish your profile before accepting 18+ terms."') &&
      !mainActions.includes(
        'error?.message || "Finish your profile before accepting 18+ terms."',
      ),
  },
  {
    label: "account ad submission hides raw backend errors from member redirects",
    ok:
      accountActions.includes('console.error("Ad campaign submit failed.", campaignError)') &&
      accountActions.includes('"Could not submit ad campaign. Please try again."') &&
      !accountActions.includes('campaignError?.message || "Could not submit ad campaign."') &&
      accountActions.includes('console.error("Ad campaign placement submit failed.", placementError)') &&
      accountActions.includes('"Ad campaign saved, but placement setup needs review."') &&
      !accountActions.includes('placementError.message || "Ad saved, but placement failed."'),
  },
  {
    label: "account deletion requests hide raw backend errors from member redirects",
    ok:
      accountActions.includes('console.error("Account deletion request failed.", error)') &&
      accountActions.includes('"Could not request account deletion. Please try again."') &&
      !accountActions.includes('error.message || "Could not request account deletion."') &&
      accountActions.includes('"You already have a pending account deletion request."'),
  },
  {
    label: "notification open rejects external, protocol-relative, and backslash hrefs",
    ok:
      notificationActions.includes('!href.startsWith("/")') &&
      notificationActions.includes('href.startsWith("//")') &&
      notificationActions.includes('href.includes("\\\\")'),
  },
  {
    label: "notification open allowlists user-facing paths",
    ok:
      notificationActions.includes("allowedPaths") &&
      notificationActions.includes("allowedPrefixes") &&
      notificationActions.includes('"/messages"') &&
      notificationActions.includes('"/p/"') &&
      notificationActions.includes('return "/notifications"'),
  },
  {
    label: "notification page has safe fallbacks for older notification rows",
    ok:
      notificationPage.includes('return notification.href || `/messages?c=${notification.subject_id}`') &&
      notificationPage.includes('return notification.href || `/u/${notification.profiles.username}`') &&
      notificationPage.includes('return notification.href || `/merch/${notification.subject_id}`') &&
      notificationPage.includes('return notification.href || "/account#order-settings"') &&
      notificationPage.includes('return notification.href || "/account#advertising-settings"') &&
      notificationPage.includes('return notification.href || "/account#booking-settings"') &&
      notificationPage.includes('return notification.href || "/account#verification-settings"') &&
      notificationPage.includes('return notification.href || "/notifications"'),
  },
  {
    label: "notification open falls back if href parsing fails",
    ok:
      notificationActions.includes("try {") &&
      notificationActions.includes('new URL(href, "https://thetattoocore.local")') &&
      notificationActions.includes("} catch {") &&
      notificationActions.includes('return "/notifications"'),
  },
  {
    label: "notification center filters blocked actor profiles",
    ok:
      notificationPage.includes("async function getBlockedProfileIds") &&
      notificationPage.includes("const blockedProfileIds = await getBlockedProfileIds") &&
      notificationPage.includes("const notificationFetchLimit = notificationLimit + 25") &&
      notificationPage.includes("const filteredNotifications = (notifications ?? []).filter") &&
      notificationPage.includes("const visibleNotifications = filteredNotifications.slice(0, notificationLimit)") &&
      notificationPage.includes("const hasMoreNotifications =") &&
      notificationPage.includes("!blockedProfileIds.has(notification.profiles.id)") &&
      notificationPage.includes("visibleNotifications.map") &&
      notificationPage.includes("visibleNotifications.filter") &&
      notificationPage.includes("{hasMoreNotifications ?"),
  },
  {
    label: "notification badges filter blocked actor profiles",
    ok:
      notificationBell.includes("async function getBlockedProfileIds") &&
      notificationBell.includes('from("user_blocks")') &&
      notificationBell.includes(".select(\"actor_id\")") &&
      notificationBell.includes("!notification.actor_id || !blockedProfileIds.has(notification.actor_id)") &&
      homePage.includes("{ data: unreadDmNotifications }") &&
      homePage.includes(".select(\"actor_id\")") &&
      homePage.includes("const unreadDmBadge =") &&
      homePage.includes("!notification.actor_id || !blockedProfileIds.has(notification.actor_id)"),
  },
  {
    label: "content notifications skip blocked profile relationships",
    ok:
      mainActions.includes("async function blockRelationshipExists") &&
      mainActions.includes('.from("user_blocks")') &&
      mainActions.includes("async function notifyContentOwner") &&
      mainActions.includes("if (await blockRelationshipExists(supabase, actorId, ownerId)) return"),
  },
  {
    label: "follow request approvals respect blocked relationships",
    ok:
      profileActions.includes("export async function acceptFollowRequest") &&
      profileActions.includes('redirect(profilePath(username, "You cannot approve a blocked profile."))') &&
      notificationActions.includes("async function blockRelationshipExists") &&
      notificationActions.includes("const hasBlockRelationship = await blockRelationshipExists") &&
      notificationActions.includes("if (!hasBlockRelationship)") &&
      notificationActions.includes(".eq(\"status\", \"pending\")"),
  },
  {
    label: "new public follows create follower notifications",
    ok:
      profileActions.includes('const status = targetProfile.is_private ? "pending" : "accepted"') &&
      profileActions.includes('title: "New follower"') &&
      profileActions.includes('type: "new_follow"') &&
      profileActions.includes("started following you") &&
      profileActions.includes('href: actorProfile?.username ? `/u/${actorProfile.username}` : "/notifications"') &&
      profileForm.includes("New followers, follow requests, and approved follow requests."),
  },
  {
    label: "DM unread deletion keeps ownership, read-state, and attachment cleanup guards",
    ok:
      messageActions.includes("export async function deleteUnreadMessage") &&
      messageActions.includes("message.sender_id !== userId") &&
      messageActions.includes("otherMember?.last_read_at") &&
      messageActions.includes("That DM has already been read, so it cannot be deleted.") &&
      messageActions.includes("createAdminClient()") &&
      messageActions.includes('.from("message_attachments")') &&
      messageActions.includes("attachmentsByBucket") &&
      messageActions.includes("adminClient.storage.from(bucket).remove(paths)") &&
      messageActions.includes('.from("messages")') &&
      messageActions.includes(".delete()") &&
      !messageActions.includes("private owner tools enabled") &&
      messageThread.includes("const canDeleteUnread = mine && !hasBeenRead") &&
      messageThread.includes("title=\"Delete before the other member reads it\""),
  },
  {
    label: "DM inbox filters blocked conversation members",
    ok:
      messagePage.includes("async function getBlockedProfileIds") &&
      messagePage.includes("const blockedProfileIds = await getBlockedProfileIds") &&
      messagePage.includes('from("user_blocks")') &&
      messagePage.includes("const defaultConversationFetchLimit = conversationLimit + inboxPageSize") &&
      messagePage.includes("const conversationFetchLimit = activeInboxSearch ? 500 : defaultConversationFetchLimit") &&
      messagePage.includes(".limit(conversationFetchLimit)") &&
      messagePage.includes("const inboxBeforeSearch = memberships") &&
      messagePage.includes("const filteredInbox = inboxSearchTerms.length") &&
      messagePage.includes("const inbox = filteredInbox.slice(0, conversationLimit)") &&
      messagePage.includes("const hasMoreInbox =") &&
      messagePage.includes("filteredInbox.length > conversationLimit") &&
      messagePage.includes("!activeInboxSearch && (membershipRows?.length ?? 0) === conversationFetchLimit") &&
      messagePage.includes("blockedProfileIds.has(otherMember.user_id)") &&
      messagePage.includes("isBlockedConversation") &&
      messagePage.includes("!conversation.isBlockedConversation") &&
      messagePage.includes("{hasMoreInbox ?") &&
      messageActions.includes("You cannot message a blocked profile."),
  },
  {
    label: "public smoke covers safe and unsafe login return paths",
    ok:
      publicSmoke.includes("/login?return_to=%2Fmessages") &&
      publicSmoke.includes("/signup?return_to=%2Fp%2Fnot-a-real-post") &&
      publicSmoke.includes("/signup?return_to=%2F%2Fevil.example") &&
      publicSmoke.includes("/signup?return_to=%2F%5Cevil.example") &&
      publicSmoke.includes('path: "/auth/signup"') &&
      publicSmoke.includes('path: "/auth/resend-confirmation"') &&
      publicSmoke.includes("locationExcludes") &&
      publicSmoke.includes("/login?return_to=%2F%2Fevil.example") &&
      publicSmoke.includes("/login?return_to=%2F%5Cevil.example") &&
      publicSmoke.includes("excludes"),
  },
  {
    label: "public smoke covers logged-out checkout POST redirects",
    ok:
      publicSmoke.includes('path: "/api/ads/checkout"') &&
      publicSmoke.includes('path: "/api/bookings/checkout"') &&
      publicSmoke.includes('path: "/api/merch/checkout"') &&
      publicSmoke.includes('method: "POST"') &&
      publicSmoke.includes("Sign%20in%20to%20pay%20for%20ads") &&
      publicSmoke.includes('locationIncludes: ["Sign", "booking", "deposit"]') &&
      publicSmoke.includes("Sign+in+to+buy+merch"),
  },
  {
    label: "public smoke covers unauthenticated push and invalid ad event APIs",
    ok:
      publicSmoke.includes('path: "/api/push/subscriptions"') &&
      publicSmoke.includes('method: "DELETE"') &&
      publicSmoke.includes('method: "POST"') &&
      publicSmoke.includes('"Sign in required."') &&
      publicSmoke.includes('path: "/api/ad-events"') &&
      publicSmoke.includes('"Invalid event."'),
  },
  {
    label: "public smoke covers logged-out admin mail and gig create APIs",
    ok:
      publicSmoke.includes('path: "/api/admin/mail/test"') &&
      publicSmoke.includes('path: "/api/gigs"') &&
      publicSmoke.includes('"Sign in required."') &&
      publicSmoke.includes('redirectIncludes: "/login"'),
  },
  {
    label: "support deletion action routes through safe sign-in return",
    ok:
      supportPage.includes('href: "/login?return_to=%2Fsettings%2Fhelp"') &&
      !supportPage.includes('href: "/account#data-settings"') &&
      privacyPage.includes('href="/login?return_to=%2Fsettings%2Fhelp"') &&
      publicSmoke.includes("/login?return_to=%2Fsettings%2Fhelp"),
  },
  {
    label: "public detail sign-in links preserve safe return paths",
    ok:
      postDetailPage.includes("`/login?return_to=${encodeURIComponent(returnPath)}`") &&
      threadDetailPage.includes("`/login?return_to=${encodeURIComponent(returnPath)}`") &&
      gigsDetailPage.includes("`/login?return_to=${encodeURIComponent(returnPath)}`") &&
      stuffDetailPage.includes("`/login?return_to=${encodeURIComponent(returnPath)}`") &&
      profilePage.includes("loginHref={`/login?return_to=${encodeURIComponent(`/u/${profile.username}`)}`}"),
  },
  {
    label: "home sign-in links preserve safe return paths",
    ok:
      homePage.includes("const loginReturnHref = (returnTo: string)") &&
      homePage.includes("const memberHref = (href: string) => (isSignedIn ? href : loginReturnHref(href))") &&
      homePage.includes('loginReturnHref("/#feed")') &&
      homePage.includes('loginReturnHref("/#threads")') &&
      homePage.includes('loginReturnHref("/#marketplace")') &&
      homePage.includes('loginReturnHref("/#gigs")') &&
      homePage.includes('loginReturnHref("/#merch")'),
  },
  {
    label: "external URL sanitizer only allows http and https",
    ok:
      urls.includes('["http:", "https:"].includes(url.protocol)') &&
      urls.includes("return null"),
  },
  {
    label: "server actions do not revalidate raw return paths",
    ok:
      mainActions.includes("function cleanReturnPath") &&
      mainActions.includes("function revalidateReturnPath") &&
      mainActions.includes("const [pathWithoutHash, existingHash] = cleanPath.split(\"#\", 2)") &&
      mainActions.includes('const separator = pathWithoutHash.includes("?") ? "&" : "?"') &&
      mainActions.includes("const targetHash = cleanHash || existingHash?.replace") &&
      mainActions.includes("`${pathWithoutHash}${separator}message=") &&
      !mainActions.includes('cleanText(formData.get("return_path"), 200)') &&
      !mainActions.includes("revalidatePath(returnPath)") &&
      !accountActions.includes("revalidatePath(returnPath)") &&
      !messageActions.includes("revalidatePath(returnPath)") &&
      !notificationActions.includes("revalidatePath(returnPath)"),
  },
  {
    label: "ad click redirects only to valid paid http or https campaign targets",
    ok:
      adClickRoute.includes('const fallback = new URL("/", request.url)') &&
      adClickRoute.includes('const placements = new Set(["4u", "gossip", "stuff", "merch"])') &&
      adClickRoute.includes('.eq("status", "active")') &&
      adClickRoute.includes('.in("payment_status", ["paid", "waived"])') &&
      adClickRoute.includes("new URL(campaign.target_url)") &&
      adClickRoute.includes('!["http:", "https:"].includes(target.protocol)') &&
      adClickRoute.includes("NextResponse.redirect(fallback"),
  },
  {
    label: "user-generated external links carry safe rel attributes",
    ok:
      urls.includes('userGeneratedLinkRel = "ugc nofollow noopener noreferrer"') &&
      profilePage.includes("rel={userGeneratedLinkRel}") &&
      gigsDetailPage.includes("rel={userGeneratedLinkRel}") &&
      homePage.includes("rel={userGeneratedLinkRel}"),
  },
  {
    label: "public app source uses company support contact only",
    ok:
      siteConfig.includes('supportEmail = "support@thetattoocore.com"') &&
      privateContactSnippets.every((snippet) => !publicSource.includes(snippet)),
  },
  {
    label: "account merch order cards keep support handoffs",
    ok:
      accountPage.includes("function merchSupportMailto") &&
      accountPage.includes('merchSupportMailto(order.id, "buyer")') &&
      accountPage.includes('merchSupportMailto(order?.id ?? item.order_id, "seller")') &&
      accountPage.includes("Issue type: missing / damaged / wrong / delayed / returned / refund / seller help") &&
      accountPage.includes('href="/help/merch-products-orders"'),
  },
  {
    label: "account page keeps tabbed settings workspace and role-aware pro tools",
    ok:
      accountPage.includes("const accountWorkspaceTabs: AccountSettingsTab[] = [") &&
      accountPage.includes("<AccountSettingsWorkspace tabs={accountWorkspaceTabs}>") &&
      accountPage.includes("showVerificationSettings") &&
      accountPage.includes("showAdvertisingSettings") &&
      accountPage.includes("showSellerTools") &&
      accountPage.includes("isProfessionalAccount") &&
      accountPage.includes("{showSellerTools ? (") &&
      accountPage.includes("{showAdvertisingSettings ? (") &&
      accountPage.includes("Profile") &&
      accountPage.includes("Merch and payouts") &&
      accountPage.includes("Retry payout setup") &&
      accountPage.includes('href="/help/seller-payouts-payment-safety"') &&
      accountSettingsWorkspace.includes("Choose the area you need") &&
      accountSettingsWorkspace.includes('href="/settings"') &&
      accountSettingsWorkspace.includes("Settings home") &&
      accountSettingsWorkspace.includes("their own areas so Account does not become one long scroll") &&
      accountSettingsWorkspace.includes('className={activeTab === tab.id ? "block" : "hidden"}') &&
      profileForm.includes("function profileHashForTab") &&
      profileForm.includes('return "#profile-about-settings"') &&
      productPlan.includes("top-level Settings directory") &&
      productPlan.includes("dedicated `/account/...` pages"),
  },
  {
    label: "settings directory keeps professional tools role-aware",
    ok:
      settingsPage.includes("memberSettingsGroups") &&
      settingsPage.includes("professionalSettingsGroups") &&
      settingsPage.includes("isProfessionalAccount") &&
      settingsPage.includes("canOpenAds") &&
      settingsPage.includes('group.href !== "/settings/ads" || canOpenAds') &&
      settingsPage.includes("Professional tools appear when your account is") &&
      productPlan.includes("role-aware panels and Settings cards"),
  },
  {
    label: "public copy does not disclose infrastructure providers or secret setup",
    ok: forbiddenPublicInfraSnippets.every(
      (snippet) => !publicCopySource.includes(snippet),
    ),
  },
  {
    label: "public privacy copy avoids roadmap-style future wording",
    ok: publicRoadmapSnippets.every((snippet) => !privacyPage.includes(snippet)),
  },
  {
    label: "public privacy copy covers data safety without raw payment credential collection",
    ok:
      privacyPage.includes("Account And Profile Data") &&
      privacyPage.includes("Commerce And Payments") &&
      privacyPage.includes("payment questions are handled through private account or support review") &&
      privacyPage.includes("secure checkout flow") &&
      privacyPage.includes("does not collect raw payment or payout credentials") &&
      privacyPage.includes("Retention And Review") &&
      privacyPage.includes("Public examples, help screenshots, and support images") &&
      privacyPage.includes("verification documents"),
  },
  {
    label: "public trust surfaces keep launch content policy stance",
    ok:
      siteConfig.includes("no AI art or scratcher promotion") &&
      loginPage.includes("No AI feed") &&
      loginPage.includes("No scratchers") &&
      termsPage.includes("visible nudity is not allowed") &&
      termsPage.includes("AI-generated art") &&
      termsPage.includes("corporate takeover pressure") &&
      privacyPage.includes("AI ad expansion") &&
      supportPage.includes("supportEmail"),
  },
  {
    label: "verification uploads keep private storage and size guards",
    ok:
      nextConfig.includes('bodySizeLimit: "12mb"') &&
      accountActions.includes('const LICENSE_BUCKET = "license-documents"') &&
      accountActions.includes("const MAX_LICENSE_BYTES = 10 * 1024 * 1024") &&
      accountActions.includes("createAdminClient() ?? supabase") &&
      accountActions.includes("storageClient.storage.from(LICENSE_BUCKET).remove([storagePath])") &&
      accountActions.includes('redirect(verificationPath("License verification submitted for review."))') &&
      accountPage.includes("Accepted files: PDF, JPG, PNG, or WebP up to 10 MB.") &&
      accountPage.includes("Private admin review only."),
  },
  {
    label: "security headers stay on edge middleware until proxy deploy support is verified",
    ok:
      existsSync("src/middleware.ts") &&
      !existsSync("src/proxy.ts") &&
      middlewareSource.includes("export function middleware()") &&
      middlewareSource.includes('runtime: "experimental-edge"') &&
      middlewareSource.includes("X-Content-Type-Options") &&
      middlewareSource.includes("X-Frame-Options") &&
      middlewareSource.includes("Referrer-Policy") &&
      middlewareSource.includes("Strict-Transport-Security") &&
      middlewareSource.includes("Permissions-Policy") &&
      readinessDoc.includes(
        "Keep the security-header route hook on `src/middleware.ts`",
      ) &&
      readinessDoc.includes("`proxy.ts` migration builds locally") &&
      readinessDoc.includes("unsupported Node middleware"),
  },
];

const failures = checks.filter((check) => !check.ok);

for (const check of checks) {
  console.log(`${check.ok ? "PASS" : "FAIL"} ${check.label}`);
}

if (failures.length) {
  for (const check of failures) {
    if (check.message) {
      console.error(`  ${check.message}`);
    }
  }
  console.error(`${failures.length} security guard smoke check(s) failed.`);
  process.exit(1);
}
