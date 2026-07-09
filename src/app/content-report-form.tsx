import { Flag } from "lucide-react";
import { createContentReport } from "@/app/actions";

type ReportSubjectType = "feed_post" | "gig" | "marketplace_listing" | "thread_post";

export function ContentReportForm({
  returnPath,
  subjectId,
  subjectType,
}: {
  returnPath: string;
  subjectId: string;
  subjectType: ReportSubjectType;
}) {
  return (
    <details className="rounded-md">
      <summary className="inline-flex h-9 cursor-pointer list-none items-center gap-1.5 rounded-md border border-[#cfc8bd] bg-white px-3 text-xs font-semibold">
        <Flag className="size-3.5" />
        Report
      </summary>
      <form
        action={createContentReport}
        className="mt-2 rounded-md border border-[#cfc8bd] bg-[#fffdf9] p-3"
      >
        <input name="subject_id" type="hidden" value={subjectId} />
        <input name="subject_type" type="hidden" value={subjectType} />
        <input name="return_path" type="hidden" value={returnPath} />
        <p className="mb-2 text-xs leading-5 text-[#766d62]">
          Report unsafe, scammy, sexual, illegal, harassing, or miscategorized
          body-art content.
        </p>
        <div className="grid gap-2">
          <select
            aria-label="Report reason"
            className="h-9 min-w-0 rounded-md border border-[#cfc8bd] bg-white px-2 text-xs outline-none focus:border-[#171412]"
            name="reason"
          >
            <option value="body-art nudity context">Sensitive body-art context</option>
            <option value="sexual content">Sexual or pornographic content</option>
            <option value="minor safety concern">Minor safety concern</option>
            <option value="harassment or hate">Harassment, hate, or threats</option>
            <option value="scam or spam">Scam, spam, or impersonation</option>
            <option value="unsafe practice">Unsafe tattoo/body-art practice</option>
            <option value="illegal goods or services">Illegal goods or services</option>
            <option value="other">Other policy concern</option>
          </select>
          <input
            className="h-9 min-w-0 rounded-md border border-[#cfc8bd] bg-white px-2 text-xs outline-none focus:border-[#171412]"
            maxLength={500}
            name="details"
            placeholder="What should moderators know?"
          />
          <button className="flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-md bg-[#171412] px-2 text-xs font-semibold text-white">
            <Flag className="size-3.5" />
            Send report
          </button>
        </div>
      </form>
    </details>
  );
}
