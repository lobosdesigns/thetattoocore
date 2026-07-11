import { Bookmark } from "lucide-react";
import { toggleSavedItem } from "@/app/actions";

type SavedSubjectType =
  | "feed_post"
  | "gig"
  | "marketplace_listing"
  | "merch_product"
  | "profile"
  | "thread_post";

export function SavedItemButton({
  className = "flex items-center gap-2 text-sm font-medium",
  hash,
  isSaved,
  returnPath,
  subjectId,
  subjectType,
}: {
  className?: string;
  hash?: string;
  isSaved: boolean;
  returnPath: string;
  subjectId: string;
  subjectType: SavedSubjectType;
}) {
  return (
    <form action={toggleSavedItem}>
      <input name="subject_id" type="hidden" value={subjectId} />
      <input name="subject_type" type="hidden" value={subjectType} />
      <input name="saved" type="hidden" value={isSaved ? "true" : "false"} />
      <input name="return_path" type="hidden" value={returnPath} />
      {hash ? <input name="return_hash" type="hidden" value={hash} /> : null}
      <button
        aria-label={isSaved ? "Remove from saved" : "Save"}
        className={className}
      >
        <Bookmark
          className={`size-5 ${
            isSaved ? "fill-[#171412] text-[#171412]" : ""
          }`}
        />
        {isSaved ? "Saved" : "Save"}
      </button>
    </form>
  );
}
