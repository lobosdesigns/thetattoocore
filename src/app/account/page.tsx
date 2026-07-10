import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  requestAccountDeletion,
  submitAdCampaign,
  submitLicenseVerification,
} from "./actions";
import { LicenseDocumentInput } from "./license-document-input";
import { ProfileForm } from "./profile-form";
import { PendingSubmitButton } from "../pending-submit-button";
import { countryOptions, languageOptions } from "@/lib/localization";
import { createClient } from "@/lib/supabase/server";
import { verificationEligibleAccountTypes } from "@/lib/verification";

type Claims = {
  sub: string;
  email?: string;
};

const adminRoles = ["moderator", "admin", "owner"];
const accountNavItems = [
  ["#profile-settings", "Profile"],
  ["#language-settings", "Language"],
  ["#privacy-settings", "Privacy"],
  ["#notification-settings", "Notifications"],
  ["#verification-settings", "Verification"],
  ["#advertising-settings", "Advertising"],
  ["#data-settings", "Data"],
] as const;

function AccountSetupGuide({
  isFirstProfile,
}: {
  isFirstProfile: boolean;
}) {
  const steps = [
    ["1", "Save profile", "Choose a username, account type, country, language, and confirm 18+."],
    ["2", "Start posting", "Use the bottom-right plus button from 4U, Gossip, Stuff, or Gigs."],
    ["3", "Verify later", "Artists, studios, and vendors can upload license or business documents for admin review."],
  ] as const;

  return (
    <section className="mb-4 rounded-lg border border-[#3a332d] bg-[#171412] p-5 text-white shadow-[0_14px_34px_rgba(0,0,0,0.24)]">
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
              ? "This one save unlocks posting, comments, DMs, follows, and community features. Stuff transactions need verification."
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

function adLabel(value: string) {
  if (value === "4u") return "4U";

  return value.replaceAll("_", " ");
}

const verificationStandards = [
  "Artists and studios must show current licensing, certification, or local legal proof before professional access is approved.",
  "Vendors must show proper business licensing before vendor access, seller contact, or Stuff trading is approved.",
  "Stuff stays browseable for fans, but buy, sell, trade, and seller-contact actions are reserved for verified artists, studios, and vendors.",
  "Expired documents, scratcher activity, unlicensed studios, AI tattoo art claims, and unsafe equipment access are rejected.",
] as const;

const advertisingStandards = [
  "Artist growth campaigns can appear in 4U and Gossip for leads, messages, and engagement.",
  "Stuff campaigns stay in Stuff and focus on listing views, eligible seller messages, and marketplace engagement.",
  "Targeting stays simple: coarse location, language, style keywords, category, and chosen placement.",
] as const;

const advertisingReviewRules = [
  "No AI-generated tattoo art or misleading AI creator replacement claims.",
  "No scratcher promotion, unlicensed studio promotion, or unsafe equipment sales.",
  "No sensitive personal targeting, adult/minor targeting, or hidden behavioral profiling.",
] as const;

function dollars(cents: number) {
  return Intl.NumberFormat("en-US", {
    currency: "USD",
    style: "currency",
  }).format(cents / 100);
}

function adClickRate({
  clicks,
  impressions,
}: {
  clicks: number;
  impressions: number;
}) {
  if (!impressions) return "0.0%";

  return `${((clicks / impressions) * 100).toFixed(1)}%`;
}

function verificationStatusClass(status: "pending" | "approved" | "rejected") {
  if (status === "approved") return "border-[#b9d7bd] bg-[#eef8ef] text-[#276231]";
  if (status === "rejected") return "border-[#e5b8b8] bg-[#fff0f0] text-[#8a2828]";

  return "border-[#e5c58f] bg-[#fff7ec] text-[#7a4a08]";
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString() : "Not provided";
}

function isExpiredDate(value: string | null) {
  if (!value) return false;

  const date = new Date(`${value}T23:59:59`);

  return Number.isFinite(date.getTime()) && date.getTime() < Date.now();
}

function AccountReadinessPanel({
  canSubmitLicense,
  canUploadVerification,
  hasPendingVerification,
  isLicenseVerified,
  profile,
}: {
  canSubmitLicense: string | false | undefined;
  canUploadVerification: boolean;
  hasPendingVerification: boolean;
  isLicenseVerified: boolean;
  profile:
    | {
        banned_at?: string | null;
        is_adult_confirmed?: boolean | null;
        license_verified_at?: string | null;
        suspended_at?: string | null;
        username?: string | null;
      }
    | null;
}) {
  const items = [
    {
      body: profile?.username
        ? `@${profile.username} is saved.`
        : "Choose and save a username first.",
      label: "Profile",
      ready: Boolean(profile?.username),
    },
    {
      body: profile?.is_adult_confirmed
        ? "18+ confirmation is saved."
        : "Confirm 18+ terms before viewing sensitive non-nude body-art content.",
      label: "18+",
      ready: Boolean(profile?.is_adult_confirmed),
    },
    {
      body: isLicenseVerified
        ? "Stuff seller contact and professional gear access are active."
        : hasPendingVerification
          ? "Verification is waiting for admin review."
          : canSubmitLicense
            ? "Upload current license or business proof."
            : "Switch account type to artist, studio, or vendor to apply.",
      label: "Verification",
      ready: isLicenseVerified,
    },
    {
      body: profile?.banned_at
        ? "Account is banned."
        : profile?.suspended_at
          ? "Account is suspended."
          : "Account is in good standing.",
      label: "Standing",
      ready: !profile?.banned_at && !profile?.suspended_at,
    },
  ];

  return (
    <section className="mb-4 rounded-lg border border-[#cfc8bd] bg-[#f2f1ee] p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-[#766d62]">
            Account readiness
          </p>
          <h2 className="text-lg font-bold">What is unlocked right now</h2>
        </div>
        {canUploadVerification ? (
          <a
            className="inline-flex h-9 items-center justify-center rounded-md bg-[#171412] px-3 text-sm font-semibold text-white"
            href="#verification-settings"
          >
            Upload proof
          </a>
        ) : null}
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {items.map((item) => (
          <div
            className="rounded-md border border-[#d8d1c6] bg-[#fffdf9] px-3 py-2"
            key={item.label}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold">{item.label}</p>
              <span
                className={`rounded-md px-2 py-1 text-xs font-semibold ${
                  item.ready
                    ? "bg-[#eef8ef] text-[#276231]"
                    : "bg-[#fff7ec] text-[#7a4a08]"
                }`}
              >
                {item.ready ? "Ready" : "Needs work"}
              </span>
            </div>
            <p className="mt-1 text-xs leading-5 text-[#766d62]">{item.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

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
      "username, display_name, avatar_url, account_type, bio, city, region, country_code, preferred_language, location_personalization_enabled, is_adult_confirmed, is_private, adult_terms_accepted_at, website_url, instagram_url, license_verified_at, suspended_at, banned_at, role, notify_follow_activity, notify_message_activity, notify_feed_activity, notify_thread_activity, notify_marketplace_gig_activity, notification_quiet_hours_enabled, notification_quiet_hours_start, notification_quiet_hours_end, notification_timezone, notify_email_important, notify_push_enabled",
    )
    .eq("id", claims.sub)
    .maybeSingle();

  const role = profile?.role as string | undefined;
  const { data: verificationRequests } = await supabase
    .from("license_verification_requests")
    .select(
      "id, license_name, issuing_region, expires_on, status, reviewer_note, created_at, reviewed_at",
    )
    .eq("profile_id", claims.sub)
    .order("created_at", { ascending: false })
    .limit(3)
    .returns<
      {
        created_at: string;
        expires_on: string | null;
        id: string;
        issuing_region: string;
        license_name: string;
        reviewed_at: string | null;
        reviewer_note: string | null;
        status: "pending" | "approved" | "rejected";
      }[]
    >();
  const { data: adCampaigns } = await supabase
    .from("ad_campaigns")
    .select(
      "id, name, title, campaign_type, goal, status, bid_cents, daily_budget_cents, created_at, ad_campaign_placements(placement), ad_events(event_type)",
    )
    .eq("advertiser_id", claims.sub)
    .order("created_at", { ascending: false })
    .limit(5)
    .returns<
      {
        ad_events: { event_type: "impression" | "click" | "message_lead" }[];
        ad_campaign_placements: { placement: "4u" | "gossip" | "stuff" }[];
        bid_cents: number;
        campaign_type: string;
        created_at: string;
        daily_budget_cents: number;
        goal: string;
        id: string;
        name: string;
        status: string;
        title: string;
      }[]
    >();
  const { data: deletionRequests } = await supabase
    .from("account_deletion_requests")
    .select("id, status, requested_at, reviewer_note")
    .eq("profile_id", claims.sub)
    .order("requested_at", { ascending: false })
    .limit(3)
    .returns<
      {
        id: string;
        requested_at: string;
        reviewer_note: string | null;
        status: "pending" | "reviewing" | "completed" | "rejected" | "cancelled";
      }[]
    >();
  const canSubmitLicense =
    profile?.account_type &&
    verificationEligibleAccountTypes.includes(profile.account_type as string);
  const isLicenseVerified = Boolean(profile?.license_verified_at);
  const latestVerificationRequest = verificationRequests?.[0] ?? null;
  const hasPendingVerification = Boolean(
    verificationRequests?.some((request) => request.status === "pending"),
  );
  const canUploadVerification =
    Boolean(canSubmitLicense) && !isLicenseVerified && !hasPendingVerification;
  const canSubmitAds =
    canSubmitLicense && isLicenseVerified && !profile?.suspended_at && !profile?.banned_at;
  const isFirstProfile = !profile;

  return (
    <main className="min-h-screen bg-[#202020] px-4 py-8 text-[#171412]">
      <section className="mx-auto w-full max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <Link className="text-sm font-semibold text-[#f2f1ee]" href="/">
            TheTattooCore
          </Link>
          <div className="flex items-center gap-3">
            {role && adminRoles.includes(role) ? (
              <Link
                className="flex h-10 items-center rounded-md border border-[#cfc8bd] bg-[#fffdf9] px-4 text-sm font-semibold"
                href="/admin"
              >
                Admin
              </Link>
            ) : null}
            <form action="/auth/signout" method="post">
              <button className="h-10 rounded-md border border-[#cfc8bd] bg-[#fffdf9] px-4 text-sm font-semibold">
                Sign out
              </button>
            </form>
          </div>
        </div>

        {params.message ? (
          <p className="mb-4 rounded-md border border-[#cfc8bd] bg-[#e8e4dc] px-4 py-3 text-sm font-medium">
            {params.message}
          </p>
        ) : null}

        <AccountSetupGuide isFirstProfile={isFirstProfile} />

        <AccountReadinessPanel
          canSubmitLicense={canSubmitLicense}
          canUploadVerification={canUploadVerification}
          hasPendingVerification={hasPendingVerification}
          isLicenseVerified={isLicenseVerified}
          profile={profile}
        />

        <nav
          aria-label="Account settings"
          className="mb-4 flex gap-2 overflow-x-auto rounded-lg border border-[#cfc8bd] bg-[#f2f1ee] p-2"
        >
          {accountNavItems.map(([href, label]) => (
            <a
              className="flex h-10 shrink-0 items-center rounded-md border border-transparent px-3 text-sm font-semibold text-[#4f473f] hover:border-[#c8953b] hover:bg-[#fffdf9]"
              href={href}
              key={href}
            >
              {label}
            </a>
          ))}
        </nav>

        <ProfileForm claims={claims} initialProfile={profile} />

        <section
          className="ttc-card mt-6 scroll-mt-4 rounded-lg border border-[#cfc8bd] bg-[#f2f1ee] p-5"
          id="data-settings"
        >
          <h2 className="text-xl font-bold">Account and data</h2>
          <p className="mt-2 text-sm leading-6 text-[#766d62]">
            You can make your profile private anytime. Account deletion is a
            manual review request during launch so safety reports, marketplace
            issues, and legal obligations can be handled correctly.
          </p>
          {deletionRequests?.length ? (
            <div className="mt-4 grid gap-2">
              {deletionRequests.map((request) => (
                <div
                  className="rounded-md border border-[#d8d1c6] bg-[#fffdf9] px-3 py-2 text-sm"
                  key={request.id}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold capitalize">
                      {request.status} deletion request
                    </p>
                    <p className="text-xs text-[#766d62]">
                      {formatDate(request.requested_at)}
                    </p>
                  </div>
                  {request.reviewer_note ? (
                    <p className="mt-1 text-xs leading-5 text-[#766d62]">
                      {request.reviewer_note}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
          <form action={requestAccountDeletion} className="mt-4 grid gap-3">
            <label className="block">
              <span className="text-sm font-medium">Reason, optional</span>
              <textarea
                className="mt-2 min-h-20 w-full rounded-md border border-[#d8d1c6] bg-white px-3 py-3 text-sm outline-none focus:border-[#171412]"
                maxLength={500}
                name="delete_reason"
                placeholder="Tell admins what should be reviewed before deletion."
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">
                Type DELETE to request account deletion
              </span>
              <input
                className="mt-2 h-11 w-full rounded-md border border-[#d8d1c6] bg-white px-3 text-sm outline-none focus:border-[#171412]"
                name="delete_confirmation"
                placeholder="DELETE"
              />
            </label>
            <PendingSubmitButton
              className="h-11 w-fit rounded-md border border-[#a3432f] bg-white px-5 text-sm font-semibold text-[#8a2828]"
              pendingLabel="Submitting"
            >
              Request account deletion
            </PendingSubmitButton>
          </form>
          <p className="mt-3 text-xs leading-5 text-[#766d62]">
            For urgent privacy or safety help, use the public support page.
          </p>
        </section>

        {canSubmitLicense ? (
          <section
            className="ttc-card mt-6 scroll-mt-4 rounded-lg border border-[#cfc8bd] bg-[#f2f1ee] p-5"
            id="verification-settings"
          >
            <div className="mb-5">
              <h2 className="text-xl font-bold">
                Artist, studio, and vendor verification
              </h2>
              <p className="mt-1 text-sm leading-6 text-[#766d62]">
                Upload your tattoo license, shop license, certification,
                vendor business license, or local proof that you can legally
                tattoo, operate, or sell as a body-art vendor. Documents are
                private and reviewed by authorized admins.
              </p>
              <p className="mt-2 text-xs font-semibold text-[#766d62]">
                Accepted files: PDF, JPG, PNG, or WebP up to 10 MB.
              </p>
              <div className="mt-4 grid gap-2">
                {verificationStandards.map((standard) => (
                  <p
                    className="rounded-md border border-[#d8d1c6] bg-[#fffdf9] px-3 py-2 text-xs leading-5 text-[#4f473f]"
                    key={standard}
                  >
                    {standard}
                  </p>
                ))}
              </div>
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
                    className="rounded-md border border-[#cfc8bd] bg-[#fffdf9] p-3 text-sm"
                    key={request.id}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold">{request.license_name}</p>
                      <span
                        className={`rounded-md border px-2 py-1 text-xs font-semibold capitalize ${verificationStatusClass(
                          request.status,
                        )}`}
                      >
                        {request.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[#766d62]">
                      {request.issuing_region} - Submitted{" "}
                      {formatDate(request.created_at)}
                    </p>
                    <p className="mt-1 text-xs text-[#766d62]">
                      Expires {formatDate(request.expires_on)}
                      {isExpiredDate(request.expires_on) ? " - expired" : ""}
                      {request.reviewed_at
                        ? ` - Reviewed ${formatDate(request.reviewed_at)}`
                        : ""}
                    </p>
                    {request.status === "pending" ? (
                      <p className="mt-2 rounded-md border border-[#e5c58f] bg-[#fff7ec] px-3 py-2 text-xs leading-5 text-[#7a4a08]">
                        This request is waiting for admin review. New uploads
                        open again if it is rejected.
                      </p>
                    ) : null}
                    {request.status === "rejected" && request.reviewer_note ? (
                      <p className="mt-2 rounded-md border border-[#e5b8b8] bg-[#fff0f0] px-3 py-2 text-xs leading-5 text-[#8a2828]">
                        Admin note: {request.reviewer_note}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}

            {!canUploadVerification ? (
              <div className="rounded-md border border-[#d8d1c6] bg-[#fffdf9] px-3 py-2 text-sm leading-6 text-[#4f473f]">
                {isLicenseVerified
                  ? "Your verification is active. Keep a current license or business document ready for renewal when we add renewal reminders."
                  : "Your latest request is pending review. You can submit updated proof if an admin rejects it."}
              </div>
            ) : null}

            {canUploadVerification ? (
              <form action={submitLicenseVerification} className="grid gap-4">
                {latestVerificationRequest?.status === "rejected" ? (
                  <p className="rounded-md border border-[#e5ded4] bg-[#fffdf9] px-3 py-2 text-sm leading-6 text-[#4f473f]">
                    Submit updated proof after fixing the last rejection note.
                  </p>
                ) : null}
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
            ) : null}
          </section>
        ) : (
          <section
            className="mt-6 scroll-mt-4 rounded-lg border border-[#d8d1c6] bg-[#fffdf9] p-5"
            id="verification-settings"
          >
            <h2 className="text-xl font-bold">Artist, studio, and vendor verification</h2>
            <p className="mt-2 text-sm leading-6 text-[#766d62]">
              Choose Artist, Studio, or Vendor as your account type and save
              your profile to submit license, certification, or business
              documents.
            </p>
            <div className="mt-4 grid gap-2">
              {verificationStandards.map((standard) => (
                <p
                  className="rounded-md border border-[#e5ded4] bg-[#f7f4ef] px-3 py-2 text-xs leading-5 text-[#4f473f]"
                  key={standard}
                >
                  {standard}
                </p>
              ))}
            </div>
          </section>
        )}

        <section
          className="ttc-card mt-6 scroll-mt-4 rounded-lg border border-[#cfc8bd] bg-[#f2f1ee] p-5"
          id="advertising-settings"
        >
          <div className="mb-5">
            <h2 className="text-xl font-bold">Advertising</h2>
            <p className="mt-1 text-sm leading-6 text-[#766d62]">
              Verified artists, studios, and vendors can submit simple campaigns
              for admin review. Artist growth ads can run in 4U and Gossip.
              Stuff ads stay in Stuff.
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {advertisingStandards.map((standard) => (
                <p
                  className="rounded-md border border-[#d8d1c6] bg-[#fffdf9] px-3 py-2 text-xs leading-5 text-[#4f473f]"
                  key={standard}
                >
                  {standard}
                </p>
              ))}
            </div>
            <div className="mt-4 rounded-md border border-[#d8d1c6] bg-[#fffdf9] p-3">
              <p className="text-xs font-bold uppercase text-[#766d62]">
                Review rules
              </p>
              <ul className="mt-2 grid gap-2 text-xs leading-5 text-[#4f473f]">
                {advertisingReviewRules.map((rule) => (
                  <li key={rule}>{rule}</li>
                ))}
              </ul>
            </div>
          </div>

          {adCampaigns?.length ? (
            <div className="mb-5 grid gap-3">
              {adCampaigns.map((campaign) => {
                const clicks = campaign.ad_events.filter(
                  (event) => event.event_type === "click",
                ).length;
                const impressions = campaign.ad_events.filter(
                  (event) => event.event_type === "impression",
                ).length;

                return (
                  <article
                    className="rounded-md border border-[#cfc8bd] bg-[#fffdf9] p-3 text-sm"
                    key={campaign.id}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{campaign.name}</p>
                        <p className="mt-1 text-xs text-[#766d62]">
                          {campaign.title}
                        </p>
                      </div>
                      <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold capitalize">
                        {adLabel(campaign.status)}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-[#766d62]">
                      <span className="rounded-md bg-[#f2f1ee] px-2 py-1 capitalize">
                        {adLabel(campaign.goal)}
                      </span>
                      <span className="rounded-md bg-[#f2f1ee] px-2 py-1">
                        {campaign.ad_campaign_placements
                          .map((placement) => adLabel(placement.placement))
                          .join(", ") || "No placement"}
                      </span>
                      <span className="rounded-md bg-[#f2f1ee] px-2 py-1">
                        {dollars(campaign.bid_cents)} bid /{" "}
                        {dollars(campaign.daily_budget_cents)} daily cap
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                      {[
                        ["Impressions", impressions],
                        ["Clicks", clicks],
                        ["CTR", adClickRate({ clicks, impressions })],
                      ].map(([label, value]) => (
                        <div
                          className="rounded-md border border-[#e5ded4] bg-white px-2 py-2"
                          key={label}
                        >
                          <p className="font-bold text-[#171412]">{value}</p>
                          <p className="mt-1 text-[#766d62]">{label}</p>
                        </div>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : null}

          {!canSubmitAds ? (
            <div className="rounded-md border border-[#d8d1c6] bg-[#fffdf9] p-4 text-sm leading-6 text-[#4f473f]">
              Advertising opens after an artist, studio, or vendor account is
              license verified and in good standing.
            </div>
          ) : (
            <form action={submitAdCampaign} className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium">Campaign type</span>
                  <select
                    className="mt-2 h-11 w-full rounded-md border border-[#d8d1c6] bg-white px-3 text-sm outline-none focus:border-[#171412]"
                    name="campaign_type"
                    required
                  >
                    <option value="artist_growth">Artist growth</option>
                    <option value="stuff_listing">Stuff listing</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-sm font-medium">Goal</span>
                  <select
                    className="mt-2 h-11 w-full rounded-md border border-[#d8d1c6] bg-white px-3 text-sm outline-none focus:border-[#171412]"
                    name="goal"
                    required
                  >
                    <option value="leads">Leads</option>
                    <option value="messages">Messages</option>
                    <option value="engagement">Engagement</option>
                    <option value="listing_views">Stuff listing views</option>
                    <option value="seller_messages">Stuff seller messages</option>
                    <option value="marketplace_engagement">
                      Stuff marketplace engagement
                    </option>
                  </select>
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium">Campaign name</span>
                  <input
                    className="mt-2 h-11 w-full rounded-md border border-[#d8d1c6] bg-white px-3 text-sm outline-none focus:border-[#171412]"
                    maxLength={120}
                    name="name"
                    placeholder="Austin flash booking push"
                    required
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium">Ad headline</span>
                  <input
                    className="mt-2 h-11 w-full rounded-md border border-[#d8d1c6] bg-white px-3 text-sm outline-none focus:border-[#171412]"
                    maxLength={120}
                    name="title"
                    placeholder="Books open for July"
                    required
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-sm font-medium">Ad text</span>
                <textarea
                  className="mt-2 min-h-24 w-full rounded-md border border-[#d8d1c6] bg-white px-3 py-3 text-sm outline-none focus:border-[#171412]"
                  maxLength={300}
                  name="body"
                  placeholder="Short ad copy for the sponsored card."
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium">Target link</span>
                  <input
                    className="mt-2 h-11 w-full rounded-md border border-[#d8d1c6] bg-white px-3 text-sm outline-none focus:border-[#171412]"
                    name="target_url"
                    placeholder="https://..."
                    type="url"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium">Keywords</span>
                  <input
                    className="mt-2 h-11 w-full rounded-md border border-[#d8d1c6] bg-white px-3 text-sm outline-none focus:border-[#171412]"
                    name="keywords"
                    placeholder="blackwork, flash, fine line"
                  />
                </label>
              </div>

              <fieldset className="rounded-md border border-[#d8d1c6] bg-[#fffdf9] p-3">
                <legend className="px-1 text-sm font-semibold">Placements</legend>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  {[
                    ["4u", "4U"],
                    ["gossip", "Gossip"],
                    ["stuff", "Stuff"],
                  ].map(([value, label]) => (
                    <label
                      className="flex items-center gap-2 rounded-md border border-[#e5ded4] bg-white px-3 py-2 text-sm font-medium"
                      key={value}
                    >
                      <input name="placements" type="checkbox" value={value} />
                      {label}
                    </label>
                  ))}
                </div>
                <p className="mt-2 text-xs leading-5 text-[#766d62]">
                  Artist growth can use 4U and Gossip. Stuff listing campaigns
                  can use Stuff only.
                </p>
              </fieldset>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium">Bid per spot</span>
                  <input
                    className="mt-2 h-11 w-full rounded-md border border-[#d8d1c6] bg-white px-3 text-sm outline-none focus:border-[#171412]"
                    min="0"
                    name="bid_dollars"
                    placeholder="0.00"
                    step="0.01"
                    type="number"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium">Daily cap</span>
                  <input
                    className="mt-2 h-11 w-full rounded-md border border-[#d8d1c6] bg-white px-3 text-sm outline-none focus:border-[#171412]"
                    min="0"
                    name="daily_budget_dollars"
                    placeholder="0.00"
                    step="0.01"
                    type="number"
                  />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-4">
                <label className="block">
                  <span className="text-sm font-medium">City</span>
                  <input
                    className="mt-2 h-11 w-full rounded-md border border-[#d8d1c6] bg-white px-3 text-sm outline-none focus:border-[#171412]"
                    defaultValue={profile?.city ?? ""}
                    name="city"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium">Region</span>
                  <input
                    className="mt-2 h-11 w-full rounded-md border border-[#d8d1c6] bg-white px-3 text-sm outline-none focus:border-[#171412]"
                    defaultValue={profile?.region ?? ""}
                    name="region"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium">Country</span>
                  <select
                    className="mt-2 h-11 w-full rounded-md border border-[#d8d1c6] bg-white px-3 text-sm uppercase outline-none focus:border-[#171412]"
                    defaultValue={profile?.country_code ?? ""}
                    name="country_code"
                  >
                    <option value="">Any country</option>
                    {countryOptions.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-sm font-medium">Language</span>
                  <select
                    className="mt-2 h-11 w-full rounded-md border border-[#d8d1c6] bg-white px-3 text-sm outline-none focus:border-[#171412]"
                    defaultValue={profile?.preferred_language ?? ""}
                    name="language"
                  >
                    <option value="">Any language</option>
                    {languageOptions.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <p className="rounded-md border border-[#d8d1c6] bg-[#fffdf9] px-3 py-2 text-xs leading-5 text-[#766d62]">
                Ads are reviewed before they run and appear with a sponsored
                label. Targeting uses coarse location, language, selected
                placement, and keywords only.
              </p>

              <PendingSubmitButton
                className="h-11 rounded-md bg-[#171412] px-5 text-sm font-semibold text-white"
                pendingLabel="Submitting"
              >
                Submit ad for review
              </PendingSubmitButton>
            </form>
          )}
        </section>
      </section>
    </main>
  );
}
