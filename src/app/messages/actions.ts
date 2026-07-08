"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type Claims = {
  sub: string;
};

function messagesPath(message?: string, conversationId?: string) {
  const params = new URLSearchParams();

  if (conversationId) params.set("c", conversationId);
  if (message) params.set("message", message);

  const query = params.toString();

  return `/messages${query ? `?${query}` : ""}`;
}

function cleanText(value: FormDataEntryValue | null, maxLength: number) {
  return String(value ?? "")
    .trim()
    .slice(0, maxLength);
}

async function requireProfile() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims as Claims | undefined;

  if (!claims?.sub) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username")
    .eq("id", claims.sub)
    .maybeSingle<{ id: string; username: string }>();

  if (!profile) {
    redirect("/account");
  }

  return { profile, supabase, userId: claims.sub };
}

async function findExistingConversation(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  targetId: string,
) {
  const { data: myMemberships } = await supabase
    .from("conversation_members")
    .select("conversation_id")
    .eq("user_id", userId);
  const conversationIds =
    myMemberships?.map((membership) => membership.conversation_id) ?? [];

  if (!conversationIds.length) return null;

  const { data: targetMembership } = await supabase
    .from("conversation_members")
    .select("conversation_id")
    .eq("user_id", targetId)
    .in("conversation_id", conversationIds)
    .limit(1)
    .maybeSingle<{ conversation_id: string }>();

  return targetMembership?.conversation_id ?? null;
}

export async function startConversation(formData: FormData) {
  const { supabase, userId } = await requireProfile();
  const username = cleanText(formData.get("username"), 30)
    .replace(/^@/, "")
    .toLowerCase();
  const body = cleanText(formData.get("body"), 4000);

  if (!/^[a-z0-9_]{3,30}$/.test(username)) {
    redirect(messagesPath("Enter a valid username."));
  }

  if (body.length < 1) {
    redirect(messagesPath("Write a message to start the conversation."));
  }

  const { data: targetProfile } = await supabase
    .from("profiles")
    .select("id, username")
    .eq("username", username)
    .maybeSingle<{ id: string; username: string }>();

  if (!targetProfile) {
    redirect(messagesPath("No profile found with that username."));
  }

  if (targetProfile.id === userId) {
    redirect(messagesPath("You cannot message yourself."));
  }

  let conversationId = await findExistingConversation(
    supabase,
    userId,
    targetProfile.id,
  );

  if (!conversationId) {
    const { data: conversation, error: conversationError } = await supabase
      .from("conversations")
      .insert({ created_by: userId })
      .select("id")
      .single<{ id: string }>();

    if (conversationError || !conversation) {
      redirect(
        messagesPath(
          conversationError?.message || "Could not start conversation.",
        ),
      );
    }

    conversationId = conversation.id;

    const { error: membersError } = await supabase
      .from("conversation_members")
      .insert([
        { conversation_id: conversationId, user_id: userId },
        { conversation_id: conversationId, user_id: targetProfile.id },
      ]);

    if (membersError) {
      redirect(messagesPath(membersError.message, conversationId));
    }
  }

  const { error: messageError } = await supabase.from("messages").insert({
    body,
    conversation_id: conversationId,
    sender_id: userId,
  });

  if (messageError) {
    redirect(messagesPath(messageError.message, conversationId));
  }

  revalidatePath("/messages");
  redirect(messagesPath("Message sent.", conversationId));
}

export async function sendMessage(formData: FormData) {
  const { supabase, userId } = await requireProfile();
  const conversationId = cleanText(formData.get("conversation_id"), 80);
  const body = cleanText(formData.get("body"), 4000);

  if (!conversationId) {
    redirect(messagesPath("Choose a conversation first."));
  }

  if (body.length < 1) {
    redirect(messagesPath("Message cannot be empty.", conversationId));
  }

  const { error } = await supabase.from("messages").insert({
    body,
    conversation_id: conversationId,
    sender_id: userId,
  });

  if (error) {
    redirect(messagesPath(error.message, conversationId));
  }

  revalidatePath("/messages");
  redirect(messagesPath(undefined, conversationId));
}
