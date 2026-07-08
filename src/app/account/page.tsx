import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { submitLicenseVerification } from "./actions";
import { LicenseDocumentInput } from "./license-document-input";
import { ProfileForm } from "./profile-form";
import { PendingSubmitButton } from "../pending-submit-button";
import { createClient } from "@/lib/supabase/server";

type Claims = {
  sub: string;
  email?: string;
};

const adminRoles = ["moderator", "admin", "owner"];
const verificationEligibleTypes = ["artist", "studio"];
const accountNavItems = [
  ["#profile-settings", "Profile"],
  ["#privacy-settings", "Privacy"],
  ["#notification-settings", "Notifications"],
  ["#verification-settings", "Verification"],
] as const;

function AccountSetupGuide({
  isFirstProfile,
}: {
  isFirstProfile: boolean;
}) {
  const steps = [
    ["1", "Save profile", "Choose a username, account type, country, language, and confirm 18+."],
    ["2", "Start posting", "Use the bottom-right plus button from 4U, Gossip, Stuff, or Gigs."],
    ["3", "Verify later", "Artists and studios can upload license documents for admin review."],
  ] as const;

  return (
    <section className="mb-4 rounded-lg border border-[#d8d1c6] bg-[#171412] p-5 text-white">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/60">
            {isFirstProfile ? "First setup" : "Account path"}
          </p>
          <h1 className="mt-2 text-2xl font-bold">
            {isFirstProfile
              ? "Set up your core profile"
              : "Keep your account ready to post"}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/75">
            {isFirstProfile
              ? "This one save unlocks posting, comments, DMs, follows, marketplace listings, and gigs."
              : "Your saved profile powers posting, public discovery, DMs, local results, and verification."}
          </p>
        </div>
        <Link
          className="inline-flex h-10 shrink-0 items-center justify-center rounded-md bg-white px-4 text-sm font-semibold text-[#171412]"
          href="/"
        >
          Open app
        </Link>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {steps.map(([number, title, body]) => (
          <div
            className="rounded-md border border-white/15 bg-white/5 p-3"
            key={number}
          >
            <span className="inline-flex size-7 items-center justify-center rounded-md bg-white text-sm font-bold text-[#171412]">
              {number}
            </span>
            <h2 className="mt-3 text-sm font-bold">{title}</h2>
            <p className="mt-1 text-xs leading-5 text-white/70">{body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
  title: "Account",
};

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
      "username, display_name, account_type, bio, city, region, country_code, preferred_language, location_personalization_enabled, is_adult_confirmed, is_private, adult_terms_accepted_at, website_url, instagram_url, license_verified_at, role, notify_follow_activity, notify_message_activity, notify_feed_activity, notify_thread_activity, notify_marketplace_gig_activity",
    )
    .eq("id", claims.sub)
    .maybeSingle();

  const role = profile?.role as string | undefined;
  const { data: verificationRequests } = await supabase
    .from("license_verification_requests")
    .select("id, license_name, issuing_region, status, created_at, reviewed_at")
    .eq("profile_id", claims.sub)
    .order("created_at", { ascending: false })
    .limit(3)
    .returns<
      {
        created_at: string;
        id: string;
        issuing_region: string;
        license_name: string;
        reviewed_at: string | null;
        status: "pending" | "approved" | "rejected";
      }[]
    >();
  const canSubmitLicense =
    profile?.account_type &&
    verificationEligibleTypes.includes(profile.account_type as string);
  const isLicenseVerified = Boolean(profile?.license_verified_at);
  const isFirstProfile = !profile;

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

        <AccountSetupGuide isFirstProfile={isFirstProfile} />

        <nav
          aria-label="Account settings"
          className="mb-4 flex gap-2 overflow-x-auto rounded-lg border border-[#d8d1c6] bg-[#fffdf9] p-2"
        >
          {accountNavItems.map(([href, label]) => (
            <a
              className="flex h-10 shrink-0 items-center rounded-md border border-transparent px-3 text-sm font-semibold text-[#4f473f] hover:border-[#d8d1c6] hover:bg-[#f7f4ef]"
              href={href}
              key={href}
            >
              {label}
            </a>
          ))}
        </nav>

        <ProfileForm claims={claims} initialProfile={profile} />

        {canSubmitLicense ? (
          <section
            className="mt-6 scroll-mt-4 rounded-lg border border-[#d8d1c6] bg-[#fffdf9] p-5"
            id="verification-settings"
          >
            <div className="mb-5">
              <h2 className="text-xl font-bold">
                Artist/studio license verification
              </h2>
              <p className="mt-1 text-sm leading-6 text-[#766d62]">
                Upload your tattoo license, shop license, certification, or
                local proof that you can legally tattoo or operate as a studio.
                Documents are private and reviewed by authorized admins.
              </p>
              <p className="mt-2 text-xs font-semibold text-[#766d62]">
                Accepted files: PDF, JPG, PNG, or WebP up to 10 MB.
              </p>
              {isLicenseVerified ? (
                <p className="mt-3 rounded-md bg-[#171412] px-3 py-2 text-sm font-semibold text-white">
                  Your {profile?.account_type} profile is license verified.
                </p>
              ) : null}
            </div>

            {verificationRequests?.length ? (
              <div className="mb-5 space-y-2">
                {verificationRequests.map((request) => (
                  <div
                    className="rounded-md border border-[#d8d1c6] bg-[#f7f4ef] p-3 text-sm"
                    key={request.id}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold">{request.license_name}</p>
                      <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold capitalize">
                        {request.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[#766d62]">
                      {request.issuing_region} - Submitted{" "}
                      {new Date(request.created_at).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}

            <form action={submitLicenseVerification} className="grid gap-4">
              <label className="block">
                <span className="text-sm font-medium">
                  License or certification name <span className="text-[#a3432f]">*</span>
                </span>
                <input
                  className="mt-2 h-11 w-full rounded-md border border-[#d8d1c6] bg-white px-3 text-sm outline-none focus:border-[#171412]"
                  name="license_name"
                  placeholder="Tattoo artist license"
                  required
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium">
                    License number
                  </span>
                  <input
                    className="mt-2 h-11 w-full rounded-md border border-[#d8d1c6] bg-white px-3 text-sm outline-none focus:border-[#171412]"
                    name="license_number"
                    placeholder="Optional"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium">
                    Issuing city/state/country <span className="text-[#a3432f]">*</span>
                  </span>
                  <input
                    className="mt-2 h-11 w-full rounded-md border border-[#d8d1c6] bg-white px-3 text-sm outline-none focus:border-[#171412]"
                    name="issuing_region"
                    placeholder="Austin, TX"
                    required
                  />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium">Expiration date</span>
                  <input
                    className="mt-2 h-11 w-full rounded-md border border-[#d8d1c6] bg-white px-3 text-sm outline-none focus:border-[#171412]"
                    name="expires_on"
                    type="date"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium">
                    License document <span className="text-[#a3432f]">*</span>
                  </span>
                  <div className="mt-2">
                    <LicenseDocumentInput
                      accept="application/pdf,image/jpeg,image/png,image/webp"
                      name="license_document"
                      required
                    />
                  </div>
                  <span className="mt-1 block text-xs leading-5 text-[#766d62]">
                    Private admin review only. Public users only see verified status after approval.
                  </span>
                </label>
              </div>

              <PendingSubmitButton
                className="h-11 rounded-md bg-[#171412] px-5 text-sm font-semibold text-white"
                pendingLabel="Submitting"
              >
                Submit for review
              </PendingSubmitButton>
            </form>
          </section>
        ) : (
          <section
            className="mt-6 scroll-mt-4 rounded-lg border border-[#d8d1c6] bg-[#fffdf9] p-5"
            id="verification-settings"
          >
            <h2 className="text-xl font-bold">Artist/studio verification</h2>
            <p className="mt-2 text-sm leading-6 text-[#766d62]">
              Choose Artist or Studio as your account type and save your profile
              to submit license or certification documents.
            </p>
          </section>
        )}
      </section>
    </main>
  );
}
