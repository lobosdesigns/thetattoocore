import assert from "node:assert/strict";
import {
  MailDeliveryError,
  sendHostgatorEmail,
} from "../src/lib/mail/hostgator.ts";

const originalNodeEnv = process.env.NODE_ENV;
const secretName = "TTC_MAIL_REDACTION_SENTINEL";
const originalSecret = process.env[secretName];
const settings = {
  from_email: "sender@example.invalid",
  from_name: "TTC Test",
  is_enabled: true,
  reply_to_email: null,
  smtp_host: "mail.example.invalid",
  smtp_password_secret_name: secretName,
  smtp_port: 587,
  smtp_secure: true,
  smtp_username: "sender@example.invalid",
};

delete process.env[secretName];

try {
  process.env.NODE_ENV = "production";

  await assert.rejects(
    sendHostgatorEmail({
      recipientEmail: "recipient@example.invalid",
      settings,
      subject: "Redaction test",
      text: "No message is sent because configuration validation fails first.",
    }),
    (error) => {
      assert.equal(error instanceof MailDeliveryError, true);
      assert.equal(error.message, "Mail delivery failed.");
      assert.doesNotMatch(String(error.stack), new RegExp(secretName));
      assert.equal("cause" in error, false);
      return true;
    },
  );

  process.env.NODE_ENV = "test";

  await assert.rejects(
    sendHostgatorEmail({
      recipientEmail: "recipient@example.invalid",
      settings,
      subject: "Diagnostic test",
      text: "No message is sent because configuration validation fails first.",
    }),
    new RegExp(secretName),
  );
} finally {
  if (originalNodeEnv === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = originalNodeEnv;
  }

  if (originalSecret === undefined) {
    delete process.env[secretName];
  } else {
    process.env[secretName] = originalSecret;
  }
}

console.log("PASS production mail failures redact configuration and transport details");
console.log("PASS non-production mail failures retain diagnostic detail");
