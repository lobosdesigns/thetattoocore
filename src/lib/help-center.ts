export type HelpCategory = {
  description: string;
  title: string;
  topics: readonly string[];
};

export type HelpArticle = {
  category: string;
  description: string;
  faqs: readonly {
    answer: string;
    question: string;
  }[];
  lastReviewed: string;
  relatedSlugs: readonly string[];
  steps: readonly string[];
  title: string;
  slug: string;
};

export const helpCategories = [
  {
    description:
      "Profile setup, profile photo, banner image, bio, website links, social links, shop links, light or dark mode, and account data controls.",
    title: "Account And Profile",
    topics: ["Getting started", "Edit profile", "Profile links", "Search and saved"],
  },
  {
    description:
      "Artist, studio, and vendor approval steps, what documents to prepare, resubmission basics, and why unlicensed work is not allowed.",
    title: "Verification",
    topics: ["Artist review", "Studio review", "Vendor review"],
  },
  {
    description:
      "Appointment request basics, time-slot setup, deposit expectations, cancellation rules, calendar files, and calendar prep guidance.",
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
    topics: ["4U and Gossip", "Stories and DMs", "Reports", "Privacy controls"],
  },
] as const satisfies readonly HelpCategory[];

export const helpArticles = [
  {
    category: "Account And Profile",
    description:
      "Use this first-run checklist to set up a member, artist, studio, or vendor account without getting lost.",
    faqs: [
      {
        answer:
          "Start as a member if you are browsing, following, commenting, saving, sending DMs, or buying public Merch. Choose artist, studio, or vendor when you need professional verification, booking tools, seller tools, or professional marketplace access.",
        question: "Which account type should I choose?",
      },
      {
        answer:
          "Save your profile first. Then confirm email, add profile details, review 18+ terms, set privacy and notification preferences, and submit verification if you need professional tools.",
        question: "What should I do first after signup?",
      },
      {
        answer:
          "Public, non-sensitive pages can be discovered by visitors. Private account details, DMs, verification documents, payment details, and support issues stay behind account or admin access.",
        question: "What is public and what is private?",
      },
      {
        answer:
          "Visible nudity is not allowed during launch. Keep tattoo, piercing, healing, and body-art documentation safe for review by cropping, covering, or choosing a different photo.",
        question: "What content rule matters most at launch?",
      },
    ],
    lastReviewed: "July 16, 2026",
    relatedSlugs: [
      "artist-profile-shop-links",
      "verification-documents",
      "posting-stories-dms",
      "privacy-safety-support",
    ],
    slug: "getting-started",
    steps: [
      "Create an account from Signup, confirm the email, then sign in.",
      "Open Account and save a username, display name, profile photo, banner, bio, location, language, and 18+ confirmation.",
      "Choose light or dark mode, then set privacy and notification preferences before posting.",
      "Use Search to find artists, studios, vendors, friends, public posts, Stuff, Gigs, and Merch.",
      "Use 4U for image/reel posts, Gossip for longer discussion posts, Stuff for verified professional marketplace items, Gigs for work/events/opportunities, Merch for fan-safe public products, and DM for private messages.",
      "Submit artist, studio, or vendor verification before expecting professional tools such as Stuff seller contact, booking setup, seller review, or professional ad review.",
      "Use Help or Support when something is unclear, private, payment-related, or safety-related.",
    ],
    title: "Getting started on TheTattooCore",
  },
  {
    category: "Account And Profile",
    description:
      "Set up your public profile, bio, profile photo, banner, website links, social links, and shop connection.",
    faqs: [
      {
        answer:
          "Use public-facing links only. Do not add private phone numbers, private emails, or personal contact details you do not want members to see.",
        question: "What links should I put on my profile?",
      },
      {
        answer:
          "A linked studio helps visitors understand where you work, but the studio still needs its own approved profile before verified shop details appear publicly.",
        question: "Can artists connect to a shop profile?",
      },
    ],
    lastReviewed: "July 15, 2026",
    relatedSlugs: ["getting-started", "search-saved-people", "verification-documents"],
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
    category: "Account And Profile",
    description:
      "Find people, shops, posts, Stuff, Gigs, and Merch while understanding why private or unsafe content may not appear.",
    faqs: [
      {
        answer:
          "Use exact usernames with or without @ when you know them. You can also search display names, cities, regions, account types, styles, categories, shop names, Gigs, Stuff, Merch, and common TTC terms like shops/studios, bookings/appointments, DMs/messages, and vendors/sellers.",
        question: "What should I type in Search?",
      },
      {
        answer:
          "A result may be private, blocked, hidden, removed, not public, not approved, or only visible after sign-in and required account checks.",
        question: "Why can I not find someone or something?",
      },
    ],
    lastReviewed: "July 15, 2026",
    relatedSlugs: [
      "getting-started",
      "artist-profile-shop-links",
      "posting-stories-dms",
      "privacy-safety-support",
    ],
    slug: "search-saved-people",
    steps: [
      "Open Search from the bottom navigation or header.",
      "Try an exact username first when you know it, then broaden to display name, city, shop name, style, category, or keyword.",
      "Use common TTC wording such as shops or studios, bookings or appointments, DMs or messages, and vendors or sellers.",
      "Use the Profiles, 4U, Gossip, Stuff, Gigs, and Merch tabs to narrow the result type.",
      "Use recent searches or saved search shortcuts for searches you run often, and save posts or products from their cards when you want to find them again later.",
    ],
    title: "How to search, find people, and use Saved",
  },
  {
    category: "Verification",
    description:
      "Prepare artist, studio, or vendor documents for review so professional tools stay protected.",
    faqs: [
      {
        answer:
          "The reviewer needs enough proof to confirm professional eligibility, such as license, certification, or business documentation that matches the account type.",
        question: "What document should I upload?",
      },
      {
        answer:
          "No. Verification documents stay private for account review and are not shown on public profiles or public feeds.",
        question: "Will my license document be public?",
      },
      {
        answer:
          "Artist, studio, and vendor approval protects the body-art community from unlicensed work, unsafe equipment access, counterfeit goods, and seller claims that cannot be backed up.",
        question: "Why does approval matter?",
      },
      {
        answer:
          "Approved accounts can unlock the professional tools that match their account type, such as verified profile trust, booking tools, Stuff access, Merch seller review, and safer advertising review.",
        question: "What can approval unlock?",
      },
      {
        answer:
          "If review needs more proof, update the account information, upload clearer documentation, and submit again. Do not upload private personal details that are not needed for professional eligibility.",
        question: "What if my review is rejected?",
      },
    ],
    lastReviewed: "July 15, 2026",
    relatedSlugs: ["artist-profile-shop-links", "merch-products-orders"],
    slug: "verification-documents",
    steps: [
      "Open Account and choose the Verification area.",
      "Select artist, studio, or vendor review.",
      "Enter the license or business name, issuing location, expiration date when available, and supporting document.",
      "Use documentation that matches the account type: artist license or certification, studio/shop license, vendor business proof, or other professional eligibility documents.",
      "Keep private personal details off public profile fields. Verification documents are for admin review only.",
      "Submit for review and watch Account alerts for approval, rejection, or resubmission notes.",
      "After approval, check which tools are unlocked for your account type before creating Stuff, Merch, booking, or ad activity.",
    ],
    title: "How to submit artist, studio, or vendor verification",
  },
  {
    category: "Bookings",
    description:
      "Create appointment types, weekly time slots, blackout dates, and deposit rules before clients request sessions.",
    faqs: [
      {
        answer:
          "Deposits are handled through the platform checkout flow when a request is accepted and a deposit is required. Any TTC processing/platform fee should be shown before checkout instead of hidden later.",
        question: "When does a client pay a deposit?",
      },
      {
        answer:
          "Calendar export files are available for scheduled bookings. Use Google, Apple/iCloud, or standard iCalendar prep notes to keep appointment details clear while booking tools mature.",
        question: "Can bookings connect to my calendar?",
      },
      {
        answer:
          "Use blackout dates and buffer time to keep clients from requesting days or times that are not workable. Review the request before accepting any deposit.",
        question: "How do I prevent bad appointment times?",
      },
      {
        answer:
          "Artists and studios should accept the request only after the date, time, deposit, and notes are clear. The client should see the deposit amount and TTC fee before checkout starts.",
        question: "What should be confirmed before accepting?",
      },
      {
        answer:
          "Refund requests for paid deposits stay in review during launch. Support checks the appointment status, cancellation reason, artist/shop policy, and payment state before any refund decision.",
        question: "How do deposit refunds work?",
      },
      {
        answer:
          "Calendar files should only include appointment details needed by the client and artist/studio. Do not put private payment details, legal notes, admin review notes, or private contact details into public booking notes.",
        question: "What should stay out of calendar notes?",
      },
    ],
    lastReviewed: "July 15, 2026",
    relatedSlugs: ["artist-profile-shop-links", "ads-and-credits"],
    slug: "booking-appointments",
    steps: [
      "Open Account and choose the Booking tools.",
      "Create appointment types with duration, notes, buffer time, and deposit rules.",
      "Add weekly time slots and blackout dates so clients only request workable times.",
      "Use public booking notes or links for existing calendar/request pages if your shop already has one.",
      "Review incoming booking requests, accept the right slot, and let the client pay the deposit when required.",
      "Confirm the appointment type, scheduled time, deposit amount, TTC fee, cancellation expectation, and artist note before asking a client to check out.",
      "Download the private calendar file from accepted scheduled bookings when you need to add the appointment to your calendar.",
      "Use refund review instead of promising instant deposit refunds before support reviews the request.",
    ],
    title: "How to create appointment types, time slots, and booking deposits",
  },
  {
    category: "Advertising",
    description:
      "Create ads, choose placements, use ad credits, and keep promotions inside the launch content rules.",
    faqs: [
      {
        answer:
          "Credits can reduce or cover eligible campaign checkout amounts when they are available on the account.",
        question: "How do ad credits work?",
      },
      {
        answer:
          "Ads are reviewed before delivery so unsafe claims, unlicensed promotion, restricted goods, and policy-breaking creative can be blocked.",
        question: "Why does my ad need review?",
      },
      {
        answer:
          "Artist/client ads can appear in 4U and Gossip when they fit the placement rules. Merch ads stay in Merch and should focus on product views or safe brand goods.",
        question: "Where can my ad appear?",
      },
      {
        answer:
          "Credits may be granted for promos, sponsorships, trades, make-goods, or company-approved support reasons. When enough active credit is available, it can cover eligible campaign checkout before a paid checkout is needed.",
        question: "Why do I have ad credits?",
      },
      {
        answer:
          "Use clear tattoo, studio, location, style, and product terms. Do not use unsafe medical claims, unlicensed-service claims, adult sexual wording, misleading discounts, or equipment sales to unverified users.",
        question: "What keywords should I use?",
      },
    ],
    lastReviewed: "July 15, 2026",
    relatedSlugs: ["merch-products-orders", "posting-stories-dms"],
    slug: "ads-and-credits",
    steps: [
      "Open the advertising tools from Account.",
      "Choose the goal, placement, location, keywords, budget, and destination.",
      "Use 4U/Gossip placements for artist-client lead, message, and engagement goals. Use Merch placement for product views and safe brand goods.",
      "Apply available ad credits before checkout when credits are available.",
      "Review the payment status before submitting. Campaigns only deliver after review and after payment is paid, waived by credit, or otherwise approved by admin rules.",
      "Submit for review and watch campaign status before the ad starts running.",
    ],
    title: "How to create an ad and use ad credits",
  },
  {
    category: "Merch And Stuff",
    description:
      "Set up products, prepare order support, and understand review before public purchases expand.",
    faqs: [
      {
        answer:
          "Merch is for fan-safe products such as shirts, prints, art, stickers, and brand goods. Professional equipment and restricted goods belong outside public fan checkout.",
        question: "What belongs in Merch?",
      },
      {
        answer:
          "Approved public products can be browsed by fans. Seller tools and fulfillment controls require the right account access.",
        question: "Can fans buy Merch?",
      },
      {
        answer:
          "Sellers should finish account approval, product review, payout setup, fulfillment notes, and return/refund expectations before treating Merch as ready for public orders.",
        question: "What should sellers finish before launch orders?",
      },
      {
        answer:
          "Mark an order fulfilled only after the item is shipped, ready for pickup, or handed off. Add carrier, tracking number, or a clear tracking link when you have one so the buyer and support team can understand the handoff.",
        question: "When should I mark a Merch order fulfilled?",
      },
      {
        answer:
          "Buyer shipping details are private order information. They appear only in seller/admin fulfillment areas and should never be copied into public posts, screenshots, comments, or profile details.",
        question: "Where can I use buyer shipping details?",
      },
      {
        answer:
          "Refund requests go to review during launch. Support checks the order, seller fulfillment, buyer reason, and payment status before any money movement is approved. Sellers should write clear return/refund notes before submitting products so buyers know what to expect.",
        question: "How do Merch refunds work during launch?",
      },
      {
        answer:
          "Use Support for missing, damaged, wrong, delayed, or returned packages. Include your username, the order or product link, what happened, and any private photos or tracking details that help support review the issue.",
        question: "What if a package has a problem?",
      },
    ],
    lastReviewed: "July 16, 2026",
    relatedSlugs: ["verification-documents", "ads-and-credits"],
    slug: "merch-products-orders",
    steps: [
      "Open Account and choose Merch tools.",
      "Add a title, description, price, clear product media, and a return/refund note buyers can understand.",
      "If the product ships, add the ship-from city and state/region plus fulfillment notes with timing, pickup, made-to-order, or handoff details.",
      "Submit the product for review before it appears publicly.",
      "Finish seller payout setup from the hosted account flow before real order payouts are expected.",
      "Watch orders, fulfillment status, refund requests, and support questions from Account.",
      "For each paid order, use the seller order card to review the private shipping address, then mark the item fulfilled only after shipping, pickup, or handoff is ready.",
      "Add tracking carrier, tracking number, or a tracking link when available. If there is no tracking, use a clear fulfillment note before marking the order complete.",
      "Use Admin or Support for missing, damaged, wrong, delayed, or returned packages, payment-reference lookup, refund review, seller non-delivery review, or dispute review.",
    ],
    title: "How to set up Merch products and handle orders",
  },
  {
    category: "Posting And Safety",
    description:
      "Post safely across 4U, Gossip, Stuff, Gigs, Stories, and DMs while using reports, blocks, and comments correctly.",
    faqs: [
      {
        answer:
          "Use the create button from the section you are in. The form changes based on whether you are posting to 4U, Gossip, Stuff, Gigs, Merch, Stories, or DMs.",
        question: "Why does the create form change?",
      },
      {
        answer:
          "Visible nudity is not allowed during launch. Crop or cover private areas before posting, even when the purpose is tattoo or body-art documentation.",
        question: "Can I post tattoo placement photos with nudity?",
      },
    ],
    lastReviewed: "July 15, 2026",
    relatedSlugs: ["artist-profile-shop-links", "verification-documents", "privacy-safety-support"],
    slug: "posting-stories-dms",
    steps: [
      "Use the create button from the section you are viewing so the right post type opens.",
      "Add safe media and text that follows the no-visible-nudity launch rule.",
      "Use comments, replies, likes, saves, and DMs without harassment or spam.",
      "Report unsafe content, block users when needed, and contact support for urgent safety issues.",
    ],
    title: "How to create Stuff listings, Gigs, Stories, and DMs safely",
  },
  {
    category: "Posting And Safety",
    description:
      "Use reports, blocks, privacy settings, account deletion requests, and support without exposing private details publicly.",
    faqs: [
      {
        answer:
          "Use report controls on the content or profile when available. For urgent safety, privacy, or account questions, use Support so the issue can be handled privately.",
        question: "When should I report something?",
      },
      {
        answer:
          "Use Account data controls or Support for deletion requests. Some safety, dispute, fraud, legal, or payment records may need review before final handling.",
        question: "How do account deletion requests work?",
      },
    ],
    lastReviewed: "July 15, 2026",
    relatedSlugs: ["posting-stories-dms", "search-saved-people", "verification-documents"],
    slug: "privacy-safety-support",
    steps: [
      "Use report controls on posts, comments, profiles, Stuff, Gigs, Merch, or Stories when something breaks community rules.",
      "Block a member when you need to stop unwanted profile access, comments, or DMs.",
      "Keep private contact details, license documents, payment issues, disputes, and account-specific questions inside Support or Account tools.",
      "Use Account data controls or Support for account deletion requests, then watch for follow-up if review is needed.",
    ],
    title: "How to use reports, blocks, privacy, and support",
  },
] as const satisfies readonly HelpArticle[];

export function getHelpArticle(slug: string) {
  return helpArticles.find((article) => article.slug === slug) ?? null;
}
