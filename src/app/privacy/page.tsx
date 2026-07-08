import Link from "next/link";
import type { Metadata } from "next";
import { LogoLockup } from "../logo-mark";

export const metadata: Metadata = {
  description:
    "TheTattooCore privacy overview for account data, public profiles, messages, location settings, and future ads.",
  title: "Privacy",
};

const sections = [
  {
    body:
      "Profiles, selected public posts, marketplace listings, and gigs may be visible to other members and, where allowed, search engines. Account settings, private profile data, admin tools, draft content, and messages are not meant for public indexing.",
    title: "What Can Be Public",
  },
  {
    body:
      "Direct messages are for conversation participants. Admin and safety review access may be added only where needed to investigate abuse, legal risk, spam, or platform safety issues.",
    title: "Messages",
  },
  {
    body:
      "TheTattooCore stores coarse location settings such as city, region, and country code when you provide them. These settings can support marketplace discovery, gigs, events, and future sponsored placements. Precise browser geolocation should be requested separately before use.",
    title: "Location",
  },
  {
    body:
      "The planned ad system should use simple targeting such as country, region, city, language, style keywords, marketplace category, and placement. It should avoid hidden behavioral profiling, sensitive personal targeting, and adult/minor targeting.",
    title: "Ads",
  },
  {
    body:
      "Members can update profile information from account settings. More export, deletion, and privacy controls should be added before broad launch and mobile app submission.",
    title: "Controls",
  },
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#f7f4ef] px-4 py-8 text-[#171412]">
      <article className="mx-auto max-w-3xl">
        <div className="mb-8 flex items-center justify-between gap-4">
          <Link href="/" aria-label="TheTattooCore home">
            <LogoLockup />
          </Link>
          <Link
            className="rounded-md border border-[#d8d1c6] bg-white px-4 py-2 text-sm font-semibold"
            href="/"
          >
            Back home
          </Link>
        </div>

        <div className="rounded-lg border border-[#d8d1c6] bg-[#fffdf9] p-5 sm:p-7">
          <p className="text-sm font-semibold uppercase text-[#766d62]">
            TheTattooCore
          </p>
          <h1 className="mt-2 text-3xl font-bold">Privacy</h1>
          <p className="mt-3 text-sm leading-6 text-[#4f473f]">
            This overview explains the privacy shape we are building toward:
            public discovery where it helps the community, protected account
            and message areas where privacy matters.
          </p>

          <div className="mt-7 space-y-5">
            {sections.map((section) => (
              <section key={section.title}>
                <h2 className="text-lg font-bold">{section.title}</h2>
                <p className="mt-2 text-sm leading-6 text-[#4f473f]">
                  {section.body}
                </p>
              </section>
            ))}
          </div>

          <p className="mt-7 rounded-md border border-[#d8d1c6] bg-[#f7f4ef] p-4 text-sm leading-6 text-[#4f473f]">
            This privacy page is a launch foundation and should be reviewed
            before payments, paid ads, app store release, or international
            expansion.
          </p>
        </div>
      </article>
    </main>
  );
}
