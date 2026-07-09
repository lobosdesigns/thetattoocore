import { Flag, MoreHorizontal } from "lucide-react";
import { createContentReport } from "@/app/actions";

type ReportSubjectType =
  | "feed_post"
  | "gig"
  | "marketplace_listing"
  | "profile"
  | "thread_post";

function reportTitle(subjectType: ReportSubjectType) {
  return subjectType === "profile" ? "Report profile" : "Report content";
}

function reportDescription(subjectType: ReportSubjectType) {
  if (subjectType === "profile") {
    return "Report profiles for scams, harassment, illegal services, sexual content, minor safety concerns, or impersonation.";
  }

  return "Report unsafe, scammy, sexual, illegal, harassing, or miscategorized body-art content.";
}

function optionsLabel(subjectType: ReportSubjectType) {
  return subjectType === "profile" ? "Profile options" : "Content options";
}

function reportButtonLabel(subjectType: ReportSubjectType) {
  return subjectType === "profile" ? "Report profile" : "Report";
}

export function ContentReportForm({
  returnHash,
  returnPath,
  subjectId,
  subjectType,
}: {
  returnHash?: string;
  returnPath: string;
  subjectId: string;
  subjectType: ReportSubjectType;
}) {
  return (
    <details className="group relative inline-block rounded-md">
      <summary
        aria-label={optionsLabel(subjectType)}
        className="inline-flex h-9 cursor-pointer list-none items-center gap-2 rounded-md border border-[#cfc8bd] bg-white px-2.5 text-xs font-semibold text-[#4f473f] hover:border-[#c8953b]"
        title={optionsLabel(subjectType)}
      >
        <MoreHorizontal className="size-4" />
        <span>{reportButtonLabel(subjectType)}</span>
      </summary>
      <form
        action={createContentReport}
        className="fixed inset-x-3 bottom-24 z-40 max-h-[calc(100dvh-8rem)] overflow-y-auto rounded-md border border-[#cfc8bd] bg-[#fffdf9] p-3 shadow-2xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:left-auto sm:right-0 sm:mt-2 sm:w-[min(20rem,calc(100vw-3rem))]"
      >
        <input name="subject_id" type="hidden" value={subjectId} />
        <input name="subject_type" type="hidden" value={subjectType} />
        <input name="return_path" type="hidden" value={returnPath} />
        {returnHash ? (
          <input name="return_hash" type="hidden" value={returnHash} />
        ) : null}
        <p className="text-sm font-bold text-[#171412]">
          {reportTitle(subjectType)}
        </p>
        <p className="mb-2 text-xs leading-5 text-[#766d62]">
          {reportDescription(subjectType)}
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
