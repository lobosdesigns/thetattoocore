import Link from "next/link";

export function AuthLegalLinks() {
  return (
    <p className="text-center text-xs leading-5 text-[var(--muted-strong)]">
      Need help or policy details? Visit{" "}
      <Link className="font-semibold underline" href="/support">
        Support
      </Link>
      ,{" "}
      <Link className="font-semibold underline" href="/help">
        Help Center
      </Link>
      ,{" "}
      <Link className="font-semibold underline" href="/terms">
        Terms
      </Link>
      , and{" "}
      <Link className="font-semibold underline" href="/privacy">
        Privacy
      </Link>
      .
    </p>
  );
}
