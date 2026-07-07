import { NextResponse } from "next/server";
import { sendHostgatorTestEmail } from "@/lib/mail/hostgator";
import { createClient } from "@/lib/supabase/server";

type UserRole = "user" | "moderator" | "admin" | "owner";
type Claims = {
  sub: string;
  email?: string;
};

const adminRoles: UserRole[] = ["admin", "owner"];

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims as Claims | undefined;

  if (!claims?.sub) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", claims.sub)
    .maybeSingle<{ role: UserRole }>();

  if (!profile || !adminRoles.includes(profile.role)) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    recipientEmail?: string;
  };
  const recipientEmail = String(body.recipientEmail ?? claims.email ?? "").trim();

  if (!isEmail(recipientEmail)) {
    return NextResponse.json(
      { error: "Enter a valid recipient email." },
      { status: 400 },
    );
  }

  const { data: settings, error } = await supabase
    .from("mail_settings")
    .select(
      "from_email, from_name, smtp_host, smtp_port, smtp_username, smtp_secure, smtp_password_secret_name, reply_to_email, is_enabled",
    )
    .maybeSingle<{
      from_email: string | null;
      from_name: string;
      smtp_host: string | null;
      smtp_port: number | null;
      smtp_username: string | null;
      smtp_secure: boolean;
      smtp_password_secret_name: string;
      reply_to_email: string | null;
      is_enabled: boolean;
    }>();

  if (error || !settings) {
    return NextResponse.json(
      { error: "Mail settings are not available." },
      { status: 500 },
    );
  }

  try {
    await sendHostgatorTestEmail({
      recipientEmail,
      sentByEmail: claims.email,
      settings,
    });

    return NextResponse.json({ ok: true });
  } catch (mailError) {
    const message =
      mailError instanceof Error ? mailError.message : "Could not send email.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
