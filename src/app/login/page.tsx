import Link from "next/link";
import { login, signup } from "./actions";

export default async function LoginPage({
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

        <div className="rounded-lg border border-[#d8d1c6] bg-[#fffdf9] p-5">
          <div className="mb-6">
            <h1 className="text-2xl font-bold">Sign in</h1>
            <p className="mt-1 text-sm text-[#766d62]">
              Create your artist or enthusiast profile.
            </p>
          </div>

          {params.message ? (
            <p className="mb-4 rounded-md border border-[#d8d1c6] bg-[#efe7da] px-3 py-2 text-sm">
              {params.message}
            </p>
          ) : null}

          <form className="space-y-4">
            <label className="block">
              <span className="text-sm font-medium">Email</span>
              <input
                className="mt-2 h-11 w-full rounded-md border border-[#d8d1c6] bg-white px-3 text-sm outline-none focus:border-[#171412]"
                name="email"
                required
                type="email"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium">Password</span>
              <input
                className="mt-2 h-11 w-full rounded-md border border-[#d8d1c6] bg-white px-3 text-sm outline-none focus:border-[#171412]"
                minLength={8}
                name="password"
                required
                type="password"
              />
            </label>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                className="h-11 rounded-md bg-[#171412] px-4 text-sm font-semibold text-white"
                formAction={login}
              >
                Sign in
              </button>
              <button
                className="h-11 rounded-md border border-[#d8d1c6] bg-white px-4 text-sm font-semibold"
                formAction={signup}
              >
                Sign up
              </button>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}
