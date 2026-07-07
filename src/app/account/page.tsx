import Link from "next/link";
import { redirect } from "next/navigation";
import { ProfileForm } from "./profile-form";
import { createClient } from "@/lib/supabase/server";

type Claims = {
  sub: string;
  email?: string;
};

const adminRoles = ["moderator", "admin", "owner"];

export default async function AccountPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims as Claims | undefined;

  if (!claims?.sub) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "username, display_name, account_type, bio, city, region, website_url, instagram_url, role",
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

        <ProfileForm claims={claims} initialProfile={profile} />
      </section>
    </main>
  );
}
