import { readFileSync } from "node:fs";

const authLogin = readFileSync("src/app/auth/login/route.ts", "utf8");
const authConfirm = readFileSync("src/app/auth/confirm/route.ts", "utf8");
const loginPage = readFileSync("src/app/login/page.tsx", "utf8");
const notificationActions = readFileSync("src/app/notifications/actions.ts", "utf8");
const publicSmoke = readFileSync("scripts/smoke-public-routes.mjs", "utf8");

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
    label: "public smoke covers safe and unsafe login return paths",
    ok:
      publicSmoke.includes("/login?return_to=%2Fmessages") &&
      publicSmoke.includes("/login?return_to=%2F%2Fevil.example") &&
      publicSmoke.includes("excludes"),
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
