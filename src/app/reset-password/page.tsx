import Link from "next/link";
import { redirect } from "next/navigation";
import { updatePassword } from "./actions";
import { createClient } from "@/lib/supabase/server";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims?.sub) {
    redirect("/forgot-password?message=Request a reset link first.");
  }

  return (
    <main className="min-h-screen bg-[#f7f4ef] px-4 py-10 text-[#171412]">
      <section className="mx-auto w-full max-w-md">
        <Link className="mb-8 block text-sm font-semibold" href="/">
          TheTattooCore
        </Link>

        <div className="rounded-lg border border-[#d8d1c6] bg-[#fffdf9] p-5">
          <div className="mb-6">
            <h1 className="text-2xl font-bold">Create new password</h1>
            <p className="mt-1 text-sm text-[#766d62]">
              Set the password you want to use for this account.
            </p>
          </div>

          {params.message ? (
            <p className="mb-4 rounded-md border border-[#d8d1c6] bg-[#efe7da] px-3 py-2 text-sm">
              {params.message}
            </p>
          ) : null}

          <form className="space-y-4">
            <label className="block">
              <span className="text-sm font-medium">New password</span>
              <input
                className="mt-2 h-11 w-full rounded-md border border-[#d8d1c6] bg-white px-3 text-sm outline-none focus:border-[#171412]"
                minLength={8}
                name="password"
                required
                type="password"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium">Confirm password</span>
              <input
                className="mt-2 h-11 w-full rounded-md border border-[#d8d1c6] bg-white px-3 text-sm outline-none focus:border-[#171412]"
                minLength={8}
                name="confirmPassword"
                required
                type="password"
              />
            </label>

            <button
              className="h-11 w-full rounded-md bg-[#171412] px-4 text-sm font-semibold text-white"
              formAction={updatePassword}
            >
              Save new password
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
