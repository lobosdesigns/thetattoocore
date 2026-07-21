import { ChevronDown, Flag } from "lucide-react";
import { createContentReport } from "@/app/actions";

type ReportSubjectType =
  | "comment"
  | "feed_post"
  | "gig"
  | "help_article_comment"
  | "marketplace_listing"
  | "merch_product"
  | "profile"
  | "story_post"
  | "thread_post";

function reportTitle(subjectType: ReportSubjectType) {
  if (subjectType === "help_article_comment") return "Report guide question";
  if (subjectType === "comment") return "Report comment";
  return subjectType === "profile" ? "Report profile" : "Report content";
}

function reportDescription(subjectType: ReportSubjectType) {
  if (subjectType === "help_article_comment") {
    return "Report guide questions for spam, harassment, scams, unsafe advice, suspected AI-generated content, sexual content, minor safety concerns, or illegal activity.";
  }

  if (subjectType === "comment") {
    return "Report comments or replies for harassment, scams, unsafe practice, suspected AI-generated content, sexual content, minor safety concerns, or illegal activity.";
  }

  if (subjectType === "profile") {
    return "Report profiles for scams, harassment, suspected AI-generated content claims, illegal services, sexual content, minor safety concerns, or impersonation.";
  }

  if (subjectType === "merch_product") {
    return "Report unsafe, counterfeit, scammy, suspected AI-generated, sexual, illegal, or miscategorized Merch products.";
  }

  if (subjectType === "story_post") {
    return "Report unsafe, suspected AI-generated, sexual, harassing, scammy, illegal, or policy-breaking Stories.";
  }

  return "Report unsafe, scammy, suspected AI-generated, sexual, illegal, harassing, or miscategorized body-art content.";
}

function reportButtonLabel(subjectType: ReportSubjectType) {
  if (subjectType === "comment") return "Report";
  return subjectType === "profile" ? "Report profile" : "Report";
}

function reportMenuLabel(subjectType: ReportSubjectType) {
  if (subjectType === "help_article_comment") return "Open guide question report form";
  if (subjectType === "comment") return "Open comment report form";
  return subjectType === "profile" ? "Open profile report form" : "Open report form";
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
    <details className="group w-full max-w-full rounded-md">
      <summary
        aria-label={reportMenuLabel(subjectType)}
        className="ttc-surface inline-flex h-9 cursor-pointer list-none items-center gap-2 rounded-md border px-2.5 text-xs font-semibold transition hover:border-[var(--accent)] group-open:border-[var(--accent)]"
        title={reportMenuLabel(subjectType)}
      >
        <Flag className="size-3.5" />
        <span>{reportButtonLabel(subjectType)}</span>
        <ChevronDown className="size-3.5 transition group-open:rotate-180" />
      </summary>
      <form
        action={createContentReport}
        className="ttc-surface mt-2 w-full max-w-full overflow-hidden rounded-md border p-3 shadow-[0_10px_24px_rgba(23,20,18,0.12)] sm:max-w-sm"
      >
        <input name="subject_id" type="hidden" value={subjectId} />
        <input name="subject_type" type="hidden" value={subjectType} />
        <input name="return_path" type="hidden" value={returnPath} />
        {returnHash ? (
          <input name="return_hash" type="hidden" value={returnHash} />
        ) : null}
        <p className="text-sm font-bold">
          {reportTitle(subjectType)}
        </p>
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--brand-gold)]">
          Safety review
        </p>
        <p className="ttc-muted mb-2 text-xs leading-5">
          {reportDescription(subjectType)}
        </p>
        <div className="grid min-w-0 gap-2">
          <select
            aria-label="Report reason"
            className="h-9 w-full min-w-0 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-2 text-xs outline-none focus:border-[var(--foreground)]"
            name="reason"
          >
            <option value="sensitive non-nude body-art">Sensitive or restricted body-art context</option>
            <option value="sexual content">Nudity, sexual, or pornographic content</option>
            <option value="minor safety concern">Minor safety concern</option>
            <option value="harassment or hate">Harassment, hate, or threats</option>
            <option value="scam or spam">Scam, spam, or impersonation</option>
            <option value="suspected ai-generated content">Suspected AI-generated content</option>
            <option value="unsafe practice">Unsafe tattoo/body-art practice</option>
            <option value="illegal goods or services">Illegal goods or services</option>
            <option value="other">Other policy concern</option>
          </select>
          <input
            className="h-9 w-full min-w-0 rounded-md border border-[var(--card-rim)] bg-[color-mix(in_srgb,var(--paper-warm)_94%,transparent)] px-2 text-xs outline-none focus:border-[var(--foreground)]"
            maxLength={500}
            name="details"
            placeholder="What should moderators know?"
          />
          <button className="flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-md bg-[var(--foreground)] px-2 text-xs font-semibold text-[var(--background)]">
            <Flag className="size-3.5" />
            Send report
          </button>
        </div>
      </form>
    </details>
  );
}
