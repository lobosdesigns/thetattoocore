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

function cleanSourceType(value: FormDataEntryValue | null) {
  const text = cleanText(value, 40);

  if (text === "marketplace_listing" || text === "gig") return text;

  return null;
}

function sourceLabel(sourceType: string | null) {
  if (sourceType === "marketplace_listing") return "Stuff";
  if (sourceType === "gig") return "Gigs";

  return "DM";
}

function messagePreferenceColumn(sourceType: string | null) {
  return sourceType === "marketplace_listing" || sourceType === "gig"
    ? "notify_marketplace_gig_activity"
    : "notify_message_activity";
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
    .select("id, username, banned_at, suspended_at")
    .eq("id", claims.sub)
    .maybeSingle<{
      banned_at: string | null;
      id: string;
      suspended_at: string | null;
      username: string;
    }>();

  if (!profile) {
    redirect("/account");
  }

  if (profile.banned_at) {
    redirect(messagesPath("This account is banned from DMs."));
  }

  if (profile.suspended_at) {
    redirect(messagesPath("This account is suspended from DMs."));
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
  const sourceId = cleanText(formData.get("source_id"), 80);
  const sourceTitle = cleanText(formData.get("source_title"), 120);
  const sourceType = cleanSourceType(formData.get("source_type"));

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

  const { data: senderProfile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", userId)
    .maybeSingle<{ display_name: string }>();
  const preferenceColumn = messagePreferenceColumn(sourceType);
  const { data: targetPreferences } = await supabase
    .from("profiles")
    .select(preferenceColumn)
    .eq("id", targetProfile.id)
    .maybeSingle<Record<string, boolean>>();

  if (targetPreferences?.[preferenceColumn] !== false) {
    await supabase.from("notifications").insert({
      actor_id: userId,
      body: body.slice(0, 160),
      href: `/messages?c=${conversationId}`,
      recipient_id: targetProfile.id,
      subject_id: sourceId || conversationId,
      subject_type: sourceType ?? "conversation",
      title: `${sourceLabel(sourceType)} message from ${
        senderProfile?.display_name ?? "a member"
      }${sourceTitle ? ` about ${sourceTitle}` : ""}`.slice(0, 120),
      type: "message",
    });
  }

  revalidatePath("/messages");
  revalidatePath("/notifications");
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

  const { data: recipients } = await supabase
    .from("conversation_members")
    .select("user_id")
    .eq("conversation_id", conversationId)
    .neq("user_id", userId)
    .limit(5)
    .returns<{ user_id: string }[]>();
  const { data: senderProfile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", userId)
    .maybeSingle<{ display_name: string }>();

  if (recipients?.length) {
    const recipientIds = recipients.map((recipient) => recipient.user_id);
    const { data: recipientPreferences } = await supabase
      .from("profiles")
      .select("id, notify_message_activity")
      .in("id", recipientIds)
      .returns<{ id: string; notify_message_activity: boolean }[]>();
    const enabledRecipientIds = new Set(
      (recipientPreferences ?? [])
        .filter((recipient) => recipient.notify_message_activity)
        .map((recipient) => recipient.id),
    );

    const notifications = recipients
      .filter((recipient) => enabledRecipientIds.has(recipient.user_id))
      .map((recipient) => ({
          actor_id: userId,
          body: body.slice(0, 160),
          href: `/messages?c=${conversationId}`,
          recipient_id: recipient.user_id,
          subject_id: conversationId,
          subject_type: "conversation",
          title: `New message from ${senderProfile?.display_name ?? "a member"}`,
          type: "message",
        }));

    if (notifications.length) {
      await supabase.from("notifications").insert(notifications);
    }
  }

  revalidatePath("/messages");
  revalidatePath("/notifications");
  redirect(messagesPath(undefined, conversationId));
}
