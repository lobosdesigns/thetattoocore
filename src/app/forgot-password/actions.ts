"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function forgotPasswordMessage(message: string) {
  return `/forgot-password?message=${encodeURIComponent(message)}`;
}

export async function requestPasswordReset(formData: FormData) {
  const supabase = await createClient();
  const email = String(formData.get("email") ?? "").trim();
  const origin = String(formData.get("origin") ?? "https://thetattoocore.com");

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/confirm?next=/reset-password`,
  });

  if (error) {
    redirect(forgotPasswordMessage(error.message || "Could not send reset email"));
  }

  redirect(forgotPasswordMessage("Password reset link sent. Check inbox and junk."));
}
