import Link from "next/link";
import type { Metadata } from "next";
import { LogoLockup } from "../logo-mark";

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
      "Tattooing, piercing, scar work, healing, placement, and body-art documentation may include adult bodies or limited non-sexual nudity. That content is allowed only when the clear purpose is to show the art, placement, healing, or body modification. Pornography, sexual solicitation, explicit sexual content, and sexualized content involving minors are not allowed.",
    title: "Body Art Content",
  },
  {
    body:
      "Members must label sensitive body-art content when appropriate. Sensitive posts may be hidden from public visitors, require login, and require 18+ confirmation before viewing. Public previews should not expose private messages, full comment threads, private account data, or sensitive media.",
    title: "Public And Sensitive Visibility",
  },
  {
    body:
      "Members are responsible for their own posts, listings, comments, messages, and profile information. Do not harass others, impersonate people or businesses, post scams, promote unsafe practices, or list illegal goods or services.",
    title: "Member Responsibility",
  },
  {
    body:
      "Stuff listings are for verified artists, studios, and approved vendors. Fans can browse listings, but buy, sell, trade, and seller-contact actions require verified professional or vendor status. Marketplace and gig posts must be honest, lawful, and clear about location, pricing or compensation, availability, and contact details. TheTattooCore is not a party to member-to-member transactions unless a future paid platform feature explicitly says otherwise.",
    title: "Marketplace And Gigs",
  },
  {
    body:
      "Admins and moderators may hide, remove, restrict, or escalate content and accounts that violate these rules or create safety risk. Reports can be reviewed for nudity/body-art context, sexual content, minors, harassment, scams, unsafe practices, illegal goods or services, and other abuse.",
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
            enough to protect messages, account data, and sensitive body-art
            content.
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
            ads, or mobile app store submission.
          </p>
        </div>
      </article>
    </main>
  );
}
