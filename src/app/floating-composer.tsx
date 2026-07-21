import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import {
  createFeedPost,
  createMarketplaceListing,
  createMerchProduct,
  createStoryPost,
  createThreadPost,
} from "./actions";
import { FloatingComposerShell } from "./floating-composer-shell";
import { MediaInput } from "./media-input";
import { PendingSubmitButton } from "./pending-submit-button";
import { WordLimitedField } from "./word-limited-field";

const imageAccept = "image/jpeg,image/png,image/webp,image/gif";
const imageVideoAccept = `${imageAccept},video/mp4,video/quicktime`;

type ComposerVisibility =
  | "public_preview"
  | "members"
  | "followers"
  | "verified_artists_shops"
  | "verified_professionals"
  | "private";

type VisibilityOption = {
  description: string;
  label: string;
  value: ComposerVisibility;
};

const baseVisibilityOptions: VisibilityOption[] = [
  {
    description: "Visible to everyone when it follows launch rules.",
    label: "Public",
    value: "public_preview",
  },
  {
    description: "Visible after login. Good for shop talk, community posts, and member context.",
    label: "Members only",
    value: "members",
  },
  {
    description: "Visible to accepted followers and you.",
    label: "Followers only",
    value: "followers",
  },
  {
    description: "Only you can see it. Useful for drafts or content you are not ready to share.",
    label: "Private",
    value: "private",
  },
];

const storyVisibilityOptions = baseVisibilityOptions.filter(
  (option) => option.value !== "followers",
);

const artistShopVisibilityOption = {
  description: "Visible only to verified artists and shops.",
  label: "Artists and shops only",
  value: "verified_artists_shops" as const,
};

function ComposerDetails({
  children,
  open = false,
  title,
}: {
  children: ReactNode;
  open?: boolean;
  title: string;
}) {
  return (
    <details
      className="group rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_92%,transparent)] p-3"
      open={open}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-bold">
        <span>{title}</span>
        <ChevronDown className="size-4 shrink-0 text-[var(--muted-strong)] transition group-open:rotate-180" />
      </summary>
      <div className="mt-3 space-y-3">{children}</div>
    </details>
  );
}

function ComposerSubmit({
  children,
  pendingLabel,
  type,
}: {
  children: ReactNode;
  pendingLabel: string;
  type?: "submit";
}) {
  return (
    <div className="sticky bottom-0 z-10 -mx-3 border-t border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-soft)_94%,transparent)] px-3 py-3 shadow-[0_-12px_24px_rgba(23,20,18,0.08)] backdrop-blur sm:-mx-4 sm:px-4">
      <PendingSubmitButton
        className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[var(--foreground)] px-4 text-sm font-semibold text-[var(--background)]"
        pendingLabel={pendingLabel}
        type={type}
      >
        {children}
      </PendingSubmitButton>
    </div>
  );
}

function VisibilityControl({
  defaultValue = "public_preview",
  helper,
  options = baseVisibilityOptions,
}: {
  defaultValue?: ComposerVisibility;
  helper?: string;
  options?: VisibilityOption[];
}) {
  return (
    <section className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_92%,transparent)] p-3">
      <label className="block">
        <span className="text-sm font-semibold">Visibility</span>
        <select
          className="mt-2 h-10 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
          defaultValue={defaultValue}
          name="visibility"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      {helper ? (
        <p className="mt-3 text-xs leading-5 text-[var(--muted-strong)]">
          {helper}
        </p>
      ) : null}
      <div className="mt-3 grid gap-2">
        {options.map((option) => (
          <p className="text-xs leading-5 text-[var(--muted-strong)]" key={option.value}>
            <span className="font-semibold text-[var(--muted)]">{option.label}:</span>{" "}
            {option.description}
          </p>
        ))}
      </div>
    </section>
  );
}

export function FloatingComposer({
  canPostVerifiedArtistShopAudience,
  canPostVerifiedGossipAudience,
  canCreate,
  canCreateStuff,
  isSignedIn,
}: {
  canPostVerifiedArtistShopAudience: boolean;
  canPostVerifiedGossipAudience: boolean;
  canCreate: boolean;
  canCreateStuff: boolean;
  isSignedIn: boolean;
}) {
  const feedVisibilityOptions = canPostVerifiedArtistShopAudience
    ? [...baseVisibilityOptions, artistShopVisibilityOption]
    : baseVisibilityOptions;
  const threadVisibilityOptions = canPostVerifiedGossipAudience
    ? [
        ...baseVisibilityOptions,
        ...(canPostVerifiedArtistShopAudience ? [artistShopVisibilityOption] : []),
        {
          description: "Visible only to verified artists and vendors.",
          label: "Verified artists and vendors",
          value: "verified_professionals" as const,
        },
      ]
    : canPostVerifiedArtistShopAudience
      ? [...baseVisibilityOptions, artistShopVisibilityOption]
      : baseVisibilityOptions;

  return (
    <FloatingComposerShell
      canCreate={canCreate}
      forms={{
        feed: (
          <form
            action={createFeedPost}
            className="space-y-3"
            encType="multipart/form-data"
          >
            <WordLimitedField
              as="textarea"
              className="min-h-24 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-3 py-2 text-sm outline-none focus:border-[var(--foreground)] sm:min-h-28"
              maxLength={360}
              maxWords={40}
              minTrimmedLength={3}
              name="caption"
              placeholder="Short caption, 40 words max"
              required
              validationMessage="4U caption needs at least 3 characters."
            />
            <ComposerDetails title="Style and location">
              <input
                className="h-10 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
                name="style_tags"
                placeholder="blackwork, fine line"
              />
              <input
                className="h-10 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
                name="tagged_usernames"
                placeholder="Tag members: @artistname, @shopname"
              />
              <input
                className="h-10 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
                name="location_label"
                placeholder="Austin, TX"
              />
            </ComposerDetails>
            <ComposerDetails title="Visibility">
              <VisibilityControl
                helper="Choose Public for everyone, Followers only for accepted followers, or Artists and shops only for verified artist/shop visibility."
                options={feedVisibilityOptions}
              />
            </ComposerDetails>
            <MediaInput accept={imageVideoAccept} name="media" required />
            <ComposerSubmit pendingLabel="Publishing">Publish</ComposerSubmit>
          </form>
        ),
        stories: (
          <form
            action={createStoryPost}
            className="space-y-3"
            encType="multipart/form-data"
          >
            <div className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_92%,transparent)] p-3 text-xs leading-5 text-[var(--muted)]">
              <p className="font-semibold text-[var(--foreground)]">
                24-hour story
              </p>
              <p className="mt-1">
                Stories are temporary photo, GIF, or short-video posts for
                fresh work, shop moments, events, and quick community updates.
                No visible nudity.
              </p>
            </div>
            <WordLimitedField
              as="textarea"
              className="min-h-20 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-3 py-2 text-sm outline-none focus:border-[var(--foreground)]"
              maxCharacters={240}
              maxLength={240}
              name="caption"
              placeholder="Short story caption"
            />
            <ComposerDetails title="Visibility">
              <VisibilityControl
                defaultValue="members"
                helper="Members-only is the default for Stories. Public-preview stories must stay non-sensitive and can be visible to logged-out visitors while active."
                options={storyVisibilityOptions}
              />
            </ComposerDetails>
            <MediaInput
              accept={imageVideoAccept}
              maxImageBytes={10 * 1024 * 1024}
              maxVideoBytes={25 * 1024 * 1024}
              maxVideoSeconds={15}
              name="media"
              required
            />
            <ComposerSubmit pendingLabel="Posting story">Post story</ComposerSubmit>
          </form>
        ),
        threads: (
          <form
            action={createThreadPost}
            className="space-y-3"
            encType="multipart/form-data"
          >
            <WordLimitedField
              as="textarea"
              className="min-h-44 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-3 py-2 text-sm outline-none focus:border-[var(--foreground)]"
              maxCharacters={8000}
              maxLength={8000}
              minTrimmedLength={3}
              name="body"
              placeholder="Start a thread"
              required
              validationMessage="Gossip post needs at least 3 characters."
            />
            <ComposerDetails title="Tags">
              <input
                className="h-10 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
                name="tagged_usernames"
                placeholder="Tag members: @artistname, @shopname"
              />
            </ComposerDetails>
            <ComposerDetails title="Visibility">
              <VisibilityControl
                defaultValue="members"
                helper="Choose Public for everyone, Followers only for accepted followers, Artists and shops only, or the verified artist/vendor audience when you want professional-only Gossip."
                options={threadVisibilityOptions}
              />
            </ComposerDetails>
            <MediaInput accept={imageAccept} name="media" videoAllowed={false} />
            <ComposerSubmit pendingLabel="Posting">Post thread</ComposerSubmit>
          </form>
        ),
        marketplace: (
          canCreateStuff ? (
            <form
              action={createMarketplaceListing}
              className="space-y-3"
              encType="multipart/form-data"
            >
              <WordLimitedField
                className="h-10 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
                maxCharacters={120}
                maxLength={120}
                minTrimmedLength={3}
                name="title"
                placeholder="Flash sheet, chair rental, shop gear"
                required
                validationMessage="Stuff title needs at least 3 characters."
                wrapperClassName="w-full"
              />
              <div className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_92%,transparent)] p-3 text-xs leading-5 text-[var(--muted)]">
                <p className="font-semibold text-[var(--foreground)]">
                  Professional access only
                </p>
                <p className="mt-1">
                  Tattoo machines, needles, pigments, tubes, and shop equipment
                  can only be listed for verified artists, studios, or approved
                  vendors to contact.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  className="h-10 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
                  name="price"
                  placeholder="80"
                />
                <select
                  className="h-10 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
                  name="category"
                >
                  <option value="flash">Flash</option>
                  <option value="guest-spot">Guest spot</option>
                  <option value="chair">Chair</option>
                  <option value="supplies">Supplies</option>
                  <option value="equipment">Equipment</option>
                  <option value="service">Service</option>
                </select>
              </div>
              <ComposerDetails title="Description and terms">
                <WordLimitedField
                  as="textarea"
                  className="min-h-24 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-3 py-2 text-sm outline-none focus:border-[var(--foreground)]"
                  maxCharacters={2000}
                  maxLength={2000}
                  name="description"
                  placeholder="Details, terms, dates, or pickup/shipping notes."
                />
              </ComposerDetails>
              <ComposerDetails title="Pickup, shipping, and location">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    className="h-10 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
                    name="city"
                    placeholder="City"
                  />
                  <input
                    className="h-10 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
                    name="region"
                    placeholder="State"
                  />
                </div>
              </ComposerDetails>
              <ComposerDetails title="Visibility">
                <VisibilityControl />
              </ComposerDetails>
              <MediaInput accept={imageVideoAccept} name="media" />
              <ComposerSubmit pendingLabel="Publishing">Publish listing</ComposerSubmit>
            </form>
          ) : (
            <div className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_92%,transparent)] p-4">
              <p className="text-sm font-semibold">
                Stuff is for verified artists, studios, and vendors.
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--muted-strong)]">
                Fans can browse Stuff, but listing, buying, selling, trading,
                seller contact, and professional equipment activity require
                verification.
              </p>
              <Link
                className="mt-3 inline-flex h-10 items-center justify-center rounded-md bg-[var(--foreground)] px-4 text-sm font-semibold text-[var(--background)]"
                href="/account#verification-settings"
              >
                Apply for verification
              </Link>
            </div>
          )
        ),
        gigs: (
          <form
            action="/api/gigs"
            className="space-y-3"
            encType="multipart/form-data"
            method="post"
          >
            <WordLimitedField
              className="h-10 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
              maxCharacters={140}
              maxLength={140}
              minTrimmedLength={3}
              name="title"
              placeholder="Guest spot, convention booth, artist wanted"
              required
              validationMessage="Gig title needs at least 3 characters."
              wrapperClassName="w-full"
            />
            <select
              className="h-10 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
              name="category"
            >
              <option value="job">Job</option>
              <option value="convention">Convention</option>
              <option value="guest_spot">Guest spot</option>
              <option value="shop_opening">Shop opening</option>
              <option value="apprenticeship">Apprenticeship</option>
              <option value="event">Event</option>
            </select>
            <ComposerDetails title="Description and more details">
              <WordLimitedField
                as="textarea"
                className="min-h-24 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-3 py-2 text-sm outline-none focus:border-[var(--foreground)]"
                maxCharacters={3000}
                maxLength={3000}
                name="description"
                placeholder="Details, dates, requirements, booth info, or contact notes."
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  className="h-10 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
                  name="city"
                  placeholder="City"
                />
                <input
                  className="h-10 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
                  name="region"
                  placeholder="State"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  className="h-10 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
                  name="starts_at"
                  type="date"
                />
                <input
                  className="h-10 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
                  name="ends_at"
                  type="date"
                />
              </div>
              <WordLimitedField
                className="h-10 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
                maxCharacters={120}
                maxLength={120}
                name="compensation"
                placeholder="Paid, booth fee, commission split"
                wrapperClassName="w-full"
              />
              <input
                className="h-10 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
                name="tagged_usernames"
                placeholder="Tag members: @artistname, @shopname"
              />
              <WordLimitedField
                className="h-10 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
                maxCharacters={300}
                maxLength={300}
                name="contact_url"
                placeholder="Application or event link"
                type="url"
                wrapperClassName="w-full"
              />
            </ComposerDetails>
            <ComposerDetails title="Visibility">
              <VisibilityControl />
            </ComposerDetails>
            <MediaInput accept={imageAccept} name="media" videoAllowed={false} />
            <ComposerSubmit pendingLabel="Posting" type="submit">
              Post gig
            </ComposerSubmit>
          </form>
        ),
        merch: (
          canCreateStuff ? (
            <form
              action={createMerchProduct}
              className="space-y-3"
              encType="multipart/form-data"
            >
              <WordLimitedField
                className="h-10 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
                maxCharacters={120}
                maxLength={120}
                minTrimmedLength={3}
                name="title"
                placeholder="Shop shirt, flash print, sticker pack"
                required
                validationMessage="Merch title needs at least 3 characters."
                wrapperClassName="w-full"
              />
              <div className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_92%,transparent)] p-3 text-xs leading-5 text-[var(--muted)]">
                <p className="font-semibold text-[var(--foreground)]">
                  Public fan merch
                </p>
                <p className="mt-1">
                  Shirts, prints, art, stickers, vendor brand goods, and official
                  TTC products belong here. Professional equipment and trade stay
                  in Stuff.
                </p>
              </div>
              <WordLimitedField
                as="textarea"
                className="min-h-28 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-3 py-2 text-sm outline-none focus:border-[var(--foreground)]"
                maxCharacters={4000}
                maxLength={4000}
                minTrimmedLength={10}
                name="description"
                placeholder="Sizing, material, edition, pickup or shipping notes"
                required
                validationMessage="Add at least 10 characters of Merch details."
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  className="h-10 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
                  inputMode="decimal"
                  name="price"
                  placeholder="25"
                  required
                />
                <input
                  className="h-10 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
                  min="1"
                  name="inventory_quantity"
                  placeholder="Qty"
                  required
                  type="number"
                />
              </div>
              <ComposerDetails title="Product type and shipping">
                <select
                  className="h-10 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
                  name="category"
                >
                  <option value="apparel">Apparel</option>
                  <option value="print">Print</option>
                  <option value="art">Art</option>
                  <option value="sticker">Sticker</option>
                  <option value="accessory">Accessory</option>
                  <option value="other">Other</option>
                </select>
                <label className="flex min-h-10 items-center gap-3 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-3 text-sm font-semibold">
                  <input
                    className="size-4 accent-[var(--gold)]"
                    defaultChecked
                    name="shipping_required"
                    type="checkbox"
                  />
                  Requires shipping address
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    className="h-10 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
                    name="ships_from_city"
                    placeholder="Ships from city"
                  />
                  <input
                    className="h-10 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
                    name="ships_from_region"
                    placeholder="State/region"
                  />
                </div>
                <WordLimitedField
                  as="textarea"
                  className="min-h-20 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-3 py-2 text-sm outline-none focus:border-[var(--foreground)]"
                  maxCharacters={1000}
                  maxLength={1000}
                  name="fulfillment_notes"
                  placeholder="Fulfillment notes: shipping timeline, pickup option, or made-to-order timing"
                />
                <WordLimitedField
                  as="textarea"
                  className="min-h-20 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-3 py-2 text-sm outline-none focus:border-[var(--foreground)]"
                  maxCharacters={1000}
                  maxLength={1000}
                  name="return_policy"
                  placeholder="Return/refund note buyers can understand before checkout"
                />
              </ComposerDetails>
              <MediaInput
                accept={imageVideoAccept}
                maxImageBytes={10 * 1024 * 1024}
                maxVideoBytes={50 * 1024 * 1024}
                maxVideoSeconds={60}
                name="media"
                required
              />
              <div className="rounded-md border border-[color-mix(in_srgb,var(--brand-gold)_28%,var(--card-rim))] bg-[color-mix(in_srgb,var(--brand-gold)_10%,var(--paper-warm))] p-3 text-xs leading-5 text-[var(--muted)]">
                New Merch goes to admin review first. Checkout only opens after
                the product and seller rules are approved.
              </div>
              <ComposerSubmit pendingLabel="Submitting" type="submit">
                Submit Merch
              </ComposerSubmit>
            </form>
          ) : (
            <div className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_92%,transparent)] p-4">
              <p className="text-sm font-semibold">Merch listings are approval-only.</p>
              <p className="mt-2 text-sm leading-6 text-[var(--muted-strong)]">
                Verified artists, studios, and vendors can submit public-buyable
                shirts, prints, art, stickers, vendor brand goods, and official
                TTC-style products for admin review.
              </p>
              <Link
                className="mt-3 inline-flex h-10 items-center justify-center rounded-md bg-[var(--foreground)] px-4 text-sm font-semibold text-[var(--background)]"
                href={isSignedIn ? "/account#verification-settings" : "/login"}
              >
                {isSignedIn ? "Verify seller status" : "Sign in"}
              </Link>
            </div>
          )
        ),
      }}
      isSignedIn={isSignedIn}
    />
  );
}
