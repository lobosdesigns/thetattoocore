import Link from "next/link";
import { redirect } from "next/navigation";
import { ProfileForm } from "./profile-form";
import { createClient } from "@/lib/supabase/server";

type Claims = {
  sub: string;
  email?: string;
};

const adminRoles = ["moderator", "admin", "owner"];

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims as Claims | undefined;

  if (!claims?.sub) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "username, display_name, account_type, bio, city, region, country_code, preferred_language, location_personalization_enabled, website_url, instagram_url, role",
    )
    .eq("id", claims.sub)
    .maybeSingle();

  const role = profile?.role as string | undefined;

  return (
    <main className="min-h-screen bg-[#f7f4ef] px-4 py-8 text-[#171412]">
      <section className="mx-auto w-full max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <Link className="text-sm font-semibold" href="/">
            TheTattooCore
          </Link>
          <div className="flex items-center gap-3">
            {role && adminRoles.includes(role) ? (
              <Link
                className="flex h-10 items-center rounded-md border border-[#d8d1c6] bg-white px-4 text-sm font-semibold"
                href="/admin"
              >
                Admin
              </Link>
            ) : null}
            <form action="/auth/signout" method="post">
              <button className="h-10 rounded-md border border-[#d8d1c6] bg-white px-4 text-sm font-semibold">
                Sign out
              </button>
            </form>
          </div>
        </div>

        {params.message ? (
          <p className="mb-4 rounded-md border border-[#d8d1c6] bg-[#efe7da] px-4 py-3 text-sm font-medium">
            {params.message}
          </p>
        ) : null}

        <ProfileForm claims={claims} initialProfile={profile} />
      </section>
    </main>
  );
}
