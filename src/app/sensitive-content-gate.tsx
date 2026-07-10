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
      ? "absolute inset-0 flex items-center justify-center bg-[#171412]/35 p-4 backdrop-blur-sm"
      : "";

  return (
    <div className={wrapperClass}>
      <div className="max-w-xs rounded-md border border-white/20 bg-[#171412]/92 p-4 text-center text-white shadow-2xl">
        <LockKeyhole className="mx-auto mb-2 size-6 text-[#c8953b]" />
        <p className="text-sm font-bold">{title}</p>
        <p className="mt-1 text-xs leading-5 text-white/70">{body}</p>
        {isSignedIn ? (
          <form action={acceptAdultTerms} className="mt-3">
            <input name="return_path" type="hidden" value={returnPath} />
            <button className="h-9 rounded-md bg-white px-3 text-sm font-semibold text-[#171412]">
              I am 18+
            </button>
          </form>
        ) : (
          <Link
            className="mt-3 inline-flex h-9 items-center justify-center rounded-md bg-white px-3 text-sm font-semibold text-[#171412]"
            href="/login"
          >
            Sign in
          </Link>
        )}
      </div>
    </div>
  );
}
