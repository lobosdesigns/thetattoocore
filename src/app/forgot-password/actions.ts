"use server";

import { redirect } from "next/navigation";
import { siteUrl } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

function forgotPasswordMessage(message: string) {
  return `/forgot-password?message=${encodeURIComponent(message)}`;
}

export async function requestPasswordReset(formData: FormData) {
  const supabase = await createClient();
  const email = String(formData.get("email") ?? "").trim();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/auth/confirm?next=/reset-password`,
  });

  if (error) {
    console.error("Password reset request failed.", error);
    redirect(forgotPasswordMessage("Could not send reset email. Please try again."));
  }

  redirect(forgotPasswordMessage("Password reset link sent. Check inbox and junk."));
}
