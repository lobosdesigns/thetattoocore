import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/http/reliability";
import { sendHostgatorTestEmail } from "@/lib/mail/hostgator";
import { createClient } from "@/lib/supabase/server";

type UserRole = "user" | "moderator" | "admin" | "owner";
type Claims = {
  sub: string;
  email?: string;
};
type JsonBodyResult =
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; status: 400 | 413 };

const adminRoles: UserRole[] = ["admin", "owner"];
const allowedBodyKeys = new Set(["recipientEmail"]);
const maxRequestBodyBytes = 4_096;

export const dynamic = "force-dynamic";

const privateAdminResponseHeaders = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
  Pragma: "no-cache",
  "X-Robots-Tag": "noindex, nofollow",
};

function privateJson(
  body: unknown,
  status = 200,
  additionalHeaders?: HeadersInit,
) {
  const headers = new Headers(additionalHeaders);

  for (const [name, value] of Object.entries(privateAdminResponseHeaders)) {
    headers.set(name, value);
  }

  return NextResponse.json(body, { headers, status });
}

function isEmail(value: string) {
  return (
    value.length <= 254 &&
    !value.includes("\r") &&
    !value.includes("\n") &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  );
}

function hasJsonContentType(request: Request) {
  const mediaType = request.headers
    .get("content-type")
    ?.split(";", 1)[0]
    .trim()
    .toLowerCase();

  return mediaType === "application/json" || mediaType?.endsWith("+json") === true;
}

function hasSameOrigin(request: Request) {
  const origin = request.headers.get("origin");

  if (!origin) {
    return false;
  }

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

async function readJsonBody(request: Request): Promise<JsonBodyResult> {
  const contentLength = request.headers.get("content-length");

  if (contentLength !== null) {
    const parsedLength = Number.parseInt(contentLength, 10);

    if (!Number.isFinite(parsedLength) || parsedLength < 0) {
      return { ok: false, status: 400 };
    }

    if (parsedLength > maxRequestBodyBytes) {
      return { ok: false, status: 413 };
    }
  }

  const rawBody = await request.text();

  if (new TextEncoder().encode(rawBody).byteLength > maxRequestBodyBytes) {
    return { ok: false, status: 413 };
  }

  try {
    const value: unknown = JSON.parse(rawBody);

    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return { ok: false, status: 400 };
    }

    return { ok: true, value: value as Record<string, unknown> };
  } catch {
    return { ok: false, status: 400 };
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims as Claims | undefined;

  if (!claims?.sub) {
    return privateJson({ error: "Sign in required." }, 401);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", claims.sub)
    .maybeSingle<{ role: UserRole }>();

  if (!profile || !adminRoles.includes(profile.role)) {
    return privateJson({ error: "Admin access required." }, 403);
  }

  if (!hasSameOrigin(request)) {
    return privateJson({ error: "Request origin is not allowed." }, 403);
  }

  if (!hasJsonContentType(request)) {
    return privateJson({ error: "Content-Type must be application/json." }, 415);
  }

  const rateLimit = checkRateLimit({
    identity: claims.sub,
    limit: 5,
    request,
    scope: "admin-mail-test",
    windowMs: 10 * 60_000,
  });

  if (rateLimit.limited) {
    return privateJson(
      { error: "Too many requests. Please try again later." },
      429,
      { "Retry-After": String(rateLimit.retryAfterSeconds) },
    );
  }

  const bodyResult = await readJsonBody(request);

  if (!bodyResult.ok) {
    return privateJson(
      {
        error:
          bodyResult.status === 413
            ? "Request body is too large."
            : "Enter a valid request body.",
      },
      bodyResult.status,
    );
  }

  if (Object.keys(bodyResult.value).some((key) => !allowedBodyKeys.has(key))) {
    return privateJson({ error: "Enter a valid request body." }, 400);
  }

  const requestedRecipient = bodyResult.value.recipientEmail;

  if (
    requestedRecipient !== undefined &&
    typeof requestedRecipient !== "string"
  ) {
    return privateJson({ error: "Enter a valid recipient email." }, 400);
  }

  const recipientEmail = (requestedRecipient ?? claims.email ?? "").trim();

  if (!isEmail(recipientEmail)) {
    return privateJson({ error: "Enter a valid recipient email." }, 400);
  }

  const { data: settings, error } = await supabase
    .from("mail_settings")
    .select(
      "from_email, from_name, smtp_host, smtp_port, smtp_username, smtp_secure, smtp_password_secret_name, reply_to_email, is_enabled",
    )
    .maybeSingle<{
      from_email: string | null;
      from_name: string;
      smtp_host: string | null;
      smtp_port: number | null;
      smtp_username: string | null;
      smtp_secure: boolean;
      smtp_password_secret_name: string;
      reply_to_email: string | null;
      is_enabled: boolean;
    }>();

  if (error || !settings) {
    return privateJson({ error: "Mail settings are not available." }, 500);
  }

  try {
    await sendHostgatorTestEmail({
      recipientEmail,
      sentByEmail: claims.email,
      settings,
    });

    return privateJson({ ok: true });
  } catch {
    console.error("Admin test email send failed.");

    return privateJson({ error: "Could not send the test email." }, 500);
  }
}
