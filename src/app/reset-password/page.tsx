import Link from "next/link";
import type { Metadata } from "next";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
  title: "Reset password",
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="min-h-screen bg-[#f7f4ef] px-4 py-10 text-[#171412]">
      <section className="mx-auto w-full max-w-md">
        <Link className="mb-8 block text-sm font-semibold" href="/">
          TheTattooCore
        </Link>

        <ResetPasswordForm initialMessage={params.message} />
      </section>
    </main>
  );
}
