import { NextResponse } from "next/server";
import { siteUrl } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

function loginRedirect(request: Request, message: string) {
  const url = new URL("/login", request.url);
  url.searchParams.set("message", message);

  return NextResponse.redirect(url);
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const supabase = await createClient();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const origin = request.headers.get("origin") ?? siteUrl;

  if (!email) {
    return loginRedirect(request, "Enter your email to resend confirmation.");
  }

  const { error } = await supabase.auth.resend({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/confirm`,
    },
    type: "signup",
  });

  if (error) {
    return loginRedirect(
      request,
      error.message || "Could not resend confirmation email.",
    );
  }

  return loginRedirect(
    request,
    "Confirmation email requested. Check inbox and junk.",
  );
}
