import { readFileSync } from "node:fs";

const authLogin = readFileSync("src/app/auth/login/route.ts", "utf8");
const authConfirm = readFileSync("src/app/auth/confirm/route.ts", "utf8");
const loginPage = readFileSync("src/app/login/page.tsx", "utf8");
const signupPage = readFileSync("src/app/signup/page.tsx", "utf8");
const notificationActions = readFileSync("src/app/notifications/actions.ts", "utf8");
const publicSmoke = readFileSync("scripts/smoke-public-routes.mjs", "utf8");
const urls = readFileSync("src/lib/urls.ts", "utf8");
const profilePage = readFileSync("src/app/u/[username]/page.tsx", "utf8");
const gigsDetailPage = readFileSync("src/app/gigs/[id]/page.tsx", "utf8");
const homePage = readFileSync("src/app/page.tsx", "utf8");
const siteConfig = readFileSync("src/lib/site.ts", "utf8");
const publicSource = [
  authLogin,
  authConfirm,
  loginPage,
  signupPage,
  notificationActions,
  urls,
  profilePage,
  gigsDetailPage,
  homePage,
  siteConfig,
].join("\n");
const privateContactSnippets = [
  "lobosden@hotmail.com",
  "D@k0t",
  "Dakota",
  "Calder",
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
];

const failures = checks.filter((check) => !check.ok);

for (const check of checks) {
  console.log(`${check.ok ? "PASS" : "FAIL"} ${check.label}`);
}

if (failures.length) {
  console.error(`${failures.length} security guard smoke check(s) failed.`);
  process.exit(1);
}
