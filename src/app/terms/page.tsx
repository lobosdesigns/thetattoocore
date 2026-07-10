import Link from "next/link";
import type { Metadata } from "next";
import { LogoLockup } from "../logo-mark";
import { supportEmail } from "@/lib/site";

export const metadata: Metadata = {
  description:
    "TheTattooCore community terms, 18+ policy, content rules, marketplace expectations, and moderation standards.",
  title: "Terms and Content Policy",
};

const sections = [
  {
    body:
      "TheTattooCore is an 18+ community for tattoo artists, studios, collectors, vendors, and tattoo enthusiasts. By creating an account, you confirm that you are at least 18 years old and that your profile information is accurate.",
    title: "Adults Only",
  },
  {
    body:
      "For launch and mobile app readiness, visible nudity is not allowed, even when the intent is tattoo, piercing, scar, healing, placement, or body-art documentation. Members should crop or cover private areas before posting. Pornography, sexual solicitation, explicit sexual content, and sexualized content involving minors are not allowed.",
    title: "Body Art Content",
  },
  {
    body:
      "For launch, member upload forms do not include a sensitive-content bypass because visible nudity is not allowed. Members should crop or cover private areas before posting fresh work, healing, scar cover, piercing, body modification, or medical-looking context. Admins may still hide, restrict, or mark edge-case content for login and 18+ review. Public previews should not expose private messages, full comment threads, private account data, or restricted media.",
    title: "Public And Sensitive Visibility",
  },
  {
    body:
      "Members are responsible for their own posts, listings, comments, messages, and profile information. Do not harass others, impersonate people or businesses, post scams, promote unsafe practices, or list illegal goods or services.",
    title: "Member Responsibility",
  },
  {
    body:
      "Stuff listings are for verified artists, studios, and approved vendors. Fans can browse listings, but buy, sell, trade, and seller-contact actions require verified professional or vendor status. Tattoo machines, needles, pigments, tubes, and other professional shop equipment must not be offered to unverified or unqualified buyers where the platform can reasonably enforce it. Merch is planned as a separate fan-facing marketplace for safe artist, studio, vendor, and TheTattooCore brand goods such as shirts, prints, art, and stickers. Merch sellers still need approval, and Merch must not include professional equipment, regulated services, counterfeit goods, adult sexual products, or unsafe products. Marketplace and gig posts must be honest, lawful, and clear about location, pricing or compensation, availability, and contact details. TheTattooCore is not a party to member-to-member transactions unless a future paid platform feature explicitly says otherwise.",
    title: "Marketplace And Gigs",
  },
  {
    body:
      "TheTattooCore is built for real body-art people and real work. The platform does not use AI-generated art, AI search, AI feeds, or AI creator-replacement features as a community value. Unsafe scratcher activity, unlicensed studio promotion, and sales of professional equipment to unqualified buyers are not allowed where the platform can reasonably enforce it.",
    title: "No AI And No Scratchers",
  },
  {
    body:
      "TheTattooCore is intended to support independent artists, studios, collectors, and ethical vendors rather than corporate takeover pressure in the tattoo and body-art industry. Members should use the platform to express body-art culture freely while staying inside safety, consent, legality, adult-content, and anti-exploitation rules.",
    title: "Independent Body-Art Community",
  },
  {
    body:
      "Admins and moderators may hide, remove, restrict, or escalate content and accounts that violate these rules or create safety risk. Reports can be reviewed for nudity, sexual content, sensitive non-nude body-art context, minors, harassment, scams, unsafe practices, illegal goods or services, and other abuse.",
    title: "Moderation",
  },
];

export default function TermsPage() {
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
          <h1 className="mt-2 text-3xl font-bold">Terms and Content Policy</h1>
          <p className="mt-3 text-sm leading-6 text-[#4f473f]">
            These launch rules set the baseline for an adult tattoo community:
            public enough for artists and studios to be discovered, private
            enough to protect messages, account data, and sensitive non-nude
            body-art content.
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
            This is a working launch policy, not final legal advice. It should
            be reviewed by counsel before major public launch, payments, paid
            ads, or mobile app store submission. Policy and safety questions
            can be sent to{" "}
            <a className="font-semibold underline" href={`mailto:${supportEmail}`}>
              {supportEmail}
            </a>
            .
          </p>
        </div>
      </article>
    </main>
  );
}
