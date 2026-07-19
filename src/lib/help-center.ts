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
  keywords?: readonly string[];
  lastReviewed: string;
  relatedSlugs: readonly string[];
  steps: readonly string[];
  tutorialMedia?: readonly {
    assetSrc?: string;
    description: string;
    kind: "screenshot" | "short_clip";
    title: string;
  }[];
  title: string;
  slug: string;
};

export const helpCategories = [
  {
    description:
      "Settings, profile setup, profile photo, banner image, bio, website links, social links, shop links, light or dark mode, and account data controls.",
    title: "Account And Profile",
    topics: ["Settings", "Getting started", "Edit profile", "Profile links", "Search and saved"],
  },
  {
    description:
      "Artist, studio, and vendor approval steps, what documents to prepare, resubmission basics, and why unlicensed work is not allowed.",
    title: "Verification",
    topics: ["Artist review", "Studio review", "Vendor review"],
  },
  {
    description:
      "Appointment request basics, time-slot setup, deposit expectations, cancellation rules, calendar files, and calendar notes.",
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
    topics: ["Merch setup", "Seller payouts", "Stuff listings", "Order support"],
  },
  {
    description:
      "Posting to 4U, Gossip, Stuff, Gigs, Merch, and Stories, plus using DMs safely for private conversations.",
    title: "Posting And Safety",
    topics: ["4U and Gossip", "Stuff and Gigs", "Stories", "DM safety", "Reports"],
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
          "Visible nudity is not allowed. Keep tattoo, piercing, healing, and body-art documentation safe for review by cropping, covering, or choosing a different photo.",
        question: "What content rule matters most?",
      },
    ],
    keywords: [
      "18 plus",
      "account type",
      "beginner",
      "create account",
      "first run",
      "onboarding",
      "signup",
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
      "Open Settings and save a username, display name, profile photo, banner, bio, location, language, and 18+ confirmation.",
      "Choose light or dark mode in Settings, then set privacy and notification preferences before posting.",
      "Use Search to find artists, studios, vendors, friends, public posts, Stuff, Gigs, and Merch.",
      "Use 4U for image/reel posts, Gossip for longer discussion posts, Stuff for verified professional marketplace items, Gigs for work/events/opportunities, and Merch for fan-safe public products. Use the DM shortcut, profile DM buttons, or alerts for private messages.",
      "Submit artist, studio, or vendor verification before expecting professional tools such as Stuff seller contact, booking setup, seller review, or professional ad review.",
      "Use Help or Support when something is unclear, private, payment-related, or safety-related.",
    ],
    tutorialMedia: [
      {
        assetSrc: "/screenshots/mobile-login-signup.png",
        description:
      "Show Login, the Signup button, and the first Settings save without private email details visible.",
        kind: "screenshot",
        title: "Signup to first Settings save",
      },
      {
        description:
          "Short mobile walkthrough of switching between 4U, Gossip, Stuff, Gigs, Merch, Search, Saved, Alerts, DM, and Me.",
        kind: "short_clip",
        title: "Main navigation tour",
      },
    ],
    title: "Getting started on TheTattooCore",
  },
  {
    category: "Account And Profile",
    description:
      "Use this checklist before inviting or helping early testers so the main mobile, posting, messaging, seller, booking, and admin flows are checked in a consistent order.",
    faqs: [
      {
        answer:
          "Use safe sample accounts, dummy verification files, test products, test bookings, and test checkout paths only. Do not use real license documents, real payout credentials, real addresses, nudity, private DMs, or personal owner contact information in screenshots or clips.",
        question: "What should testers avoid using?",
      },
      {
        answer:
          "Treat reload loops, failed signup or email confirmation, broken login/reset links, mobile horizontal overflow, broken posting, broken DMs, unsafe public exposure, and confusing checkout or payout steps as launch blockers.",
        question: "What counts as a beta blocker?",
      },
      {
        answer:
          "Check Help first for common setup questions. Use Support for private account, safety, payment, order, refund, dispute, verification, or deletion issues.",
        question: "Where should testers ask for help?",
      },
    ],
    keywords: [
      "beta",
      "blocker",
      "checklist",
      "launch",
      "mobile qa",
      "qa",
      "real device",
      "reload loop",
      "test account",
      "tester",
    ],
    lastReviewed: "July 17, 2026",
    relatedSlugs: [
      "getting-started",
      "posting-stories-dms",
      "merch-products-orders",
      "booking-appointments",
      "privacy-safety-support",
    ],
    slug: "beta-tester-checklist",
    steps: [
      "Sign up or sign in with a safe sample account, confirm email, save profile details, add avatar or banner media, add bio and links, and confirm the 18+ requirement.",
      "Check mobile layout in light and dark mode with no horizontal overflow. Open Help, Support, Terms, Privacy, Settings, Profile, Search, Saved, Alerts, DM, and Admin if your role allows it.",
      "Create safe 4U, Gossip, Story, Stuff, Gig, and Merch test posts. Check crop tools, media viewer zoom, comments, replies, likes, saves, reports, edit/delete controls, and Load more behavior.",
      "Search for known profiles and connected users. Start a two-user DM, send text plus safe media, open the notification, reply, and confirm delivered/read markers and profile links.",
      "For verified sample accounts, test artist, studio, and vendor verification with dummy documents; then check Stuff, Gigs, Merch drafts, seller readiness, fulfillment proof, and Help links.",
      "Test appointment request, accepted booking, deposit copy, visible TTC fee guidance, calendar download, cancellation language, and refund-review language with safe sample data only.",
      "Review Admin go/no-go, reports, verification, content, payments, merch, data requests, and media ops before inviting more testers.",
      "Record every issue with account type, device, page, exact action, expected result, actual result, screenshot or short clip, and whether it blocks launch.",
    ],
    tutorialMedia: [
      {
        assetSrc: "/screenshots/mobile-help-support.png",
        description:
          "Show the Admin beta go/no-go strip and queue links using safe sample counts only.",
        kind: "screenshot",
        title: "Admin beta go/no-go",
      },
      {
        description:
          "Short clip of a two-user DM pass: search, send, open alert, reply, and confirm read or delivered status.",
        kind: "short_clip",
        title: "Two-user DM and notification pass",
      },
      {
        assetSrc: "/screenshots/mobile-help-support.png",
        description:
          "Show where Help and Support are found from main navigation, Settings, Profile, Admin, login, and legal pages.",
        kind: "screenshot",
        title: "Help and Support discovery",
      },
    ],
    title: "Beta tester checklist",
  },
  {
    category: "Account And Profile",
    description:
      "Use this guide when testing the beta app wrapper so login, signup, links, media upload, notifications, Help, and checkout return paths stay inside the app experience.",
    faqs: [
      {
        answer:
          "Use the invite link from the app testing program, install the beta app, then start from the Login screen. If the app opens a browser unexpectedly during login, signup, reset password, Help, Support, or checkout return, record it as a blocker.",
        question: "How should I start beta app testing?",
      },
      {
        answer:
          "Check signup, login, email confirmation, reset password, profile save, posting, Stories, comments, DMs, Search, notifications, Help, Support, verification upload, Merch browsing, booking requests, and test checkout return paths.",
        question: "What should I test first?",
      },
      {
        answer:
          "No. Use safe sample accounts and safe tattoo/media examples only. Do not capture private DMs, license documents, real payment data, real addresses, owner personal contact details, visible nudity, or admin-only queues.",
        question: "Can I send screenshots from my real account?",
      },
      {
        answer:
          "Report the device, app version if visible, account type, exact page, exact action, expected result, actual result, and a safe screenshot or short clip. Reload loops, app exits, broken login, broken posting, broken DMs, and mobile overflow should be marked urgent.",
        question: "What should a beta bug report include?",
      },
      {
        answer:
          "Mark it as urgent. Include the page, action, whether it happened after login, signup, reset, confirmation, Help, Support, or checkout return, and a safe screenshot that does not show private account details.",
        question: "What if a beta link opens outside the app?",
      },
    ],
    keywords: [
      "android beta",
      "app beta",
      "app testing",
      "beta app",
      "browser",
      "bug report",
      "confirmation link",
      "device",
      "email confirmation",
      "internal testing",
      "invite link",
      "ios beta",
      "login",
      "mobile app",
      "mobile layout",
      "overflow",
      "password reset",
      "safe screenshot",
      "testflight",
      "webview",
      "wrapper",
    ],
    lastReviewed: "July 19, 2026",
    relatedSlugs: [
      "beta-tester-checklist",
      "getting-started",
      "posting-stories-dms",
      "order-refunds-disputes",
      "privacy-safety-support",
    ],
    slug: "beta-app-testing",
    steps: [
      "Install the beta app from the testing invite, open it, and confirm the first screen is the TTC login experience.",
      "Run signup, login, forgot password, reset password, email confirmation, Help, Support, Terms, and Privacy without the app pushing you into an outside browser.",
      "Save a profile with avatar, banner, bio, links, location, language, and light or dark mode, then review the public profile on mobile.",
      "Create safe sample 4U, Gossip, Story, Stuff, Gig, and Merch content where your role allows it. Test crop tools, media viewer, comments, reports, edit/delete, and Load more behavior.",
      "Run the two-user DM pass: search a connected profile, send text, send safe media, open the notification, reply, and confirm delivered/read markers.",
      "Test booking request, accepted booking, deposit copy, calendar download, Merch browsing, order-support guide access, and test checkout return paths without using real money or private credentials.",
      "Report issues with safe screenshots or short clips only. Keep private messages, license documents, payment details, addresses, and admin-only views out of public bug reports.",
    ],
    tutorialMedia: [
      {
        description:
          "Show the beta app opening to Login, then Help, Support, Terms, and Privacy staying inside the app wrapper.",
        kind: "short_clip",
        title: "App wrapper navigation pass",
      },
      {
        assetSrc: "/screenshots/mobile-help-support.png",
        description:
          "Show a safe bug report example with device, page, action, expected result, actual result, and no private data.",
        kind: "screenshot",
        title: "Safe beta bug report",
      },
    ],
    title: "How to test the beta app",
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
    keywords: [
      "avatar",
      "banner",
      "bio",
      "cover photo",
      "profile links",
      "shop link",
      "social links",
      "studio link",
      "website",
    ],
    lastReviewed: "July 15, 2026",
    relatedSlugs: ["getting-started", "search-saved-people", "verification-documents"],
    slug: "artist-profile-shop-links",
    steps: [
      "Open Settings and choose the Profile area.",
      "Add a profile photo, banner, short bio, website, and social links.",
      "If you work with a verified studio, choose the shop profile link once that studio profile is ready.",
      "Save changes, then review your public profile to make sure the public details look right.",
    ],
    tutorialMedia: [
      {
        assetSrc: "/screenshots/mobile-profile-search.png",
        description:
          "Show the Profile, About, and Location tabs so users can see where bio, banner, links, and city settings live.",
        kind: "screenshot",
        title: "Profile settings sections",
      },
      {
        description:
          "Short clip of uploading a banner/profile photo, cropping it, saving, and opening the public profile preview.",
        kind: "short_clip",
        title: "Photo and banner setup",
      },
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
          "Use exact usernames with or without @ when you know them. You can also search display names, cities, regions, account types, styles, categories, shop names, Gigs, Stuff, Merch, and common TTC terms like artists/tattooers, shops/studios, guest spots/conventions/jobs, shirts/prints/stickers, bookings/appointments, DMs/messages, and vendors/sellers.",
        question: "What should I type in Search?",
      },
      {
        answer:
          "A result may be private, blocked, hidden, removed, not public, not approved, or only visible after sign-in and required account checks.",
        question: "Why can I not find someone or something?",
      },
    ],
    keywords: [
      "find people",
      "followers",
      "following",
      "private profile",
      "recent searches",
      "saved searches",
      "search aliases",
      "username",
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
      "Use common TTC wording such as artists or tattooers, shops or studios, guest spots or conventions, jobs or Gigs, shirts or Merch, bookings or appointments, DMs or messages, and vendors or sellers.",
      "Use the Profiles, 4U, Gossip, Stuff, Gigs, and Merch tabs to narrow the result type.",
      "Use recent searches or saved search shortcuts for searches you run often, and save posts or products from their cards when you want to find them again later.",
    ],
    tutorialMedia: [
      {
        assetSrc: "/screenshots/mobile-profile-search.png",
        description:
          "Show a safe example search for a username, a city, and a Merch term with private results hidden.",
        kind: "screenshot",
        title: "Search examples",
      },
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
    keywords: [
      "approval",
      "business license",
      "certification",
      "document upload",
      "license",
      "resubmit",
      "scratcher",
      "vendor proof",
    ],
    lastReviewed: "July 15, 2026",
    relatedSlugs: ["artist-profile-shop-links", "merch-products-orders"],
    slug: "verification-documents",
    steps: [
      "Open Settings and choose the Verification area.",
      "Select artist, studio, or vendor review.",
      "Enter the license or business name, issuing location, expiration date when available, and supporting document.",
      "Use documentation that matches the account type: artist license or certification, studio/shop license, vendor business proof, or other professional eligibility documents.",
      "Keep private personal details off public profile fields. Verification documents are for admin review only.",
      "Submit for review and watch Account alerts for approval, rejection, or resubmission notes.",
      "After approval, check which tools are unlocked for your account type before creating Stuff, Merch, booking, or ad activity.",
    ],
    tutorialMedia: [
      {
        description:
          "Show the verification form with sample placeholder data only; never show real license numbers or uploaded documents.",
        kind: "screenshot",
        title: "Verification form basics",
      },
      {
        description:
          "Short clip of selecting account type, choosing review type, and submitting a safe dummy document.",
        kind: "short_clip",
        title: "Submit for review walkthrough",
      },
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
          "Calendar export files are available for scheduled bookings. Use Google, Apple/iCloud, or standard iCalendar notes to keep appointment details clear with clients.",
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
          "Refund requests for paid deposits stay in review. Support checks the appointment status, cancellation reason, artist/shop policy, and payment state before any refund decision.",
        question: "How do deposit refunds work?",
      },
      {
        answer:
          "Calendar files should only include appointment details needed by the client and artist/studio. Do not put private payment details, legal notes, admin review notes, or private contact details into public booking notes.",
        question: "What should stay out of calendar notes?",
      },
    ],
    keywords: [
      "add to calendar",
      "apple calendar",
      "blackout dates",
      "calendar",
      "deposit",
      "google calendar",
      "ical",
      "refunds",
      "time slots",
    ],
    lastReviewed: "July 15, 2026",
    relatedSlugs: ["artist-profile-shop-links", "ads-and-credits"],
    slug: "booking-appointments",
    steps: [
      "Open Settings and choose the Booking tools.",
      "Create appointment types with duration, notes, buffer time, and deposit rules.",
      "Add weekly time slots and blackout dates so clients only request workable times.",
      "Use public booking notes or links for existing calendar/request pages if your shop already has one.",
      "Review incoming booking requests, accept the right slot, and let the client pay the deposit when required.",
      "Confirm the appointment type, scheduled time, deposit amount, TTC fee, cancellation expectation, and artist note before asking a client to check out.",
      "Download the private calendar file from accepted scheduled bookings when you need to add the appointment to your calendar.",
      "Use refund review instead of promising instant deposit refunds before support reviews the request.",
    ],
    tutorialMedia: [
      {
        description:
          "Show appointment types, weekly slots, blackout dates, and deposit fields with safe sample values.",
        kind: "screenshot",
        title: "Booking setup sections",
      },
      {
        description:
          "Short clip of a client request, artist review, deposit confirmation, and private calendar download.",
        kind: "short_clip",
        title: "Booking request to calendar",
      },
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
    keywords: [
      "ad credits",
      "advertiser",
      "campaign",
      "credits",
      "keywords",
      "placement",
      "sponsored",
      "waived payment",
    ],
    lastReviewed: "July 15, 2026",
    relatedSlugs: ["merch-products-orders", "posting-stories-dms"],
    slug: "ads-and-credits",
    steps: [
      "Open the advertising tools from Settings.",
      "Choose the goal, placement, location, keywords, budget, and destination.",
      "Use 4U/Gossip placements for artist-client lead, message, and engagement goals. Use Merch placement for product views and safe brand goods.",
      "Apply available ad credits before checkout when credits are available.",
      "Review the payment status before submitting. Campaigns only deliver after review and after payment is paid, waived by credit, or otherwise approved by admin rules.",
      "Submit for review and watch campaign status before the ad starts running.",
    ],
    tutorialMedia: [
      {
        description:
          "Show goal, placement, budget, and ad-credit fields with test campaign copy only.",
        kind: "screenshot",
        title: "Create an ad campaign",
      },
      {
        description:
          "Short clip of applying available ad credit and checking campaign review/payment status.",
        kind: "short_clip",
        title: "Use ad credits",
      },
    ],
    title: "How to create an ad and use ad credits",
  },
  {
    category: "Merch And Stuff",
    description:
      "Set up products, prepare order support, and understand review before taking orders.",
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
          "Sellers should finish account approval, product review, payout setup, fulfillment notes, and return/refund expectations before treating Merch as ready for orders. Checkout can stay closed until both the product and seller readiness checks pass.",
        question: "What should sellers finish before taking orders?",
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
          "Refund requests go to review. Support checks the order, seller fulfillment, buyer reason, and payment status before any money movement is approved. Sellers should write clear return/refund notes before submitting products so buyers know what to expect.",
        question: "How do Merch refunds work?",
      },
      {
        answer:
          "Use Support for missing, damaged, wrong, delayed, or returned packages. Include your username, the order or product link, what happened, and any private photos or tracking details that help support review the issue.",
        question: "What if a package has a problem?",
      },
    ],
    keywords: [
      "fulfillment",
      "merch seller",
      "orders",
      "package",
      "payout setup",
      "refunds",
      "shipping",
      "tracking",
      "wrong item",
    ],
    lastReviewed: "July 16, 2026",
    relatedSlugs: [
      "verification-documents",
      "order-refunds-disputes",
      "seller-payouts-payment-safety",
      "ads-and-credits",
    ],
    slug: "merch-products-orders",
    steps: [
      "Open Settings and choose Merch and payout tools.",
      "Add a title, description, price, clear product media, and a return/refund note buyers can understand.",
      "If the product ships, add the ship-from city and state/region plus fulfillment notes with timing, pickup, made-to-order, or handoff details.",
      "Submit the product for review before it appears publicly.",
      "Finish seller payout setup from the hosted account flow before order payouts are expected; checkout can remain closed until seller readiness is complete.",
      "Watch orders, fulfillment status, refund requests, and support questions from Settings.",
      "For each paid order, use the seller order card to review the private shipping address, then mark the item fulfilled only after shipping, pickup, or handoff is ready.",
      "Add tracking carrier, tracking number, or a tracking link when available. If there is no tracking, use a clear fulfillment note before marking the order complete.",
      "Use Admin or Support for missing, damaged, wrong, delayed, or returned packages, payment-reference lookup, refund review, seller non-delivery review, or dispute review.",
    ],
    tutorialMedia: [
      {
        description:
          "Show product title, media, price, return note, fulfillment note, and review status without real buyer data.",
        kind: "screenshot",
        title: "Merch product setup",
      },
      {
        description:
          "Short clip of reviewing a paid order, adding tracking, and marking fulfillment with safe sample shipping data.",
        kind: "short_clip",
        title: "Fulfill a Merch order",
      },
    ],
    title: "How to set up Merch products and handle orders",
  },
  {
    category: "Merch And Stuff",
    description:
      "Know what buyers and sellers should do when an order, package, refund request, dispute, or seller non-delivery issue needs private review.",
    faqs: [
      {
        answer:
      "Use Support or the order tools from Settings. Include the order or product link, what happened, and safe evidence such as tracking, package photos, or seller messages. Do not post private shipping, payment, or identity details in public comments.",
        question: "How do I ask for order help?",
      },
      {
        answer:
          "Refunds stay in manual review. Support checks payment status, fulfillment proof, tracking or handoff notes, buyer reason, seller response, content safety, and dispute risk before any refund decision.",
        question: "How are refunds reviewed?",
      },
      {
        answer:
          "If an order becomes a payment dispute or chargeback, admin review should pause seller payout release, fulfillment closeout, and any manual account credit decisions until the issue is resolved.",
        question: "What happens if there is a dispute?",
      },
      {
        answer:
          "Report seller non-delivery through Support with the order link and any safe evidence. Repeat non-delivery, unsafe goods, counterfeit goods, or payment abuse can trigger seller review or suspension.",
        question: "What if the seller does not deliver?",
      },
    ],
    keywords: [
      "chargeback",
      "damaged package",
      "dispute",
      "missing package",
      "non delivery",
      "order help",
      "package problem",
      "refund",
      "returned package",
      "seller non delivery",
      "tracking",
      "wrong item",
    ],
    lastReviewed: "July 17, 2026",
    relatedSlugs: [
      "merch-products-orders",
      "seller-payouts-payment-safety",
      "privacy-safety-support",
    ],
    slug: "order-refunds-disputes",
    steps: [
      "Open Settings and find the order when available, then check payment, fulfillment, tracking, pickup, handoff, or refund-review status.",
      "For missing, damaged, wrong, delayed, returned, or seller non-delivery issues, contact Support with the order or product link and a short explanation.",
      "Keep private shipping addresses, payment references, buyer contact details, identity documents, and bank or card details out of public comments, posts, and DMs.",
      "Sellers should add tracking, a tracking link, or a clear pickup/handoff note before marking a paid item fulfilled.",
      "Buyers should request refund review from Settings when the order is eligible, then watch for support follow-up instead of sending repeated public messages.",
      "Admins should compare payment status, fulfillment proof, buyer reason, seller response, safety reports, and dispute records before closing a refund, dispute, or payout decision.",
    ],
    tutorialMedia: [
      {
        description:
          "Show the buyer order card with safe sample order status, fulfillment status, and refund-review action without real shipping details.",
        kind: "screenshot",
        title: "Buyer order support path",
      },
      {
        description:
          "Short clip of a seller adding tracking or handoff proof and an admin reviewing the order support path with safe sample data.",
        kind: "short_clip",
        title: "Fulfillment and refund review",
      },
    ],
    title: "Order support, refunds, and disputes",
  },
  {
    category: "Merch And Stuff",
    description:
      "Understand seller payout setup, checkout readiness, TTC fees, fulfillment review, refunds, and why real-money flows stay gated until policy review is complete.",
    faqs: [
      {
        answer:
          "Verified artists, studios, vendors, and official TTC sellers can use the hosted payout setup when seller tools are available for their account. TTC forms should never ask for raw bank, routing, card, or debit payout credentials.",
        question: "Who can set up seller payouts?",
      },
      {
        answer:
          "Checkout can stay closed when the seller is not verified, payout setup is incomplete, the product still needs review, buyer-support details are missing, inventory is unavailable, or payment/refund/dispute rules still require review.",
        question: "Why is checkout not open on my product?",
      },
      {
        answer:
          "TTC records a small platform fee where checkout is available. The buyer should see fee-related checkout guidance before paying, and the seller/admin views should keep payment status and order status clear.",
        question: "How are TTC fees handled?",
      },
      {
        answer:
          "Refunds and disputes stay in private support review. Support checks the order, fulfillment proof, buyer reason, payment status, and safety/moderation issues before any decision.",
        question: "How do refunds and disputes affect payouts?",
      },
      {
        answer:
          "No. Use the hosted payout setup flow only. Never send bank, routing, card, debit, tax, or identity documents through public comments, DMs, profile fields, or screenshots.",
        question: "Should I send payout details to support?",
      },
    ],
    keywords: [
      "bank",
      "checkout closed",
      "dispute",
      "fees",
      "merchant",
      "payment safety",
      "payout",
      "payouts",
      "refund",
      "seller payout",
      "seller readiness",
    ],
    lastReviewed: "July 17, 2026",
    relatedSlugs: [
      "merch-products-orders",
      "order-refunds-disputes",
      "ads-and-credits",
      "booking-appointments",
      "privacy-safety-support",
    ],
    slug: "seller-payouts-payment-safety",
    steps: [
      "Finish profile setup, email confirmation, 18+ confirmation, and artist/studio/vendor verification before expecting seller payout tools.",
      "Create or update Merch products with clear product media, inventory, ship-from region, fulfillment notes, and return/refund expectations.",
      "Use the hosted seller payout setup flow from Settings when eligible. TTC stores readiness status only, not raw payout credentials.",
      "Watch the payout status chip in Settings and seller/admin review areas. A product can remain closed until seller payout readiness and product review both pass.",
      "Fulfill paid orders only after payment is marked paid and the item is shipped, ready for pickup, or otherwise handed off according to the product notes.",
      "Use Support for refund, dispute, package, seller non-delivery, or payout-readiness questions. Include the product or order link, but keep private payment credentials out of messages and screenshots.",
    ],
    tutorialMedia: [
      {
        description:
          "Show the Settings seller payout card, readiness chips, and hosted setup button without exposing private payout details.",
        kind: "screenshot",
        title: "Seller payout readiness",
      },
      {
        description:
          "Short clip of checking product review, payout readiness, order status, and the Help guide before contacting support.",
        kind: "short_clip",
        title: "Payment safety walkthrough",
      },
    ],
    title: "Seller payouts and payment safety",
  },
  {
    category: "Posting And Safety",
    description:
      "Post safely across 4U, Gossip, Stuff, Gigs, Merch, and Stories while using DMs, reports, blocks, and comments correctly.",
    faqs: [
      {
        answer:
          "Use the create button from the section you are in. The form changes based on whether you are posting to 4U, Gossip, Stuff, Gigs, Merch, or Stories. Use the dedicated DM screen for private messages.",
        question: "Why does the create form change?",
      },
      {
        answer:
          "Visible nudity is not allowed. Crop or cover private areas before posting, even when the purpose is tattoo or body-art documentation.",
        question: "Can I post tattoo placement photos with nudity?",
      },
    ],
    keywords: [
      "comments",
      "create post",
      "dm",
      "gigs",
      "gossip",
      "media upload",
      "stories",
      "stuff",
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
    tutorialMedia: [
      {
        assetSrc: "/screenshots/mobile-4u-safe.png",
        description:
          "Show the floating create button opening the right form for 4U, Gossip, Stuff, Gigs, Merch, and Stories, then show DM from the bottom shortcut.",
        kind: "screenshot",
        title: "Create button by section",
      },
      {
        assetSrc: "/screenshots/mobile-stories-safe.png",
        description:
          "Show the 24h Stories rail with safe sample content, visible story controls, and no private user data.",
        kind: "screenshot",
        title: "Stories rail preview",
      },
      {
        assetSrc: "/screenshots/mobile-gossip-safe.png",
        description:
          "Show a safe Gossip discussion preview so testers know where long-form tattoo community posts belong.",
        kind: "screenshot",
        title: "Gossip discussion preview",
      },
      {
        description:
          "Short clip of creating a Story, sending a DM reply, and using report/block controls with safe sample content.",
        kind: "short_clip",
        title: "Stories, DMs, and safety controls",
      },
    ],
    title: "How to post, use Stories, and DM safely",
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
          "Use Settings data controls or Support for deletion requests. Some safety, dispute, fraud, legal, or payment records may need review before final handling.",
        question: "How do account deletion requests work?",
      },
    ],
    keywords: [
      "account deletion",
      "block",
      "delete account",
      "privacy",
      "report",
      "safety",
      "support",
      "unsafe content",
    ],
    lastReviewed: "July 15, 2026",
    relatedSlugs: ["posting-stories-dms", "search-saved-people", "verification-documents"],
    slug: "privacy-safety-support",
    steps: [
      "Use report controls on posts, comments, profiles, Stuff, Gigs, Merch, or Stories when something breaks community rules.",
      "Block a member when you need to stop unwanted profile access, comments, or DMs.",
      "Keep private contact details, license documents, payment issues, disputes, and account-specific questions inside Support or Settings tools.",
      "Use Settings data controls or Support for account deletion requests, then watch for follow-up if review is needed.",
    ],
    tutorialMedia: [
      {
        assetSrc: "/screenshots/mobile-help-support.png",
        description:
          "Show the Help and Support path with dummy profiles and safe sample content only before capturing report, block, privacy, and data-request controls.",
        kind: "screenshot",
        title: "Privacy and support controls",
      },
    ],
    title: "How to use reports, blocks, privacy, and support",
  },
] as const satisfies readonly HelpArticle[];

export function getHelpArticle(slug: string) {
  return helpArticles.find((article) => article.slug === slug) ?? null;
}
