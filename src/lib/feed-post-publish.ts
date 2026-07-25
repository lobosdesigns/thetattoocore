export type FeedPostPublishStage = "draft" | "upload" | "attach" | "publish";
export type FeedPostCleanupStep = "media" | "draft";

type FeedPostPublishDependencies = {
  attachMedia: (postId: string) => Promise<void>;
  confirmPublished: (postId: string) => Promise<boolean>;
  createDraft: (postId: string) => Promise<void>;
  deleteDraft: (postId: string) => Promise<boolean>;
  postId: string;
  publishDraft: (postId: string) => Promise<void>;
  removeMedia: (postId: string) => Promise<void>;
  uploadMedia: (postId: string) => Promise<void>;
};

type FeedPostPublishResult =
  | {
      ok: true;
      postId: string;
    }
  | {
      cleanupErrors: Array<{
        error: unknown;
        step: FeedPostCleanupStep;
      }>;
      error: unknown;
      ok: false;
      stage: FeedPostPublishStage;
      statusUncertain: boolean;
      confirmationError?: unknown;
    };

export async function publishFeedPostWithRequiredMedia({
  attachMedia,
  confirmPublished,
  createDraft,
  deleteDraft,
  postId,
  publishDraft,
  removeMedia,
  uploadMedia,
}: FeedPostPublishDependencies): Promise<FeedPostPublishResult> {
  let stage: FeedPostPublishStage = "draft";

  try {
    if (!postId) {
      throw new Error("Feed post publication requires an id.");
    }
    await createDraft(postId);

    stage = "upload";
    await uploadMedia(postId);

    stage = "attach";
    await attachMedia(postId);

    stage = "publish";
    await publishDraft(postId);

    return { ok: true, postId };
  } catch (error) {
    if (stage === "publish") {
      try {
        if (await confirmPublished(postId)) {
          return { ok: true, postId };
        }
      } catch (confirmationError) {
        return {
          cleanupErrors: [],
          confirmationError,
          error,
          ok: false,
          stage,
          statusUncertain: true,
        };
      }
    }

    const cleanupErrors: Array<{
      error: unknown;
      step: FeedPostCleanupStep;
    }> = [];

    let draftDeleted = false;
    try {
      draftDeleted = await deleteDraft(postId);
    } catch (cleanupError) {
      cleanupErrors.push({ error: cleanupError, step: "draft" });
    }

    if (draftDeleted && stage !== "draft") {
      try {
        await removeMedia(postId);
      } catch (cleanupError) {
        cleanupErrors.push({ error: cleanupError, step: "media" });
      }
    }

    return {
      cleanupErrors,
      error,
      ok: false,
      stage,
      statusUncertain: stage === "publish" && !draftDeleted,
    };
  }
}

export async function settlePublishedFeedPostTags(
  syncTags: () => Promise<string | null>,
): Promise<{ error?: unknown; ok: boolean }> {
  try {
    const error = await syncTags();
    return error ? { error, ok: false } : { ok: true };
  } catch (error) {
    return { error, ok: false };
  }
}
