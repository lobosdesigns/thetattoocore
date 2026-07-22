import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function safeInternalRedirectUrl(request: NextRequest, next: string | null) {
  const redirectTo = request.nextUrl.clone();

  if (!next?.startsWith("/") || next.startsWith("//") || next.includes("\\")) {
    redirectTo.pathname = "/account";
    redirectTo.search = "";
    redirectTo.hash = "";
    return redirectTo;
  }

  const nextUrl = new URL(next, request.url);
  if (nextUrl.origin !== request.nextUrl.origin) {
    redirectTo.pathname = "/account";
    redirectTo.search = "";
    redirectTo.hash = "";
    return redirectTo;
  }

  redirectTo.pathname = nextUrl.pathname;
  redirectTo.search = nextUrl.search;
  redirectTo.hash = nextUrl.hash;
  return redirectTo;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next");
  const redirectTo = safeInternalRedirectUrl(request, next);

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(redirectTo);
    }
  }

  redirectTo.searchParams.delete("token_hash");
  redirectTo.searchParams.delete("type");

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });

    if (!error) {
      return NextResponse.redirect(redirectTo);
    }
  }

  redirectTo.pathname = "/login";
  redirectTo.searchParams.set("message", "Could not confirm your email");
  return NextResponse.redirect(redirectTo);
}
