import Link from "next/link";
import type { Metadata } from "next";
import { LogoLockup } from "../logo-mark";
import { siteName, supportEmail } from "@/lib/site";

export const metadata: Metadata = {
  description:
    "TheTattooCore support, safety reporting, privacy help, and account deletion request information.",
  title: "Support",
};

const sections = [
  {
    body:
      "Use the in-app Report button on posts, profiles, Stuff, Gigs, and Gossip whenever possible. Reports go to the moderation queue with the content attached.",
    title: "Safety And Reports",
  },
  {
    body:
      "TheTattooCore is 18+ and does not allow visible nudity for launch. Pornography, sexual solicitation, sexualized minor content, scratcher promotion, scams, harassment, and unsafe equipment access are not allowed.",
    title: "Content Rules",
  },
  {
    body:
      "Signed-in members can request account deletion from Account > Data. During launch, deletion requests are reviewed manually so safety reports, marketplace issues, and legal obligations can be handled correctly.",
    title: "Account Deletion",
  },
  {
    body:
      "For login issues, verification questions, privacy requests, or urgent safety concerns, email support. Include your username and the link or screenshot that needs review when possible.",
    title: "Contact",
  },
] as const;

export default function SupportPage() {
  return (
    <main className="min-h-screen bg-[#f7f4ef] px-4 py-8 text-[#171412]">
      <article className="mx-auto max-w-3xl">
        <div className="mb-8 flex items-center justify-between gap-4">
          <Link href="/" aria-label={`${siteName} home`}>
            <LogoLockup />
          </Link>
          <Link
            className="rounded-md border border-[#d8d1c6] bg-white px-4 py-2 text-sm font-semibold"
            href="/login"
          >
            Sign in
          </Link>
        </div>

        <div className="rounded-lg border border-[#d8d1c6] bg-[#fffdf9] p-5 sm:p-7">
          <p className="text-sm font-semibold uppercase text-[#766d62]">
            {siteName}
          </p>
          <h1 className="mt-2 text-3xl font-bold">Support</h1>
          <p className="mt-3 text-sm leading-6 text-[#4f473f]">
            Help for account access, safety reports, privacy requests,
            verification, and app-store support.
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

          <div className="mt-7 rounded-md border border-[#d8d1c6] bg-[#f7f4ef] p-4 text-sm leading-6 text-[#4f473f]">
            <p className="font-semibold">Support email</p>
            <a className="mt-1 block underline" href={`mailto:${supportEmail}`}>
              {supportEmail}
            </a>
          </div>
        </div>
      </article>
    </main>
  );
}
