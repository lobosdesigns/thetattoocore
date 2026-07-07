import Link from "next/link";
import { redirect } from "next/navigation";
import { ProfileForm } from "./profile-form";
import { createClient } from "@/lib/supabase/server";

type Claims = {
  sub: string;
  email?: string;
};

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
      "username, display_name, account_type, bio, city, region, website_url, instagram_url",
    )
    .eq("id", claims.sub)
    .maybeSingle();

  return (
    <main className="min-h-screen bg-[#f7f4ef] px-4 py-8 text-[#171412]">
      <section className="mx-auto w-full max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <Link className="text-sm font-semibold" href="/">
            TheTattooCore
          </Link>
          <form action="/auth/signout" method="post">
            <button className="h-10 rounded-md border border-[#d8d1c6] bg-white px-4 text-sm font-semibold">
              Sign out
            </button>
          </form>
        </div>

        <ProfileForm claims={claims} initialProfile={profile} />
      </section>
    </main>
  );
}
