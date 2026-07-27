import { NextResponse } from "next/server";

const noStoreValue = "private, no-store, max-age=0, must-revalidate";
const rateLimitStateKey = Symbol.for("ttc.localRateLimitState");
const maxBuckets = 10_000;

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

type RateLimitStore = Map<string, RateLimitBucket>;

type RateLimitOptions = {
  identity?: string | null;
  limit: number;
  request: Request;
  scope: string;
  windowMs: number;
};

type RateLimitResult =
  | {
      limited: false;
      remaining: number;
      resetAt: number;
    }
  | {
      limited: true;
      retryAfterSeconds: number;
      resetAt: number;
    };

function localRateLimitStore() {
  const globalWithStore = globalThis as typeof globalThis & {
    [rateLimitStateKey]?: RateLimitStore;
  };

  globalWithStore[rateLimitStateKey] ??= new Map();

  return globalWithStore[rateLimitStateKey];
}

function pruneExpiredBuckets(store: RateLimitStore, now: number) {
  if (store.size < maxBuckets) return;

  for (const [key, bucket] of store) {
    if (bucket.resetAt <= now) {
      store.delete(key);
    }
  }
}

function trustedPlatformIp(request: Request) {
  const value = request.headers.get("cf-connecting-ip")?.trim() ?? "";

  if (!value || value.length > 80 || value.includes(",")) return null;
  if (!/^[0-9a-f:.]+$/i.test(value)) return null;

  return value.toLowerCase();
}

export function noStoreHeaders(headers?: HeadersInit) {
  const responseHeaders = new Headers(headers);

  responseHeaders.set("Cache-Control", noStoreValue);

  return responseHeaders;
}

export function noStoreJson(body: unknown, init: ResponseInit = {}) {
  return NextResponse.json(body, {
    ...init,
    headers: noStoreHeaders(init.headers),
  });
}

export function noStoreRedirect(url: string | URL, init: ResponseInit = {}) {
  return NextResponse.redirect(url, {
    ...init,
    headers: noStoreHeaders(init.headers),
  });
}

export function rateLimitedJson(retryAfterSeconds: number) {
  return noStoreJson(
    { error: "Too many requests. Please try again later." },
    {
      headers: {
        "Retry-After": String(retryAfterSeconds),
      },
      status: 429,
    },
  );
}

export function checkRateLimit({
  identity,
  limit,
  request,
  scope,
  windowMs,
}: RateLimitOptions): RateLimitResult {
  const keySubject = identity
    ? `user:${identity}`
    : `ip:${trustedPlatformIp(request) ?? "anonymous"}`;
  const key = `${scope}:${keySubject}`;
  const now = Date.now();
  const store = localRateLimitStore();

  pruneExpiredBuckets(store, now);

  const current = store.get(key);

  if (!current || current.resetAt <= now) {
    const resetAt = now + windowMs;

    store.set(key, { count: 1, resetAt });

    return {
      limited: false,
      remaining: Math.max(0, limit - 1),
      resetAt,
    };
  }

  if (current.count >= limit) {
    return {
      limited: true,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
      resetAt: current.resetAt,
    };
  }

  current.count += 1;

  return {
    limited: false,
    remaining: Math.max(0, limit - current.count),
    resetAt: current.resetAt,
  };
}
