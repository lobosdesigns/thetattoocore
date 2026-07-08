import { Search, Send } from "lucide-react";
import {
  createFeedPost,
  createMarketplaceListing,
  createThreadPost,
} from "./actions";
import { FloatingComposerShell } from "./floating-composer-shell";
import { MediaInput } from "./media-input";
import { startConversation } from "./messages/actions";
import { PendingSubmitButton } from "./pending-submit-button";
import { WordLimitedField } from "./word-limited-field";

const imageAccept = "image/jpeg,image/png,image/webp,image/gif";
const imageVideoAccept = `${imageAccept},video/mp4,video/quicktime,video/webm`;

const visibilityOptions = [
  ["Public preview", "Searchable preview for logged-out visitors when the post is not sensitive."],
  ["Members only", "Visible after login. Good for shop talk, community posts, and member context."],
  ["Private", "Only you can see it for now. Useful for drafts or content you are not ready to share."],
] as const;

function VisibilityControl() {
  return (
    <section className="rounded-md border border-[#d8d1c6] bg-[#f7f4ef] p-3">
      <label className="block">
        <span className="text-sm font-semibold">Visibility</span>
        <select
          className="mt-2 h-10 w-full rounded-md border border-[#d8d1c6] bg-white px-3 text-sm outline-none focus:border-[#171412]"
          name="visibility"
        >
          <option value="public_preview">Public preview</option>
          <option value="members">Members only</option>
          <option value="private">Private</option>
        </select>
      </label>
      <div className="mt-3 grid gap-2">
        {visibilityOptions.map(([label, description]) => (
          <p className="text-xs leading-5 text-[#766d62]" key={label}>
            <span className="font-semibold text-[#4f473f]">{label}:</span>{" "}
            {description}
          </p>
        ))}
      </div>
    </section>
  );
}

const sensitiveExamples = [
  "Tattoo placement includes limited non-sexual nudity.",
  "Fresh, healing, scar cover, piercing, or body modification detail.",
  "No pornography, sexual solicitation, or sexualized minor content.",
] as const;

function SensitiveControls() {
  return (
    <section className="rounded-md border border-[#d8d1c6] bg-[#fff7ec] p-3">
      <label className="flex items-start gap-2 text-sm font-semibold">
        <input className="mt-1 size-4" name="is_sensitive" type="checkbox" />
        <span>Mark as sensitive body-art content</span>
      </label>
      <p className="mt-2 text-xs leading-5 text-[#766d62]">
        Use this when the content is acceptable body-art documentation but
        should require login and 18+ confirmation before viewing.
      </p>
      <select
        className="mt-3 h-10 w-full rounded-md border border-[#d8d1c6] bg-white px-3 text-sm outline-none focus:border-[#171412]"
        name="sensitive_reason"
      >
        <option value="body_art_nudity">Body-art nudity</option>
        <option value="healing">Healing or fresh work</option>
        <option value="scar_cover">Scar cover or medical context</option>
        <option value="piercing">Piercing or body modification</option>
        <option value="other">Other body-art context</option>
      </select>
      <div className="mt-3 grid gap-2">
        {sensitiveExamples.map((example) => (
          <p className="text-xs leading-5 text-[#766d62]" key={example}>
            {example}
          </p>
        ))}
      </div>
    </section>
  );
}

export function FloatingComposer({
  canCreate,
  isSignedIn,
}: {
  canCreate: boolean;
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
              className="min-h-28 w-full rounded-md border border-[#d8d1c6] bg-white px-3 py-2 text-sm outline-none focus:border-[#171412]"
              maxLength={360}
              maxWords={40}
              minTrimmedLength={3}
              name="caption"
              placeholder="Short caption, 40 words max"
              required
              validationMessage="Feed caption needs at least 3 characters."
            />
            <input
              className="h-10 w-full rounded-md border border-[#d8d1c6] bg-white px-3 text-sm outline-none focus:border-[#171412]"
              name="style_tags"
              placeholder="blackwork, fine line"
            />
            <input
              className="h-10 w-full rounded-md border border-[#d8d1c6] bg-white px-3 text-sm outline-none focus:border-[#171412]"
              name="location_label"
              placeholder="Austin, TX"
            />
            <VisibilityControl />
            <SensitiveControls />
            <MediaInput accept={imageVideoAccept} name="media" required />
            <PendingSubmitButton
              className="h-11 w-full rounded-md bg-[#171412] px-4 text-sm font-semibold text-white"
              pendingLabel="Publishing"
            >
              Publish
            </PendingSubmitButton>
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
              className="min-h-44 w-full rounded-md border border-[#d8d1c6] bg-white px-3 py-2 text-sm outline-none focus:border-[#171412]"
              maxCharacters={8000}
              maxLength={8000}
              minTrimmedLength={3}
              name="body"
              placeholder="Start a thread"
              required
              validationMessage="Gossip post needs at least 3 characters."
            />
            <VisibilityControl />
            <SensitiveControls />
            <MediaInput accept={imageAccept} name="media" videoAllowed={false} />
            <PendingSubmitButton
              className="h-11 w-full rounded-md bg-[#171412] px-4 text-sm font-semibold text-white"
              pendingLabel="Posting"
            >
              Post thread
            </PendingSubmitButton>
          </form>
        ),
        marketplace: (
          <form
            action={createMarketplaceListing}
            className="space-y-3"
            encType="multipart/form-data"
          >
            <WordLimitedField
              className="h-10 w-full rounded-md border border-[#d8d1c6] bg-white px-3 text-sm outline-none focus:border-[#171412]"
              maxCharacters={120}
              maxLength={120}
              minTrimmedLength={3}
              name="title"
              placeholder="Flash sheet, chair rental, supplies"
              required
              validationMessage="Stuff title needs at least 3 characters."
              wrapperClassName="w-full"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                className="h-10 rounded-md border border-[#d8d1c6] bg-white px-3 text-sm outline-none focus:border-[#171412]"
                name="price"
                placeholder="80"
              />
              <select
                className="h-10 rounded-md border border-[#d8d1c6] bg-white px-3 text-sm outline-none focus:border-[#171412]"
                name="category"
              >
                <option value="flash">Flash</option>
                <option value="guest-spot">Guest spot</option>
                <option value="chair">Chair</option>
                <option value="supplies">Supplies</option>
                <option value="service">Service</option>
              </select>
            </div>
            <WordLimitedField
              as="textarea"
              className="min-h-24 w-full rounded-md border border-[#d8d1c6] bg-white px-3 py-2 text-sm outline-none focus:border-[#171412]"
              maxCharacters={2000}
              maxLength={2000}
              name="description"
              placeholder="Details, terms, dates, or pickup/shipping notes."
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                className="h-10 rounded-md border border-[#d8d1c6] bg-white px-3 text-sm outline-none focus:border-[#171412]"
                name="city"
                placeholder="City"
              />
              <input
                className="h-10 rounded-md border border-[#d8d1c6] bg-white px-3 text-sm outline-none focus:border-[#171412]"
                name="region"
                placeholder="State"
              />
            </div>
            <VisibilityControl />
            <SensitiveControls />
            <MediaInput accept={imageVideoAccept} name="media" />
            <PendingSubmitButton
              className="h-11 w-full rounded-md bg-[#171412] px-4 text-sm font-semibold text-white"
              pendingLabel="Publishing"
            >
              Publish listing
            </PendingSubmitButton>
          </form>
        ),
        gigs: (
          <form
            action="/api/gigs"
            className="space-y-3"
            encType="multipart/form-data"
            method="post"
          >
            <WordLimitedField
              className="h-10 w-full rounded-md border border-[#d8d1c6] bg-white px-3 text-sm outline-none focus:border-[#171412]"
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
              className="h-10 w-full rounded-md border border-[#d8d1c6] bg-white px-3 text-sm outline-none focus:border-[#171412]"
              name="category"
            >
              <option value="job">Job</option>
              <option value="convention">Convention</option>
              <option value="guest_spot">Guest spot</option>
              <option value="shop_opening">Shop opening</option>
              <option value="apprenticeship">Apprenticeship</option>
              <option value="event">Event</option>
            </select>
            <WordLimitedField
              as="textarea"
              className="min-h-28 w-full rounded-md border border-[#d8d1c6] bg-white px-3 py-2 text-sm outline-none focus:border-[#171412]"
              maxCharacters={3000}
              maxLength={3000}
              name="description"
              placeholder="Details, dates, requirements, booth info, or contact notes."
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                className="h-10 rounded-md border border-[#d8d1c6] bg-white px-3 text-sm outline-none focus:border-[#171412]"
                name="city"
                placeholder="City"
              />
              <input
                className="h-10 rounded-md border border-[#d8d1c6] bg-white px-3 text-sm outline-none focus:border-[#171412]"
                name="region"
                placeholder="State"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                className="h-10 rounded-md border border-[#d8d1c6] bg-white px-3 text-sm outline-none focus:border-[#171412]"
                name="starts_at"
                type="date"
              />
              <input
                className="h-10 rounded-md border border-[#d8d1c6] bg-white px-3 text-sm outline-none focus:border-[#171412]"
                name="ends_at"
                type="date"
              />
            </div>
            <WordLimitedField
              className="h-10 w-full rounded-md border border-[#d8d1c6] bg-white px-3 text-sm outline-none focus:border-[#171412]"
              maxCharacters={120}
              maxLength={120}
              name="compensation"
              placeholder="Paid, booth fee, commission split"
              wrapperClassName="w-full"
            />
            <WordLimitedField
              className="h-10 w-full rounded-md border border-[#d8d1c6] bg-white px-3 text-sm outline-none focus:border-[#171412]"
              maxCharacters={300}
              maxLength={300}
              name="contact_url"
              placeholder="Application or event link"
              type="url"
              wrapperClassName="w-full"
            />
            <VisibilityControl />
            <SensitiveControls />
            <MediaInput accept={imageAccept} name="media" videoAllowed={false} />
            <PendingSubmitButton
              className="h-11 w-full rounded-md bg-[#171412] px-4 text-sm font-semibold text-white"
              pendingLabel="Posting"
              type="submit"
            >
              Post gig
            </PendingSubmitButton>
          </form>
        ),
        messages: (
          <form action={startConversation} className="space-y-3">
            <div className="flex items-center gap-2 rounded-md border border-[#d8d1c6] bg-white px-3">
              <Search className="size-4 text-[#766d62]" />
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
              className="min-h-28 w-full rounded-md border border-[#d8d1c6] bg-white px-3 py-2 text-sm outline-none focus:border-[#171412]"
              maxCharacters={4000}
              maxLength={4000}
              minTrimmedLength={1}
              name="body"
              placeholder="Message"
              required
              validationMessage="Write a message before sending."
            />
            <PendingSubmitButton
              className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#171412] px-4 text-sm font-semibold text-white"
              pendingLabel="Sending"
            >
              <Send className="size-4" />
              Send
            </PendingSubmitButton>
          </form>
        ),
      }}
      isSignedIn={isSignedIn}
    />
  );
}
