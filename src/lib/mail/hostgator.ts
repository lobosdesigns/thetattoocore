type MailSettings = {
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

function required(value: string | null | undefined, label: string) {
  if (!value) {
    throw new Error(`${label} is not configured.`);
  }

  return value;
}

export async function sendHostgatorTestEmail({
  recipientEmail,
  sentByEmail,
  settings,
}: TestMailInput) {
  if (!settings.is_enabled) {
    throw new Error("Mail sending is disabled in admin settings.");
  }

  const fromEmail = required(settings.from_email, "From email");
  const smtpHost = required(settings.smtp_host, "SMTP host");
  const smtpUsername = required(settings.smtp_username, "SMTP username");
  const smtpPort = settings.smtp_port ?? 587;
  const useImplicitTls = smtpPort === 465 && settings.smtp_secure;
  const password = required(
    process.env[settings.smtp_password_secret_name],
    settings.smtp_password_secret_name,
  );
  const sentAt = new Date().toISOString();
  const mailerModule = await import("worker-mailer");

  await mailerModule.WorkerMailer.send(
    {
      host: smtpHost,
      port: smtpPort,
      secure: useImplicitTls,
      startTls: true,
      authType: "plain",
      credentials: {
        username: smtpUsername,
        password,
      },
      logLevel: mailerModule.LogLevel.ERROR,
      socketTimeoutMs: 20_000,
      responseTimeoutMs: 20_000,
    },
    {
      from: {
        name: settings.from_name || "TheTattooCore",
        email: fromEmail,
      },
      reply: settings.reply_to_email
        ? { email: settings.reply_to_email }
        : undefined,
      to: recipientEmail,
      subject: "TheTattooCore admin mail test",
      text: [
        "TheTattooCore production mail test succeeded.",
        "",
        `Sent at: ${sentAt}`,
        sentByEmail ? `Requested by: ${sentByEmail}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
      html: [
        "<h1>TheTattooCore mail test</h1>",
        "<p>The production app sent this through the configured HostGator SMTP mailbox.</p>",
        `<p><strong>Sent at:</strong> ${sentAt}</p>`,
        sentByEmail
          ? `<p><strong>Requested by:</strong> ${sentByEmail}</p>`
          : "",
      ].join(""),
      headers: {
        "X-TheTattooCore-Test": "admin-mail",
      },
    },
  );
}
