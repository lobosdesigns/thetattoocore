"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type ResetState = "checking" | "ready" | "saving" | "done" | "blocked";

export function ResetPasswordForm({ initialMessage }: { initialMessage?: string }) {
  const supabase = createClient();
  const [state, setState] = useState<ResetState>("checking");
  const [message, setMessage] = useState(initialMessage ?? "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    async function establishRecoverySession() {
      const params = new URLSearchParams(window.location.hash.slice(1));
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (error) {
          setMessage(error.message);
          setState("blocked");
          return;
        }

        window.history.replaceState(null, "", "/reset-password");
        setState("ready");
        return;
      }

      const { data } = await supabase.auth.getSession();
      setState(data.session ? "ready" : "blocked");
    }

    establishRecoverySession();
  }, [supabase.auth]);

  async function savePassword() {
    setMessage("");

    if (password.length < 8) {
      setMessage("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    setState("saving");
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setMessage(error.message);
      setState("ready");
      return;
    }

    setState("done");
    setMessage("Password updated. Opening your account...");
    window.location.assign("/account");
  }

  const isBusy = state === "checking" || state === "saving" || state === "done";

  return (
    <div className="rounded-lg border border-[#d8d1c6] bg-[#fffdf9] p-5">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Create new password</h1>
        <p className="mt-1 text-sm text-[#766d62]">
          Set the password you want to use for this account.
        </p>
      </div>

      {state === "checking" ? (
        <p className="mb-4 rounded-md border border-[#d8d1c6] bg-[#efe7da] px-3 py-2 text-sm">
          Checking reset link...
        </p>
      ) : null}

      {message ? (
        <p className="mb-4 rounded-md border border-[#d8d1c6] bg-[#efe7da] px-3 py-2 text-sm">
          {message}
        </p>
      ) : null}

      {state === "blocked" ? (
        <a
          className="flex h-11 items-center justify-center rounded-md bg-[#171412] px-4 text-sm font-semibold text-white"
          href="/forgot-password"
        >
          Request a new reset link
        </a>
      ) : (
        <form className="space-y-4" onSubmit={(event) => event.preventDefault()}>
          <label className="block">
            <span className="text-sm font-medium">New password</span>
            <input
              className="mt-2 h-11 w-full rounded-md border border-[#d8d1c6] bg-white px-3 text-sm outline-none focus:border-[#171412]"
              disabled={isBusy}
              minLength={8}
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium">Confirm password</span>
            <input
              className="mt-2 h-11 w-full rounded-md border border-[#d8d1c6] bg-white px-3 text-sm outline-none focus:border-[#171412]"
              disabled={isBusy}
              minLength={8}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              type="password"
              value={confirmPassword}
            />
          </label>

          <button
            className="h-11 w-full rounded-md bg-[#171412] px-4 text-sm font-semibold text-white disabled:opacity-50"
            disabled={isBusy}
            onClick={savePassword}
            type="button"
          >
            {state === "saving" ? "Saving" : "Save new password"}
          </button>
        </form>
      )}
    </div>
  );
}
