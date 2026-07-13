import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronDown, Search, Send } from "lucide-react";
import {
  createFeedPost,
  createMarketplaceListing,
  createStoryPost,
  createThreadPost,
} from "./actions";
import { FloatingComposerShell } from "./floating-composer-shell";
import { MediaInput } from "./media-input";
import { startConversation } from "./messages/actions";
import { PendingSubmitButton } from "./pending-submit-button";
import { WordLimitedField } from "./word-limited-field";

const imageAccept = "image/jpeg,image/png,image/webp,image/gif";
const imageVideoAccept = `${imageAccept},video/mp4,video/quicktime`;

const visibilityOptions = [
  ["Public preview", "Searchable preview for logged-out visitors."],
  ["Members only", "Visible after login. Good for shop talk, community posts, and member context."],
  ["Private", "Only you can see it for now. Useful for drafts or content you are not ready to share."],
] as const;

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
}: {
  defaultValue?: "members" | "private" | "public_preview";
  helper?: string;
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
          <option value="public_preview">Public preview</option>
          <option value="members">Members only</option>
          <option value="private">Private</option>
        </select>
      </label>
      {helper ? (
        <p className="mt-3 text-xs leading-5 text-[var(--muted-strong)]">
          {helper}
        </p>
      ) : null}
      <div className="mt-3 grid gap-2">
        {visibilityOptions.map(([label, description]) => (
          <p className="text-xs leading-5 text-[var(--muted-strong)]" key={label}>
            <span className="font-semibold text-[var(--muted)]">{label}:</span>{" "}
            {description}
          </p>
        ))}
      </div>
    </section>
  );
}

function DmAttachmentControl() {
  return (
    <ComposerDetails title="Photo attachment">
      <MediaInput
        accept={imageAccept}
        compact
        maxImageBytes={10 * 1024 * 1024}
        name="media"
        videoAllowed={false}
      />
      <p className="text-xs leading-5 text-[var(--muted-strong)]">
        Photo DMs stay private to the conversation. GIFs are allowed; video DMs
        can come later with the managed video pipeline.
      </p>
    </ComposerDetails>
  );
}

export function FloatingComposer({
  canCreate,
  canCreateStuff,
  isSignedIn,
}: {
  canCreate: boolean;
  canCreateStuff: boolean;
  isSignedIn: boolean;
}) {
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
              validationMessage="Feed caption needs at least 3 characters."
            />
            <ComposerDetails title="Style and location">
              <input
                className="h-10 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
                name="style_tags"
                placeholder="blackwork, fine line"
              />
              <input
                className="h-10 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
                name="location_label"
                placeholder="Austin, TX"
              />
            </ComposerDetails>
            <ComposerDetails title="Visibility">
              <VisibilityControl />
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
                Stories are temporary image/GIF posts for fresh work, shop
                moments, events, and quick community updates. No visible nudity
                for launch.
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
              />
            </ComposerDetails>
            <MediaInput
              accept={imageAccept}
              maxImageBytes={10 * 1024 * 1024}
              name="media"
              required
              videoAllowed={false}
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
            <ComposerDetails title="Visibility">
              <VisibilityControl />
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
          <div className="rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_92%,transparent)] p-4">
            <p className="text-sm font-semibold">Merch listings are approval-only.</p>
            <p className="mt-2 text-sm leading-6 text-[var(--muted-strong)]">
              Merch will be for public fan purchases like artist shirts, prints,
              art, stickers, vendor brand goods, and official TheTattooCore
              merchandise. It stays separate from Stuff, which is for verified
              professional equipment and trade.
            </p>
            <p className="mt-3 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] p-3 text-xs leading-5 text-[var(--muted)]">
              Stripe checkout is in test mode. Seller product creation stays
              closed until approval, tax, shipping, refunds, fulfillment, and
              payment-provider rules are ready.
            </p>
          </div>
        ),
        messages: (
          <form
            action={startConversation}
            className="space-y-3"
            encType="multipart/form-data"
          >
            <div className="flex items-center gap-2 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-3">
              <Search className="size-4 text-[var(--muted-strong)]" />
              <input
                className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none"
                maxLength={30}
                minLength={3}
                name="username"
                pattern="@?[a-zA-Z0-9_]{3,30}"
                placeholder="username"
                required
                title="Use 3-30 letters, numbers, or underscores."
              />
            </div>
            <WordLimitedField
              as="textarea"
              className="min-h-28 w-full rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-3 py-2 text-sm outline-none focus:border-[var(--foreground)]"
              emojiShortcuts
              maxCharacters={4000}
              maxLength={4000}
              minTrimmedLength={1}
              name="body"
              placeholder="Message"
              required
              validationMessage="Write a message before sending."
            />
            <DmAttachmentControl />
            <ComposerSubmit pendingLabel="Sending">
              <Send className="size-4" />
              Send
            </ComposerSubmit>
          </form>
        ),
      }}
      isSignedIn={isSignedIn}
    />
  );
}
