import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

let requestBodyModule = {};
try {
  requestBodyModule = await import(
    "../src/lib/http/bounded-request-body.mjs"
  );
} catch {
  // The first TDD run intentionally reaches the assertion below before the
  // production helper exists.
}

const {
  readBoundedFormData,
  readBoundedRequestBytes,
  requestContentLengthAllowed,
} = requestBodyModule;

function streamedRequest(chunks, headers = {}) {
  let cancelCalls = 0;
  let pullIndex = 0;
  const body = new ReadableStream({
    cancel() {
      cancelCalls += 1;
    },
    pull(controller) {
      const chunk = chunks[pullIndex];
      pullIndex += 1;
      if (chunk instanceof Error) {
        controller.error(chunk);
        return;
      }
      if (chunk === undefined) {
        controller.close();
        return;
      }
      controller.enqueue(
        typeof chunk === "string" ? new TextEncoder().encode(chunk) : chunk,
      );
    },
  });

  return {
    get cancelCalls() {
      return cancelCalls;
    },
    request: new Request("https://example.test/payment", {
      body,
      duplex: "half",
      headers,
      method: "POST",
    }),
  };
}

const exactWebhookBytes = new Uint8Array([
  0x7b,
  0x22,
  0x69,
  0x64,
  0x22,
  0x3a,
  0x22,
  0xc3,
  0x28,
  0x22,
  0x7d,
]);
const exactWebhook = streamedRequest([
  exactWebhookBytes.slice(0, 4),
  exactWebhookBytes.slice(4),
]);
const exactResult = await readBoundedRequestBytes?.(
  exactWebhook.request,
  exactWebhookBytes.byteLength,
);
assert.equal(exactResult?.ok, true);
assert.deepEqual(exactResult?.bytes, exactWebhookBytes);
console.log("PASS webhook reads exact raw bytes without requiring Content-Length");

const declaredBody = "{\"id\":\"evt_valid\"}";
const declaredResult = await readBoundedRequestBytes(
  new Request("https://example.test/payment", {
    body: declaredBody,
    headers: { "content-length": String(Buffer.byteLength(declaredBody)) },
    method: "POST",
  }),
  64,
);
assert.equal(declaredResult.ok, true);
assert.equal(new TextDecoder().decode(declaredResult.bytes), declaredBody);
assert.equal(
  requestContentLengthAllowed(
    new Request("https://example.test/payment", { method: "POST" }),
    64,
  ),
  true,
);
console.log("PASS webhook accepts valid declared and undeclared body lengths");

const declaredOversize = streamedRequest(["small"], {
  "content-length": "65",
});
assert.deepEqual(
  await readBoundedRequestBytes(declaredOversize.request, 64),
  { ok: false, status: 413 },
);
assert.equal(declaredOversize.request.bodyUsed, false);

const streamedOversize = streamedRequest(["x".repeat(64), "y"]);
assert.deepEqual(
  await readBoundedRequestBytes(streamedOversize.request, 64),
  { ok: false, status: 413 },
);
assert.equal(streamedOversize.cancelCalls, 1);
console.log("PASS webhook rejects declared and streamed oversized bodies");

for (const contentLength of ["-1", "1.5", " 12", "12 ", "9e9", "NaN"]) {
  const malformedLength = streamedRequest(["payload"], {
    "content-length": contentLength,
  });
  assert.deepEqual(
    await readBoundedRequestBytes(malformedLength.request, 64),
    { ok: false, status: 400 },
  );
}
const mismatchedLength = streamedRequest(["payload"], {
  "content-length": "2",
});
assert.deepEqual(
  await readBoundedRequestBytes(mismatchedLength.request, 64),
  { ok: false, status: 400 },
);
const encodedBody = streamedRequest(["payload"], {
  "content-encoding": "gzip",
});
assert.deepEqual(
  await readBoundedRequestBytes(encodedBody.request, 64),
  { ok: false, status: 415 },
);
const failedStream = streamedRequest([new Error("malformed stream")]);
assert.deepEqual(
  await readBoundedRequestBytes(failedStream.request, 64),
  { ok: false, status: 400 },
);
console.log("PASS malformed webhook body metadata and streams fail closed");

const bookingBody =
  "booking_id=11111111-1111-4111-8111-111111111111&return_to=%2Faccount";
const bookingRequest = streamedRequest([bookingBody.slice(0, 20), bookingBody.slice(20)], {
  "content-type": "application/x-www-form-urlencoded",
});
const bookingResult = await readBoundedFormData(
  bookingRequest.request,
  4096,
);
assert.equal(bookingResult.ok, true);
assert.equal(
  bookingResult.formData.get("booking_id"),
  "11111111-1111-4111-8111-111111111111",
);
assert.equal(bookingResult.formData.get("return_to"), "/account");
console.log("PASS booking checkout accepts a valid form without Content-Length");

const oversizedBooking = streamedRequest(
  ["booking_id=", "x".repeat(4090)],
  { "content-type": "application/x-www-form-urlencoded" },
);
assert.deepEqual(await readBoundedFormData(oversizedBooking.request, 4096), {
  ok: false,
  status: 413,
});

const malformedMultipart = streamedRequest(["not-a-valid-multipart-body"], {
  "content-type": "multipart/form-data; boundary=missing-boundary",
});
assert.deepEqual(await readBoundedFormData(malformedMultipart.request, 4096), {
  ok: false,
  status: 400,
});
console.log("PASS booking checkout rejects oversized and malformed streamed forms");

console.log(
  "USER INPUT SECURITY REVIEW: PASS payment request bodies are byte-bounded and fail closed",
);

const webhookRoute = await readFile(
  "src/app/api/stripe/webhook/route.ts",
  "utf8",
);
assert.match(
  webhookRoute,
  /readBoundedRequestBytes\(\s*request,\s*maxStripeWebhookBodyBytes,?\s*\)/,
);
assert.match(
  webhookRoute,
  /constructEventAsync\(\s*Buffer\.from\(body\.bytes\),/,
);
console.log("PASS webhook passes exact bounded bytes through Stripe's supported Buffer type");
