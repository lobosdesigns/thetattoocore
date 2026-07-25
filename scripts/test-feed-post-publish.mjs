import assert from "node:assert/strict";
import {
  publishFeedPostWithRequiredMedia,
  settlePublishedFeedPostTags,
} from "../src/lib/feed-post-publish.ts";

function createHarness({
  cleanupFailures = new Set(),
  confirmationFailure = false,
  failureAfterCommit = false,
  failureStage = null,
  publishDuringDelete = false,
} = {}) {
  const calls = [];
  const deletedIds = [];
  const posts = new Map();
  const removedIds = [];
  const storage = new Set();
  const attachments = new Set();
  const postId = "post-1";
  const storagePath = "member/feed/post-1/media.jpg";

  const fail = (stage) => {
    if (failureStage === stage) {
      throw new Error(`${stage} failed`);
    }
  };

  return {
    attachments,
    calls,
    deletedIds,
    dependencies: {
      async attachMedia(id) {
        calls.push("attach");
        fail("attach");
        attachments.add(id);
      },
      async confirmPublished(id) {
        calls.push("confirm-published");
        if (confirmationFailure) {
          throw new Error("publication confirmation failed");
        }
        return posts.get(id)?.published === true;
      },
      async createDraft(id) {
        calls.push("draft");
        if (!failureAfterCommit) {
          fail("draft");
        }
        posts.set(id, { published: false });
        fail("draft");
      },
      async deleteDraft(id) {
        calls.push("cleanup-draft");
        deletedIds.push(id);
        if (cleanupFailures.has("draft")) {
          throw new Error("draft cleanup failed");
        }
        const post = posts.get(id);
        if (publishDuringDelete && post) {
          post.published = true;
        }
        if (!post || post.published) {
          return false;
        }
        posts.delete(id);
        attachments.delete(id);
        return true;
      },
      postId,
      async publishDraft(id) {
        calls.push("publish");
        if (!failureAfterCommit) {
          fail("publish");
        }
        const post = posts.get(id);
        assert.ok(post);
        assert.ok(attachments.has(id));
        post.published = true;
        fail("publish");
      },
      async removeMedia(id) {
        calls.push("cleanup-media");
        removedIds.push(id);
        if (cleanupFailures.has("media")) {
          throw new Error("media cleanup failed");
        }
        storage.delete(storagePath);
      },
      async uploadMedia() {
        calls.push("upload");
        storage.add(storagePath);
        fail("upload");
      },
    },
    posts,
    removedIds,
    storage,
  };
}

function assertNoPublishedPosts(harness) {
  assert.equal(
    [...harness.posts.values()].some((post) => post.published),
    false,
  );
}

function assertPublishedPostsKeepMedia(harness) {
  for (const [postId, post] of harness.posts) {
    if (!post.published) continue;
    assert.ok(harness.attachments.has(postId));
    assert.equal(harness.storage.size, 1);
  }
}

{
  const harness = createHarness();
  const result = await publishFeedPostWithRequiredMedia(harness.dependencies);

  assert.deepEqual(result, { ok: true, postId: "post-1" });
  assert.deepEqual(harness.calls, ["draft", "upload", "attach", "publish"]);
  assert.equal(harness.posts.get("post-1")?.published, true);
  assert.equal(harness.storage.size, 1);
  assert.equal(harness.attachments.has("post-1"), true);
}

for (const failureStage of ["upload", "attach"]) {
  const harness = createHarness({ failureStage });
  const result = await publishFeedPostWithRequiredMedia(harness.dependencies);

  assert.equal(result.ok, false);
  assert.equal(result.stage, failureStage);
  assert.equal(result.statusUncertain, false);
  assert.deepEqual(result.cleanupErrors, []);
  assert.equal(harness.posts.size, 0);
  assert.equal(harness.storage.size, 0);
  assert.equal(harness.attachments.size, 0);
  assert.deepEqual(harness.deletedIds, ["post-1"]);
  assert.deepEqual(harness.removedIds, ["post-1"]);
  assertNoPublishedPosts(harness);
}

{
  const harness = createHarness({ failureStage: "publish" });
  const result = await publishFeedPostWithRequiredMedia(harness.dependencies);

  assert.equal(result.ok, false);
  assert.equal(result.stage, "publish");
  assert.equal(result.statusUncertain, false);
  assert.deepEqual(result.cleanupErrors, []);
  assert.deepEqual(harness.calls, [
    "draft",
    "upload",
    "attach",
    "publish",
    "confirm-published",
    "cleanup-draft",
    "cleanup-media",
  ]);
  assert.equal(harness.posts.size, 0);
  assert.equal(harness.storage.size, 0);
}

{
  const harness = createHarness({
    failureAfterCommit: true,
    failureStage: "publish",
  });
  const result = await publishFeedPostWithRequiredMedia(harness.dependencies);

  assert.deepEqual(result, { ok: true, postId: "post-1" });
  assert.deepEqual(harness.deletedIds, []);
  assert.deepEqual(harness.removedIds, []);
  assertPublishedPostsKeepMedia(harness);
}

{
  const harness = createHarness({
    confirmationFailure: true,
    failureAfterCommit: true,
    failureStage: "publish",
  });
  const result = await publishFeedPostWithRequiredMedia(harness.dependencies);

  assert.equal(result.ok, false);
  assert.equal(result.stage, "publish");
  assert.equal(result.statusUncertain, true);
  assert.ok(result.confirmationError instanceof Error);
  assert.deepEqual(result.cleanupErrors, []);
  assert.deepEqual(harness.deletedIds, []);
  assert.deepEqual(harness.removedIds, []);
  assertPublishedPostsKeepMedia(harness);
}

{
  const harness = createHarness({
    failureAfterCommit: true,
    failureStage: "draft",
  });
  const result = await publishFeedPostWithRequiredMedia(harness.dependencies);

  assert.equal(result.ok, false);
  assert.equal(result.stage, "draft");
  assert.equal(result.statusUncertain, false);
  assert.deepEqual(result.cleanupErrors, []);
  assert.equal(harness.posts.size, 0);
  assert.deepEqual(harness.deletedIds, ["post-1"]);
  assert.deepEqual(harness.removedIds, []);
}

{
  const harness = createHarness({
    cleanupFailures: new Set(["draft"]),
    failureStage: "attach",
  });
  const result = await publishFeedPostWithRequiredMedia(harness.dependencies);

  assert.equal(result.ok, false);
  assert.equal(result.stage, "attach");
  assert.deepEqual(
    result.cleanupErrors.map(({ step }) => step),
    ["draft"],
  );
  assert.deepEqual(harness.deletedIds, ["post-1"]);
  assert.deepEqual(harness.removedIds, []);
  assert.equal(harness.storage.size, 1);
  assertNoPublishedPosts(harness);
}

{
  const harness = createHarness({
    cleanupFailures: new Set(["media"]),
    failureStage: "attach",
  });
  const result = await publishFeedPostWithRequiredMedia(harness.dependencies);

  assert.equal(result.ok, false);
  assert.equal(result.stage, "attach");
  assert.deepEqual(
    result.cleanupErrors.map(({ step }) => step),
    ["media"],
  );
  assert.equal(harness.posts.size, 0);
  assert.equal(harness.storage.size, 1);
  assert.deepEqual(harness.deletedIds, ["post-1"]);
  assert.deepEqual(harness.removedIds, ["post-1"]);
}

{
  const harness = createHarness({
    failureStage: "publish",
    publishDuringDelete: true,
  });
  const result = await publishFeedPostWithRequiredMedia(harness.dependencies);

  assert.equal(result.ok, false);
  assert.equal(result.stage, "publish");
  assert.equal(result.statusUncertain, true);
  assert.deepEqual(harness.removedIds, []);
  assertPublishedPostsKeepMedia(harness);
}

{
  const harness = createHarness({ failureStage: "draft" });
  const result = await publishFeedPostWithRequiredMedia(harness.dependencies);

  assert.equal(result.ok, false);
  assert.equal(result.stage, "draft");
  assert.deepEqual(result.cleanupErrors, []);
  assert.deepEqual(harness.calls, ["draft", "cleanup-draft"]);
  assert.equal(harness.posts.size, 0);
  assert.equal(harness.storage.size, 0);
}

{
  const result = await settlePublishedFeedPostTags(async () => "tag failure");
  assert.equal(result.ok, false);
  assert.equal(result.error, "tag failure");
}

{
  const thrown = new Error("tag sync threw");
  const result = await settlePublishedFeedPostTags(async () => {
    throw thrown;
  });
  assert.equal(result.ok, false);
  assert.equal(result.error, thrown);
}

console.log("PASS required-media 4U publication stays fail closed");
