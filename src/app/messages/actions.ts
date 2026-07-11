"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { inspectMediaFile, validateMediaMetadata } from "@/lib/media/metadata";
import {
  allowsInAppNotification,
  notificationPreferenceColumn,
  notificationPreferenceSelect,
  type NotificationPreferenceCategory,
  type NotificationPreferenceProfile,
} from "@/lib/notifications";
import { createClient } from "@/lib/supabase/server";
import { isVerifiedProfessional } from "@/lib/verification";

const MESSAGE_MEDIA_BUCKET = "message-media";

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

function mediaFromForm(formData: FormData) {
  const value = formData.get("media");

  if (!(value instanceof File) || value.size === 0) {
    return null;
  }

  return value;
}

function extensionFor(file: File) {
  const fromName = file.name.split(".").pop()?.toLowerCase();

  if (fromName && /^[a-z0-9]+$/.test(fromName)) {
    return fromName.slice(0, 12);
  }

  return file.type.split("/")[1]?.replace("jpeg", "jpg") || "bin";
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

function messagePreferenceCategory(
  sourceType: string | null,
): NotificationPreferenceCategory {
  return sourceType === "marketplace_listing" || sourceType === "gig"
    ? "marketplace_gig"
    : "message";
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

async function attachMessageMedia({
  conversationId,
  formData,
  messageId,
  supabase,
  userId,
}: {
  conversationId: string;
  formData: FormData;
  messageId: string;
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
}) {
  const media = mediaFromForm(formData);

  if (!media) return;

  const metadata = await inspectMediaFile(media);
  const validationMessage = validateMediaMetadata(metadata);

  if (validationMessage || metadata.mediaType !== "image") {
    redirect(
      messagesPath(
        validationMessage || "DM attachments support images right now.",
        conversationId,
      ),
    );
  }

  const storagePath = `${userId}/messages/${messageId}/${crypto.randomUUID()}.${extensionFor(media)}`;
  const { error: uploadError } = await supabase.storage
    .from(MESSAGE_MEDIA_BUCKET)
    .upload(storagePath, media, {
      cacheControl: "3600",
      contentType: metadata.mimeType,
      upsert: false,
    });

  if (uploadError) {
    redirect(
      messagesPath(
        uploadError.message || "Message sent, but photo upload failed.",
        conversationId,
      ),
    );
  }

  const { error: attachmentError } = await supabase
    .from("message_attachments")
    .insert({
      file_size_bytes: metadata.fileSizeBytes,
      height: metadata.height,
      media_type: "image",
      message_id: messageId,
      mime_type: metadata.mimeType,
      original_filename: metadata.originalFilename,
      sender_id: userId,
      storage_bucket: MESSAGE_MEDIA_BUCKET,
      storage_path: storagePath,
      width: metadata.width,
    });

  if (attachmentError) {
    await supabase.storage.from(MESSAGE_MEDIA_BUCKET).remove([storagePath]);
    redirect(
      messagesPath(
        attachmentError.message || "Message sent, but photo could not attach.",
        conversationId,
      ),
    );
  }
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

async function blockRelationshipExists(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  targetId: string,
) {
  const { data } = await supabase
    .from("user_blocks")
    .select("blocker_id")
    .or(
      `and(blocker_id.eq.${userId},blocked_id.eq.${targetId}),and(blocker_id.eq.${targetId},blocked_id.eq.${userId})`,
    )
    .limit(1)
    .maybeSingle<{ blocker_id: string }>();

  return Boolean(data);
}

export async function startConversation(formData: FormData) {
  const { supabase, userId } = await requireProfile();
  const username = cleanText(formData.get("username"), 30)
    .replace(/^@/, "")
    .toLowerCase();
  const body = cleanText(formData.get("body"), 4000);
  const media = mediaFromForm(formData);
  const sourceId = cleanText(formData.get("source_id"), 80);
  const sourceTitle = cleanText(formData.get("source_title"), 120);
  const sourceType = cleanSourceType(formData.get("source_type"));

  if (!/^[a-z0-9_]{3,30}$/.test(username)) {
    redirect(messagesPath("Enter a valid username."));
  }

  if (body.length < 1 && !media) {
    redirect(messagesPath("Write a message to start the conversation."));
  }
  const messageBody = body || "Photo";

  if (sourceType === "marketplace_listing") {
    const { data: senderVerification } = await supabase
      .from("profiles")
      .select("account_type, license_verified_at")
      .eq("id", userId)
      .maybeSingle<{
        account_type: string;
        license_verified_at: string | null;
      }>();

    if (!isVerifiedProfessional(senderVerification)) {
      redirect(
        messagesPath(
          "Verified artist, studio, or vendor status is required to contact Stuff sellers.",
        ),
      );
    }
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

  if (await blockRelationshipExists(supabase, userId, targetProfile.id)) {
    redirect(messagesPath("You cannot message a blocked profile."));
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

    const { error: creatorMemberError } = await supabase
      .from("conversation_members")
      .insert({ conversation_id: conversationId, user_id: userId });

    if (creatorMemberError) {
      redirect(messagesPath(creatorMemberError.message, conversationId));
    }

    const { error: targetMemberError } = await supabase
      .from("conversation_members")
      .insert({ conversation_id: conversationId, user_id: targetProfile.id });

    if (targetMemberError) {
      redirect(messagesPath(targetMemberError.message, conversationId));
    }
  }

  const { data: message, error: messageError } = await supabase
    .from("messages")
    .insert({
      body: messageBody,
      conversation_id: conversationId,
      sender_id: userId,
    })
    .select("id")
    .single<{ id: string }>();

  if (messageError || !message) {
    redirect(
      messagesPath(messageError?.message || "Could not send message.", conversationId),
    );
  }

  await attachMessageMedia({
    conversationId,
    formData,
    messageId: message.id,
    supabase,
    userId,
  });

  const { data: senderProfile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", userId)
    .maybeSingle<{ display_name: string }>();
  const preferenceCategory = messagePreferenceCategory(sourceType);
  const { data: targetPreferences } = await supabase
    .from("profiles")
    .select(notificationPreferenceSelect(preferenceCategory))
    .eq("id", targetProfile.id)
    .maybeSingle<NotificationPreferenceProfile>();

  if (allowsInAppNotification(targetPreferences, preferenceCategory)) {
    await supabase.from("notifications").insert({
      actor_id: userId,
      body: messageBody.slice(0, 160),
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
  const media = mediaFromForm(formData);

  if (!conversationId) {
    redirect(messagesPath("Choose a conversation first."));
  }

  if (body.length < 1 && !media) {
    redirect(messagesPath("Message cannot be empty.", conversationId));
  }
  const messageBody = body || "Photo";

  const { data: senderMembership } = await supabase
    .from("conversation_members")
    .select("conversation_id")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .maybeSingle<{ conversation_id: string }>();

  if (!senderMembership) {
    redirect(messagesPath("Choose one of your conversations first."));
  }

  const { data: blockedMembers } = await supabase
    .from("conversation_members")
    .select("user_id")
    .eq("conversation_id", conversationId)
    .neq("user_id", userId)
    .returns<{ user_id: string }[]>();

  for (const member of blockedMembers ?? []) {
    if (await blockRelationshipExists(supabase, userId, member.user_id)) {
      redirect(messagesPath("You cannot message a blocked profile.", conversationId));
    }
  }

  const { data: message, error } = await supabase
    .from("messages")
    .insert({
      body: messageBody,
      conversation_id: conversationId,
      sender_id: userId,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !message) {
    redirect(messagesPath(error?.message || "Could not send message.", conversationId));
  }

  await attachMessageMedia({
    conversationId,
    formData,
    messageId: message.id,
    supabase,
    userId,
  });

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
    const messagePreferenceColumn = notificationPreferenceColumn("message");
    const { data: recipientPreferences } = await supabase
      .from("profiles")
      .select(`id, ${messagePreferenceColumn}`)
      .in("id", recipientIds)
      .returns<{ id: string; notify_message_activity: boolean | null }[]>();
    const enabledRecipientIds = new Set(
      (recipientPreferences ?? [])
        .filter((recipient) => allowsInAppNotification(recipient, "message"))
        .map((recipient) => String(recipient.id)),
    );

    const notifications = recipients
      .filter((recipient) => enabledRecipientIds.has(recipient.user_id))
      .map((recipient) => ({
        actor_id: userId,
        body: messageBody.slice(0, 160),
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
