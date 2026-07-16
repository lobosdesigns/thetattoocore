import { NextResponse } from "next/server";
import { siteUrl } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

function cleanReturnTo(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();

  if (!text.startsWith("/") || text.startsWith("//")) return "/account";

  return text;
}

function messageRedirect(
  request: Request,
  message: string,
  path = "/login",
  returnTo = "/account",
) {
  const url = new URL(path === "/signup" ? "/signup" : "/login", request.url);
  url.searchParams.set("message", message);
  if (returnTo !== "/account") {
    url.searchParams.set("return_to", returnTo);
  }

  return NextResponse.redirect(url);
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const supabase = await createClient();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const redirectTo = String(formData.get("redirect_to") ?? "");
  const returnTo = cleanReturnTo(formData.get("return_to"));
  const messagePath = redirectTo === "/signup" ? "/signup" : "/login";

  if (!email) {
    return messageRedirect(
      request,
      "Enter your email to resend confirmation.",
      messagePath,
      returnTo,
    );
  }

  const { error } = await supabase.auth.resend({
    email,
    options: {
      emailRedirectTo: `${siteUrl}/auth/confirm?next=${encodeURIComponent(returnTo)}`,
    },
    type: "signup",
  });

  if (error) {
    console.error("Confirmation resend failed.", error);
    return messageRedirect(
      request,
      "Could not resend confirmation email. Please try again.",
      messagePath,
      returnTo,
    );
  }

  return messageRedirect(
    request,
    "Confirmation email requested. Check inbox and junk.",
    messagePath,
    returnTo,
  );
}
