import assert from "node:assert/strict";
import { publishFeedPostWithRequiredMedia } from "../src/lib/feed-post-publish.ts";

function createHarness({
  cleanupFailures = new Set(),
  failureStage = null,
} = {}) {
  const calls = [];
  const posts = new Map();
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
    dependencies: {
      async attachMedia(id) {
        calls.push("attach");
        fail("attach");
        attachments.add(id);
      },
      async createDraft() {
        calls.push("draft");
        fail("draft");
        posts.set(postId, { published: false });
        return postId;
      },
      async deleteDraft(id) {
        calls.push("cleanup-draft");
        if (cleanupFailures.has("draft")) {
          throw new Error("draft cleanup failed");
        }
        posts.delete(id);
        attachments.delete(id);
      },
      async publishDraft(id) {
        calls.push("publish");
        const post = posts.get(id);
        assert.ok(post);
        assert.ok(attachments.has(id));
        post.published = true;
        fail("publish");
      },
      async removeMedia() {
        calls.push("cleanup-media");
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
    storage,
  };
}

function assertNoPublishedPosts(harness) {
  assert.equal(
    [...harness.posts.values()].some((post) => post.published),
    false,
  );
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

for (const failureStage of ["upload", "attach", "publish"]) {
  const harness = createHarness({ failureStage });
  const result = await publishFeedPostWithRequiredMedia(harness.dependencies);

  assert.equal(result.ok, false);
  assert.equal(result.stage, failureStage);
  assert.deepEqual(result.cleanupErrors, []);
  assert.equal(harness.posts.size, 0);
  assert.equal(harness.storage.size, 0);
  assert.equal(harness.attachments.size, 0);
  assertNoPublishedPosts(harness);
}

{
  const harness = createHarness({
    cleanupFailures: new Set(["media", "draft"]),
    failureStage: "attach",
  });
  const result = await publishFeedPostWithRequiredMedia(harness.dependencies);

  assert.equal(result.ok, false);
  assert.equal(result.stage, "attach");
  assert.deepEqual(
    result.cleanupErrors.map(({ step }) => step),
    ["media", "draft"],
  );
  assertNoPublishedPosts(harness);
}

{
  const harness = createHarness({ failureStage: "draft" });
  const result = await publishFeedPostWithRequiredMedia(harness.dependencies);

  assert.equal(result.ok, false);
  assert.equal(result.stage, "draft");
  assert.deepEqual(result.cleanupErrors, []);
  assert.deepEqual(harness.calls, ["draft"]);
  assert.equal(harness.posts.size, 0);
  assert.equal(harness.storage.size, 0);
}

console.log("PASS required-media 4U publication stays fail closed");
