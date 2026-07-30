import "server-only";

export type MailSettings = {
  from_email: string | null;
  from_name: string;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_username: string | null;
  smtp_secure: boolean;
  smtp_password_secret_name: string;
  reply_to_email: string | null;
  is_enabled: boolean;
};

type TestMailInput = {
  recipientEmail: string;
  sentByEmail?: string;
  settings: MailSettings;
};

type TransactionalMailInput = {
  headers?: Record<string, string>;
  html?: string;
  recipientEmail: string;
  settings: MailSettings;
  subject: string;
  text: string;
};

const hostgatorPasswordSecretName = "HOSTGATOR_SMTP_PASSWORD";
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const smtpHostPattern =
  /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;
const headerNamePattern = /^[a-z0-9-]{1,80}$/i;

export class MailDeliveryError extends Error {
  constructor() {
    super("Mail delivery failed.");
    this.name = "MailDeliveryError";
  }
}

function required(value: string | null | undefined, label: string) {
  if (!value) {
    throw new Error(`${label} is not configured.`);
  }

  return value;
}

function containsControlCharacter(value: string) {
  return [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127;
  });
}

function validatedText(value: string, label: string, maxLength: number) {
  const normalized = value.trim();

  if (
    !normalized ||
    normalized.length > maxLength ||
    containsControlCharacter(normalized)
  ) {
    throw new Error(`${label} is invalid.`);
  }

  return normalized;
}

function validatedEmail(value: string, label: string) {
  const normalized = validatedText(value, label, 254).toLowerCase();

  if (!emailPattern.test(normalized)) {
    throw new Error(`${label} is invalid.`);
  }

  return normalized;
}

function validatedHeaders(headers?: Record<string, string>) {
  if (!headers) return undefined;

  return Object.fromEntries(
    Object.entries(headers).map(([name, value]) => {
      if (!headerNamePattern.test(name)) {
        throw new Error("Mail header name is invalid.");
      }

      return [name, validatedText(value, "Mail header value", 998)];
    }),
  );
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function validateMailSettings(settings: MailSettings): MailSettings {
  if (settings.smtp_password_secret_name !== hostgatorPasswordSecretName) {
    throw new Error(
      `Unsupported SMTP password binding: ${settings.smtp_password_secret_name}.`,
    );
  }

  const smtpHost = validatedText(
    required(settings.smtp_host, "SMTP host"),
    "SMTP host",
    253,
  ).toLowerCase();

  if (!smtpHostPattern.test(smtpHost)) {
    throw new Error("SMTP host is invalid.");
  }

  const smtpPort = settings.smtp_port ?? 587;

  if (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65_535) {
    throw new Error("SMTP port is invalid.");
  }

  return {
    ...settings,
    from_email: validatedEmail(
      required(settings.from_email, "From email"),
      "From email",
    ),
    from_name: validatedText(
      settings.from_name || "TheTattooCore",
      "From name",
      120,
    ),
    reply_to_email: settings.reply_to_email
      ? validatedEmail(settings.reply_to_email, "Reply-to email")
      : null,
    smtp_host: smtpHost,
    smtp_password_secret_name: hostgatorPasswordSecretName,
    smtp_port: smtpPort,
    smtp_username: validatedText(
      required(settings.smtp_username, "SMTP username"),
      "SMTP username",
      254,
    ),
  };
}

export async function sendHostgatorEmail({
  headers,
  html,
  recipientEmail,
  settings,
  subject,
  text,
}: TransactionalMailInput) {
  const production = process.env.NODE_ENV === "production";

  try {
    if (!settings.is_enabled) {
      throw new Error("Mail sending is disabled in admin settings.");
    }

    const validatedSettings = validateMailSettings(settings);
    const validatedRecipient = validatedEmail(recipientEmail, "Recipient email");
    const validatedSubject = validatedText(subject, "Mail subject", 200);
    const validatedMailHeaders = validatedHeaders(headers);
    const password = required(
      process.env[hostgatorPasswordSecretName],
      hostgatorPasswordSecretName,
    );
    const smtpPort = validatedSettings.smtp_port ?? 587;
    const useImplicitTls = smtpPort === 465 && validatedSettings.smtp_secure;
    const mailerModule = await import("worker-mailer");

    await mailerModule.WorkerMailer.send(
      {
        host: validatedSettings.smtp_host!,
        port: smtpPort,
        secure: useImplicitTls,
        startTls: true,
        authType: "plain",
        credentials: {
          username: validatedSettings.smtp_username!,
          password,
        },
        logLevel: production
          ? mailerModule.LogLevel.NONE
          : mailerModule.LogLevel.ERROR,
        socketTimeoutMs: 20_000,
        responseTimeoutMs: 20_000,
      },
      {
        from: {
          name: validatedSettings.from_name,
          email: validatedSettings.from_email!,
        },
        reply: validatedSettings.reply_to_email
          ? { email: validatedSettings.reply_to_email }
          : undefined,
        to: validatedRecipient,
        subject: validatedSubject,
        text,
        html,
        headers: validatedMailHeaders,
      },
    );
  } catch (error) {
    if (!production) throw error;

    throw new MailDeliveryError();
  }
}

export async function sendHostgatorTestEmail({
  recipientEmail,
  sentByEmail,
  settings,
}: TestMailInput) {
  const sentAt = new Date().toISOString();
  const requesterEmail = sentByEmail
    ? validatedEmail(sentByEmail, "Requester email")
    : undefined;

  await sendHostgatorEmail({
    headers: {
      "X-TheTattooCore-Test": "admin-mail",
    },
    html: [
      "<h1>TheTattooCore mail test</h1>",
      "<p>The production app sent this through the configured company mailbox.</p>",
      `<p><strong>Sent at:</strong> ${sentAt}</p>`,
      requesterEmail
        ? `<p><strong>Requested by:</strong> ${escapeHtml(requesterEmail)}</p>`
        : "",
    ].join(""),
    recipientEmail,
    settings,
    subject: "TheTattooCore admin mail test",
    text: [
      "TheTattooCore production mail test succeeded.",
      "",
      `Sent at: ${sentAt}`,
      requesterEmail ? `Requested by: ${requesterEmail}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
  });
}
