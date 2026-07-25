export type FeedPostPublishStage = "draft" | "upload" | "attach" | "publish";
export type FeedPostCleanupStep = "media" | "draft";

type FeedPostPublishDependencies = {
  attachMedia: (postId: string) => Promise<void>;
  createDraft: () => Promise<string>;
  deleteDraft: (postId: string) => Promise<void>;
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
    };

export async function publishFeedPostWithRequiredMedia({
  attachMedia,
  createDraft,
  deleteDraft,
  publishDraft,
  removeMedia,
  uploadMedia,
}: FeedPostPublishDependencies): Promise<FeedPostPublishResult> {
  let postId: string | null = null;
  let stage: FeedPostPublishStage = "draft";

  try {
    postId = await createDraft();
    if (!postId) {
      throw new Error("Feed post draft creation did not return an id.");
    }

    stage = "upload";
    await uploadMedia(postId);

    stage = "attach";
    await attachMedia(postId);

    stage = "publish";
    await publishDraft(postId);

    return { ok: true, postId };
  } catch (error) {
    const cleanupErrors: Array<{
      error: unknown;
      step: FeedPostCleanupStep;
    }> = [];

    if (postId) {
      try {
        await removeMedia(postId);
      } catch (cleanupError) {
        cleanupErrors.push({ error: cleanupError, step: "media" });
      }

      try {
        await deleteDraft(postId);
      } catch (cleanupError) {
        cleanupErrors.push({ error: cleanupError, step: "draft" });
      }
    }

    return {
      cleanupErrors,
      error,
      ok: false,
      stage,
    };
  }
}
