type AuthFailure = {
  name?: string;
  status?: number;
} | null;

export const nativeSessionAccountHeader = "X-TTC-Account-ID";

const accountIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const authFormPaths = new Set([
  "/forgot-password",
  "/login",
  "/reset-password",
  "/signup",
]);

export function nativeSessionAccountId(value: unknown) {
  return typeof value === "string" && accountIdPattern.test(value)
    ? value.toLowerCase()
    : null;
}

export function nativeSessionResumeAction(
  status: number,
  pathname: unknown,
  currentAccountId: unknown,
  responseAccountId: unknown,
) {
  if (status === 401) {
    return typeof pathname === "string" && authFormPaths.has(pathname)
      ? "preserve-auth-form"
      : "login";
  }

  if (status !== 204) return "retry";

  const nextAccountId = nativeSessionAccountId(responseAccountId);

  if (!nextAccountId) return "retry";

  return nativeSessionAccountId(currentAccountId) === nextAccountId
    ? "refresh"
    : "replace-route";
}

export function nativeSessionFailureStatus(error: AuthFailure): 401 | 503 {
  if (!error || error.name === "AuthSessionMissingError") return 401;

  if (
    error.name === "AuthRetryableFetchError" ||
    error.status === 429 ||
    (typeof error.status === "number" && error.status >= 500) ||
    typeof error.status !== "number"
  ) {
    return 503;
  }

  return 401;
}

export function nativeSessionReturnPath(pathname: unknown) {
  if (
    typeof pathname !== "string" ||
    !pathname.startsWith("/") ||
    pathname.startsWith("//") ||
    pathname.startsWith("/login")
  ) {
    return "/account";
  }

  return pathname;
}
