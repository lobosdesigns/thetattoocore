/**
 * @typedef {{ bytes: Uint8Array, ok: true } | { ok: false, status: 400 | 413 | 415 }} BoundedBodyResult
 * @typedef {{ formData: FormData, ok: true } | { ok: false, status: 400 | 413 | 415 }} BoundedFormResult
 */

/** @param {number} maxBytes */
function validLimit(maxBytes) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) {
    throw new RangeError("Request body limit must be a non-negative safe integer.");
  }
}

/**
 * @param {Request} request
 * @param {number} maxBytes
 * @returns {{ ok: true, value: number | null } | { ok: false, status: 400 | 413 }}
 */
function declaredContentLength(request, maxBytes) {
  const value = request.headers.get("content-length");

  if (value === null) return { ok: true, value: null };
  if (!/^\d+$/.test(value)) return { ok: false, status: 400 };

  const length = Number(value);
  if (!Number.isSafeInteger(length)) return { ok: false, status: 400 };
  if (length > maxBytes) return { ok: false, status: 413 };

  return { ok: true, value: length };
}

/**
 * @param {Request} request
 * @param {number} maxBytes
 */
export function requestContentLengthAllowed(request, maxBytes) {
  validLimit(maxBytes);

  return declaredContentLength(request, maxBytes).ok;
}

/**
 * @param {Request} request
 * @param {number} maxBytes
 * @returns {Promise<BoundedBodyResult>}
 */
export async function readBoundedRequestBytes(request, maxBytes) {
  validLimit(maxBytes);

  const contentEncoding = request.headers.get("content-encoding");
  if (
    contentEncoding !== null &&
    contentEncoding.trim().toLowerCase() !== "identity"
  ) {
    return { ok: false, status: 415 };
  }

  const declaredLength = declaredContentLength(request, maxBytes);
  if (!declaredLength.ok) return declaredLength;
  if (request.bodyUsed) return { ok: false, status: 400 };

  if (!request.body) {
    return declaredLength.value === null || declaredLength.value === 0
      ? { bytes: new Uint8Array(0), ok: true }
      : { ok: false, status: 400 };
  }

  let reader;
  try {
    reader = request.body.getReader();
  } catch {
    return { ok: false, status: 400 };
  }

  const chunks = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value?.byteLength) continue;

      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return { ok: false, status: 413 };
      }
      chunks.push(value);
    }
  } catch {
    await reader.cancel().catch(() => undefined);
    return { ok: false, status: 400 };
  } finally {
    reader.releaseLock();
  }

  if (
    declaredLength.value !== null &&
    declaredLength.value !== totalBytes
  ) {
    return { ok: false, status: 400 };
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return { bytes, ok: true };
}

/**
 * @param {Request} request
 * @param {number} maxBytes
 * @returns {Promise<BoundedFormResult>}
 */
export async function readBoundedFormData(request, maxBytes) {
  const body = await readBoundedRequestBytes(request, maxBytes);
  if (!body.ok) return body;

  const contentType = request.headers.get("content-type");
  if (!contentType) return { ok: false, status: 415 };

  try {
    const parserRequest = new Request(request.url, {
      body: body.bytes,
      headers: { "content-type": contentType },
      method: "POST",
    });

    return { formData: await parserRequest.formData(), ok: true };
  } catch {
    return { ok: false, status: 400 };
  }
}
