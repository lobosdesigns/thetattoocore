"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function resetPasswordMessage(message: string) {
  return `/reset-password?message=${encodeURIComponent(message)}`;
}

export async function updatePassword(formData: FormData) {
  const supabase = await createClient();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (password.length < 8) {
    redirect(resetPasswordMessage("Password must be at least 8 characters."));
  }

  if (password !== confirmPassword) {
    redirect(resetPasswordMessage("Passwords do not match."));
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    console.error("Password update failed.", error);
    redirect(resetPasswordMessage("Could not update password. Please try again."));
  }

  revalidatePath("/", "layout");
  redirect("/account");
}
