import { NextResponse } from "next/server";
import { siteUrl } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

function messageRedirect(request: Request, message: string, path = "/login") {
  const url = new URL(path === "/signup" ? "/signup" : "/login", request.url);
  url.searchParams.set("message", message);

  return NextResponse.redirect(url);
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const supabase = await createClient();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const redirectTo = String(formData.get("redirect_to") ?? "");
  const messagePath = redirectTo === "/signup" ? "/signup" : "/login";
  const origin = request.headers.get("origin") ?? siteUrl;

  if (!email) {
    return messageRedirect(
      request,
      "Enter your email to resend confirmation.",
      messagePath,
    );
  }

  const { error } = await supabase.auth.resend({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/confirm`,
    },
    type: "signup",
  });

  if (error) {
    return messageRedirect(
      request,
      error.message || "Could not resend confirmation email.",
      messagePath,
    );
  }

  return messageRedirect(
    request,
    "Confirmation email requested. Check inbox and junk.",
    messagePath,
  );
}
