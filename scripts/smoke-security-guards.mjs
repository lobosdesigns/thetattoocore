import { readFileSync } from "node:fs";

const authLogin = readFileSync("src/app/auth/login/route.ts", "utf8");
const authConfirm = readFileSync("src/app/auth/confirm/route.ts", "utf8");
const adClickRoute = readFileSync("src/app/api/ad-click/route.ts", "utf8");
const loginPage = readFileSync("src/app/login/page.tsx", "utf8");
const signupPage = readFileSync("src/app/signup/page.tsx", "utf8");
const notificationActions = readFileSync("src/app/notifications/actions.ts", "utf8");
const publicSmoke = readFileSync("scripts/smoke-public-routes.mjs", "utf8");
const urls = readFileSync("src/lib/urls.ts", "utf8");
const profilePage = readFileSync("src/app/u/[username]/page.tsx", "utf8");
const gigsDetailPage = readFileSync("src/app/gigs/[id]/page.tsx", "utf8");
const homePage = readFileSync("src/app/page.tsx", "utf8");
const termsPage = readFileSync("src/app/terms/page.tsx", "utf8");
const privacyPage = readFileSync("src/app/privacy/page.tsx", "utf8");
const supportPage = readFileSync("src/app/support/page.tsx", "utf8");
const accountActions = readFileSync("src/app/account/actions.ts", "utf8");
const accountPage = readFileSync("src/app/account/page.tsx", "utf8");
const mediaInput = readFileSync("src/app/media-input.tsx", "utf8");
const floatingComposer = readFileSync("src/app/floating-composer.tsx", "utf8");
const searchPage = readFileSync("src/app/search/page.tsx", "utf8");
const merchDetailPage = readFileSync("src/app/merch/[id]/page.tsx", "utf8");
const merchCheckoutSuccessPage = readFileSync(
  "src/app/merch/checkout/success/page.tsx",
  "utf8",
);
const nextConfig = readFileSync("next.config.ts", "utf8");
const siteConfig = readFileSync("src/lib/site.ts", "utf8");
const publicSource = [
  authLogin,
  authConfirm,
  adClickRoute,
  loginPage,
  signupPage,
  notificationActions,
  urls,
  profilePage,
  gigsDetailPage,
  homePage,
  termsPage,
  privacyPage,
  supportPage,
  accountActions,
  accountPage,
  siteConfig,
].join("\n");
const publicCopySource = [
  loginPage,
  signupPage,
  profilePage,
  gigsDetailPage,
  homePage,
  termsPage,
  privacyPage,
  supportPage,
  accountPage,
  mediaInput,
  floatingComposer,
  searchPage,
  merchDetailPage,
  merchCheckoutSuccessPage,
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
  "Cloudflare Stream",
];

const checks = [
  {
    label: "auth login rejects protocol-relative return paths",
    ok:
      authLogin.includes('!text.startsWith("/")') &&
      authLogin.includes('text.startsWith("//")') &&
      authLogin.includes('return "/account"'),
  },
  {
    label: "login page does not render protocol-relative return paths",
    ok:
      loginPage.includes('params.return_to?.startsWith("/")') &&
      loginPage.includes("!params.return_to.startsWith(\"//\")"),
  },
  {
    label: "signup form is separated from login page",
    ok:
      loginPage.includes('href="/signup"') &&
      !loginPage.includes('action="/auth/signup"') &&
      !loginPage.includes('name="age_confirmed"') &&
      signupPage.includes('action="/auth/signup"') &&
      signupPage.includes('name="age_confirmed"'),
  },
  {
    label: "auth confirm rejects protocol-relative next paths",
    ok:
      authConfirm.includes('next?.startsWith("/")') &&
      authConfirm.includes("!next.startsWith(\"//\")") &&
      authConfirm.includes(': "/account"'),
  },
  {
    label: "notification open rejects external and protocol-relative hrefs",
    ok:
      notificationActions.includes('!href.startsWith("/")') &&
      notificationActions.includes('href.startsWith("//")'),
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
    label: "notification open falls back if href parsing fails",
    ok:
      notificationActions.includes("try {") &&
      notificationActions.includes('new URL(href, "https://thetattoocore.local")') &&
      notificationActions.includes("} catch {") &&
      notificationActions.includes('return "/notifications"'),
  },
  {
    label: "public smoke covers safe and unsafe login return paths",
    ok:
      publicSmoke.includes("/login?return_to=%2Fmessages") &&
      publicSmoke.includes("/login?return_to=%2F%2Fevil.example") &&
      publicSmoke.includes("excludes"),
  },
  {
    label: "external URL sanitizer only allows http and https",
    ok:
      urls.includes('["http:", "https:"].includes(url.protocol)') &&
      urls.includes("return null"),
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
    label: "public copy does not disclose infrastructure providers or secret setup",
    ok: forbiddenPublicInfraSnippets.every(
      (snippet) => !publicCopySource.includes(snippet),
    ),
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
];

const failures = checks.filter((check) => !check.ok);

for (const check of checks) {
  console.log(`${check.ok ? "PASS" : "FAIL"} ${check.label}`);
}

if (failures.length) {
  console.error(`${failures.length} security guard smoke check(s) failed.`);
  process.exit(1);
}
