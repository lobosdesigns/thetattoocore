const sensitiveTokenPattern =
  /\b(?:(?:sk|pk)_(?:live|test)|sb_(?:secret|publishable))_[A-Za-z0-9_-]+\b/gi;
const urlPattern = /\bhttps?:\/\/[^\s]+/gi;

function safeDiagnosticText(value, fallback) {
  const text = String(value || fallback)
    .replace(urlPattern, "[url]")
    .replace(sensitiveTokenPattern, "[redacted]")
    .replace(/\bBearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/[^\x20-\x7E]/g, " ")
    .trim();

  return (text || fallback).slice(0, 240);
}

export function formatFetchFailureDiagnostic(error, elapsedMs) {
  const isError = error instanceof Error;
  const name = safeDiagnosticText(isError ? error.name : "Error", "Error");
  const message = safeDiagnosticText(isError ? error.message : error, "Request failed");
  const rawCauseCode =
    isError && error.cause && typeof error.cause === "object" && "code" in error.cause
      ? error.cause.code
      : undefined;
  const causeCode = rawCauseCode
    ? safeDiagnosticText(rawCauseCode, "").replace(/[^A-Za-z0-9._-]/g, "").slice(0, 48)
    : "";
  const duration = Number.isFinite(elapsedMs) ? Math.max(0, Math.round(elapsedMs)) : 0;

  return `${name}: ${message}${causeCode ? `; cause=${causeCode}` : ""}; elapsed=${duration}ms`;
}

export function assertPublicSmokeChecks(checks) {
  for (const check of checks) {
    if (Object.hasOwn(check, "textIncludes")) {
      throw new TypeError(
        `Public smoke check "${check.path || "(unknown)"}" uses unsupported "textIncludes"; use "includes".`,
      );
    }
  }
}
