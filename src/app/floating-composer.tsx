import { Search, Send } from "lucide-react";
import {
  createFeedPost,
  createMarketplaceListing,
  createThreadPost,
} from "./actions";
import { FloatingComposerShell } from "./floating-composer-shell";
import { startConversation } from "./messages/actions";

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
            <textarea
              className="min-h-28 w-full rounded-md border border-[#d8d1c6] bg-white px-3 py-2 text-sm outline-none focus:border-[#171412]"
              maxLength={360}
              name="caption"
              placeholder="Short caption, 40 words max"
              required
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
            <input
              accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm"
              className="block w-full rounded-md border border-[#d8d1c6] bg-white px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-[#efe7da] file:px-3 file:py-1.5 file:text-sm file:font-semibold"
              name="media"
              required
              type="file"
            />
            <button className="h-11 w-full rounded-md bg-[#171412] px-4 text-sm font-semibold text-white">
              Publish
            </button>
          </form>
        ),
        threads: (
          <form
            action={createThreadPost}
            className="space-y-3"
            encType="multipart/form-data"
          >
            <textarea
              className="min-h-44 w-full rounded-md border border-[#d8d1c6] bg-white px-3 py-2 text-sm outline-none focus:border-[#171412]"
              maxLength={8000}
              name="body"
              placeholder="Start a thread"
              required
            />
            <input
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="block w-full rounded-md border border-[#d8d1c6] bg-white px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-[#efe7da] file:px-3 file:py-1.5 file:text-sm file:font-semibold"
              name="media"
              type="file"
            />
            <button className="h-11 w-full rounded-md bg-[#171412] px-4 text-sm font-semibold text-white">
              Post thread
            </button>
          </form>
        ),
        marketplace: (
          <form
            action={createMarketplaceListing}
            className="space-y-3"
            encType="multipart/form-data"
          >
            <input
              className="h-10 w-full rounded-md border border-[#d8d1c6] bg-white px-3 text-sm outline-none focus:border-[#171412]"
              maxLength={120}
              name="title"
              placeholder="Flash sheet, chair rental, supplies"
              required
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
            <textarea
              className="min-h-24 w-full rounded-md border border-[#d8d1c6] bg-white px-3 py-2 text-sm outline-none focus:border-[#171412]"
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
            <input
              accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm"
              className="block w-full rounded-md border border-[#d8d1c6] bg-white px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-[#efe7da] file:px-3 file:py-1.5 file:text-sm file:font-semibold"
              name="media"
              type="file"
            />
            <button className="h-11 w-full rounded-md bg-[#171412] px-4 text-sm font-semibold text-white">
              Publish listing
            </button>
          </form>
        ),
        messages: (
          <form action={startConversation} className="space-y-3">
            <div className="flex items-center gap-2 rounded-md border border-[#d8d1c6] bg-white px-3">
              <Search className="size-4 text-[#766d62]" />
              <input
                className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none"
                name="username"
                placeholder="username"
                required
              />
            </div>
            <textarea
              className="min-h-28 w-full rounded-md border border-[#d8d1c6] bg-white px-3 py-2 text-sm outline-none focus:border-[#171412]"
              maxLength={4000}
              name="body"
              placeholder="Message"
              required
            />
            <button className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#171412] px-4 text-sm font-semibold text-white">
              <Send className="size-4" />
              Send
            </button>
          </form>
        ),
      }}
      isSignedIn={isSignedIn}
    />
  );
}
