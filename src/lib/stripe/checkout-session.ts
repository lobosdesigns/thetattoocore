type Fetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export type StripeCheckoutSession = {
  id: string;
  url: string | null;
};

export class StripeCheckoutRequestError extends Error {
  readonly outcomeUnknown: boolean;

  constructor(message: string, outcomeUnknown: boolean) {
    super(message);
    this.name = "StripeCheckoutRequestError";
    this.outcomeUnknown = outcomeUnknown;
  }
}

function isIndeterminateStripeResponse(response: Response) {
  return response.status === 409 || response.status >= 500;
}

export async function createStripeCheckoutSession(_options: {
  body: URLSearchParams;
  fetcher?: Fetcher;
  idempotencyKey: string;
  secretKey: string;
}): Promise<StripeCheckoutSession> {
  const fetcher = _options.fetcher ?? fetch;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    let response: Response;

    try {
      response = await fetcher(
        "https://api.stripe.com/v1/checkout/sessions",
        {
          body: _options.body,
          headers: {
            Authorization: `Bearer ${_options.secretKey}`,
            "Content-Type": "application/x-www-form-urlencoded",
            "Idempotency-Key": _options.idempotencyKey,
          },
          method: "POST",
        },
      );
    } catch {
      if (attempt === 0) continue;

      throw new StripeCheckoutRequestError(
        "Checkout status could not be confirmed.",
        true,
      );
    }

    if (!response.ok) {
      const outcomeUnknown = isIndeterminateStripeResponse(response);
      const retryHeader = response.headers.get("stripe-should-retry");
      const shouldRetry =
        retryHeader === "true" || (retryHeader !== "false" && outcomeUnknown);

      if (attempt === 0 && shouldRetry) continue;

      throw new StripeCheckoutRequestError(
        outcomeUnknown
          ? "Checkout status could not be confirmed."
          : "Checkout could not open.",
        outcomeUnknown,
      );
    }

    let session: unknown;

    try {
      session = await response.json();
    } catch {
      throw new StripeCheckoutRequestError(
        "Checkout status could not be confirmed.",
        true,
      );
    }

    if (
      !session ||
      typeof session !== "object" ||
      !("id" in session) ||
      typeof session.id !== "string"
    ) {
      throw new StripeCheckoutRequestError(
        "Checkout status could not be confirmed.",
        true,
      );
    }

    return {
      id: session.id,
      url:
        "url" in session && typeof session.url === "string"
          ? session.url
          : null,
    };
  }

  throw new StripeCheckoutRequestError(
    "Checkout status could not be confirmed.",
    true,
  );
}

export async function expireStripeCheckoutSession(options: {
  fetcher?: Fetcher;
  idempotencyKey: string;
  secretKey: string;
  sessionId: string;
}) {
  const fetcher = options.fetcher ?? fetch;

  try {
    const response = await fetcher(
      `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(options.sessionId)}/expire`,
      {
        headers: {
          Authorization: `Bearer ${options.secretKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
          "Idempotency-Key": options.idempotencyKey,
        },
        method: "POST",
      },
    );

    return response.ok;
  } catch {
    return false;
  }
}

export async function expireCheckoutSessionBeforeRollback(options: {
  fetcher?: Fetcher;
  idempotencyKey: string;
  rollback: () => Promise<boolean>;
  secretKey: string;
  sessionId: string;
}) {
  const expired = await expireStripeCheckoutSession(options);

  if (!expired) return false;

  try {
    return await options.rollback();
  } catch {
    return false;
  }
}
