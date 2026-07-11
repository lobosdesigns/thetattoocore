"use client";

import { useState, type FormEvent } from "react";
import { Send } from "lucide-react";

type MailTestFormProps = {
  defaultRecipient?: string;
  disabled?: boolean;
};

export function MailTestForm({
  defaultRecipient = "",
  disabled = false,
}: MailTestFormProps) {
  const [recipientEmail, setRecipientEmail] = useState(defaultRecipient);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");

  async function sendTest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setMessage("");

    const response = await fetch("/api/admin/mail/test", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ recipientEmail }),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
    };

    if (!response.ok) {
      setStatus("error");
      setMessage(payload.error ?? "Could not send the test email.");
      return;
    }

    setStatus("sent");
    setMessage("Test email sent. Check inbox and junk.");
  }

  return (
    <form className="space-y-3" onSubmit={sendTest}>
      <label className="block text-sm font-semibold" htmlFor="mail-test-email">
        Test recipient
      </label>
      <input
        className="h-10 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
        disabled={disabled || status === "sending"}
        id="mail-test-email"
        onChange={(event) => setRecipientEmail(event.target.value)}
        placeholder="you@example.com"
        type="email"
        value={recipientEmail}
      />
      <button
        className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[var(--foreground)] px-4 text-sm font-semibold text-[var(--background)] disabled:cursor-not-allowed disabled:opacity-60"
        disabled={disabled || status === "sending"}
        type="submit"
      >
        <Send className="size-4" />
        {status === "sending" ? "Sending..." : "Send test email"}
      </button>
      {message ? (
        <p
          className={`text-sm ${
            status === "error" ? "text-red-700" : "text-[color-mix(in_srgb,#1f7a38_78%,var(--foreground))]"
          }`}
        >
          {message}
        </p>
      ) : null}
    </form>
  );
}
