export type HelpCategory = {
  description: string;
  title: string;
  topics: readonly string[];
};

export type HelpArticle = {
  category: string;
  description: string;
  steps: readonly string[];
  title: string;
  slug: string;
};

export const helpCategories = [
  {
    description:
      "Profile setup, profile photo, banner image, bio, website links, social links, shop links, light or dark mode, and account data controls.",
    title: "Account And Profile",
    topics: ["Edit profile", "Profile links", "Privacy basics"],
  },
  {
    description:
      "Artist, studio, and vendor approval steps, what documents to prepare, resubmission basics, and why unlicensed work is not allowed.",
    title: "Verification",
    topics: ["Artist review", "Studio review", "Vendor review"],
  },
  {
    description:
      "Appointment request basics, time-slot setup, deposit expectations, cancellation rules, calendar files, and future calendar connection guidance.",
    title: "Bookings",
    topics: ["Set availability", "Request appointments", "Deposits"],
  },
  {
    description:
      "Creating ads, choosing placements, using ad credits, reading campaign status, and keeping promotions inside the content rules.",
    title: "Advertising",
    topics: ["Create ads", "Ad credits", "Campaign review"],
  },
  {
    description:
      "Merch product setup, seller review, Stuff listings, public browsing, approved buyer interactions, fulfillment, refunds, and dispute basics.",
    title: "Merch And Stuff",
    topics: ["Merch setup", "Stuff listings", "Order support"],
  },
  {
    description:
      "Posting to 4U, Gossip, Gigs, Stories, and DMs, including media uploads, comments, reports, blocking, and no-visible-nudity launch rules.",
    title: "Posting And Safety",
    topics: ["4U and Gossip", "Stories and DMs", "Reports"],
  },
] as const satisfies readonly HelpCategory[];

export const helpArticles = [
  {
    category: "Account And Profile",
    description:
      "Set up your public profile, bio, profile photo, banner, website links, social links, and shop connection.",
    slug: "artist-profile-shop-links",
    steps: [
      "Open Account and choose the Profile tab.",
      "Add a profile photo, banner, short bio, website, and social links.",
      "If you work with a verified studio, choose the shop profile link once that studio profile is ready.",
      "Save changes, then review your public profile to make sure the public details look right.",
    ],
    title: "How to set up an artist profile and link a studio",
  },
  {
    category: "Verification",
    description:
      "Prepare artist, studio, or vendor documents for review so professional tools stay protected.",
    slug: "verification-documents",
    steps: [
      "Open Account and choose the Verification area.",
      "Select artist, studio, or vendor review.",
      "Enter the license or business name, issuing location, expiration date when available, and supporting document.",
      "Submit for review and watch Account alerts for approval, rejection, or resubmission notes.",
    ],
    title: "How to submit artist, studio, or vendor verification",
  },
  {
    category: "Bookings",
    description:
      "Create appointment types, weekly time slots, blackout dates, and deposit rules before clients request sessions.",
    slug: "booking-appointments",
    steps: [
      "Open Account and choose the Booking tools.",
      "Create appointment types with duration, notes, buffer time, and deposit rules.",
      "Add weekly time slots and blackout dates so clients only request workable times.",
      "Review incoming booking requests, accept the right slot, and let the client pay the deposit when required.",
    ],
    title: "How to create appointment types, time slots, and booking deposits",
  },
  {
    category: "Advertising",
    description:
      "Create ads, choose placements, use ad credits, and keep promotions inside the launch content rules.",
    slug: "ads-and-credits",
    steps: [
      "Open the advertising tools from Account.",
      "Choose the goal, placement, location, keywords, budget, and destination.",
      "Apply available ad credits before checkout when credits are available.",
      "Submit for review and watch campaign status before the ad starts running.",
    ],
    title: "How to create an ad and use ad credits",
  },
  {
    category: "Merch And Stuff",
    description:
      "Set up products, prepare order support, and understand review before public purchases expand.",
    slug: "merch-products-orders",
    steps: [
      "Open Account and choose Merch tools.",
      "Add a title, description, price, fulfillment notes, and clear product media.",
      "Submit the product for review before it appears publicly.",
      "Watch orders, fulfillment status, refund requests, and support questions from Account.",
    ],
    title: "How to set up Merch products and handle orders",
  },
  {
    category: "Posting And Safety",
    description:
      "Post safely across 4U, Gossip, Stuff, Gigs, Stories, and DMs while using reports, blocks, and comments correctly.",
    slug: "posting-stories-dms",
    steps: [
      "Use the create button from the section you are viewing so the right post type opens.",
      "Add safe media and text that follows the no-visible-nudity launch rule.",
      "Use comments, replies, likes, saves, and DMs without harassment or spam.",
      "Report unsafe content, block users when needed, and contact support for urgent safety issues.",
    ],
    title: "How to create Stuff listings, Gigs, Stories, and DMs safely",
  },
] as const satisfies readonly HelpArticle[];

export function getHelpArticle(slug: string) {
  return helpArticles.find((article) => article.slug === slug) ?? null;
}
