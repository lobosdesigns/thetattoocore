import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type MessageRow = {
  body: string;
  conversation_id: string;
  created_at: string;
  id: string;
  sender_id: string;
};

type MessageAttachment = {
  id: string;
  media_type: "image";
  message_id: string;
  mime_type: string;
  original_filename: string | null;
  storage_bucket: string;
  storage_path: string;
};

const messagePageSize = 100;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizedTimestamp(value: string) {
  if (!value || value.length > 40) return null;

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId =
    typeof claimsData?.claims?.sub === "string"
      ? claimsData.claims.sub
      : null;

  if (!userId) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const conversationId =
    request.nextUrl.searchParams.get("conversationId") ?? "";
  const beforeCreatedAt =
    request.nextUrl.searchParams.get("beforeCreatedAt") ?? "";
  const beforeId = request.nextUrl.searchParams.get("beforeId") ?? "";
  const beforeTimestamp = normalizedTimestamp(beforeCreatedAt);

  if (
    !uuidPattern.test(conversationId) ||
    !uuidPattern.test(beforeId) ||
    !beforeTimestamp
  ) {
    return NextResponse.json(
      { error: "Earlier messages could not be loaded." },
      { status: 400 },
    );
  }

  const { data: membership, error: membershipError } = await supabase
    .from("conversation_members")
    .select("conversation_id")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .maybeSingle<{ conversation_id: string }>();

  if (membershipError || !membership) {
    return NextResponse.json(
      { error: "Conversation was not found." },
      { status: 404 },
    );
  }

  const { data: messageRows, error: messageError } = await supabase
    .from("messages")
    .select("id, body, conversation_id, sender_id, created_at")
    .eq("conversation_id", conversationId)
    .or(
      `created_at.lt.${beforeTimestamp},and(created_at.eq.${beforeTimestamp},id.lt.${beforeId})`,
    )
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(messagePageSize + 1)
    .returns<MessageRow[]>();

  if (messageError) {
    return NextResponse.json(
      { error: "Earlier messages could not be loaded." },
      { status: 503 },
    );
  }

  const rows = messageRows ?? [];
  const hasMore = rows.length > messagePageSize;
  const messages = rows.slice(0, messagePageSize);
  const messageIds = messages.map((message) => message.id);
  const { data: attachments } = messageIds.length
    ? await supabase
        .from("message_attachments")
        .select(
          "id, message_id, storage_bucket, storage_path, media_type, mime_type, original_filename",
        )
        .in("message_id", messageIds)
        .order("created_at", { ascending: true })
        .returns<MessageAttachment[]>()
    : { data: [] as MessageAttachment[] };
  const attachmentsWithUrls = await Promise.all(
    (attachments ?? []).map(async (attachment) => {
      const { data } = await supabase.storage
        .from(attachment.storage_bucket)
        .createSignedUrl(attachment.storage_path, 3600);

      return {
        ...attachment,
        signedUrl: data?.signedUrl ?? null,
      };
    }),
  );
  const attachmentsByMessage = new Map<
    string,
    typeof attachmentsWithUrls
  >();

  for (const attachment of attachmentsWithUrls) {
    const messageAttachments =
      attachmentsByMessage.get(attachment.message_id) ?? [];
    messageAttachments.push(attachment);
    attachmentsByMessage.set(attachment.message_id, messageAttachments);
  }

  return NextResponse.json({
    hasMore,
    messages: messages.toReversed().map((message) => ({
      ...message,
      attachments: attachmentsByMessage.get(message.id) ?? [],
    })),
  });
}
