type AuthFailure = {
  name?: string;
  status?: number;
} | null;

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
