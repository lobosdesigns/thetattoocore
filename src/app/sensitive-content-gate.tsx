import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import { acceptAdultTerms } from "@/app/actions";

type SensitiveContentGateProps = {
  context?: "discussion" | "media";
  isSignedIn: boolean;
  returnPath: string;
  variant?: "card" | "overlay";
};

export function SensitiveContentGate({
  context = "media",
  isSignedIn,
  returnPath,
  variant = "overlay",
}: SensitiveContentGateProps) {
  const title = isSignedIn
    ? "Confirm 18+ to see content"
    : "You must sign in to see content";
  const body =
    context === "discussion"
      ? "Sensitive non-nude body-art discussion requires login and 18+ confirmation."
      : "Sensitive non-nude body-art media requires login and 18+ confirmation.";
  const wrapperClass =
    variant === "overlay"
      ? "absolute inset-0 flex items-center justify-center bg-[color-mix(in_srgb,var(--foreground)_36%,transparent)] p-4 backdrop-blur-sm"
      : "";
  const loginHref = `/login?return_to=${encodeURIComponent(returnPath)}`;

  return (
    <div className={wrapperClass}>
      <div className="max-w-xs rounded-md border border-[color-mix(in_srgb,var(--background)_22%,transparent)] bg-[color-mix(in_srgb,var(--foreground)_92%,transparent)] p-4 text-center text-[var(--background)] shadow-2xl">
        <LockKeyhole className="mx-auto mb-2 size-6 text-[var(--gold)]" />
        <p className="text-sm font-bold">{title}</p>
        <p className="mt-1 text-xs leading-5 text-[color-mix(in_srgb,var(--background)_72%,transparent)]">{body}</p>
        {isSignedIn ? (
          <form action={acceptAdultTerms} className="mt-3">
            <input name="return_path" type="hidden" value={returnPath} />
            <button className="h-9 rounded-md bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 text-sm font-semibold text-[var(--foreground)]">
              I am 18+
            </button>
          </form>
        ) : (
          <Link
            className="mt-3 inline-flex h-9 items-center justify-center rounded-md bg-[color-mix(in_srgb,var(--paper-warm)_96%,transparent)] px-3 text-sm font-semibold text-[var(--foreground)]"
            href={loginHref}
          >
            Sign in
          </Link>
        )}
      </div>
    </div>
  );
}
