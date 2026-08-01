type Fetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export const STRIPE_API_VERSION = "2026-06-24.dahlia";

export type StripeCheckoutSession = {
  id: string;
  url: string | null;
};

type HeldBookingCheckout = {
  artistId: string;
  clientId: string;
  currency: string;
  id: string;
  totalCents: number;
};

type ReconciledBookingCheckoutSession = {
  amountTotal: number | null;
  artistId: string | undefined;
  bookingId: string | undefined;
  clientId: string | undefined;
  clientReferenceId: string | null;
  currency: string | null;
  id: string;
  livemode: boolean;
  mode: string;
  paymentKind: string | undefined;
  paymentStatus: string;
  status: string | null;
};

export type BookingCheckoutReconciliationDecision =
  | { action: "expire"; reason: "open_unpaid" }
  | {
      action: "hold";
      reason: "identity_mismatch" | "payment_activity" | "unresolved_status";
    }
  | { action: "release"; reason: "expired_unpaid" };

export type BookingCheckoutReleaseAttemptDecision =
  | { action: "accept"; reason: "already_released" | "update_matched" | "update_outcome_verified" }
  | { action: "reject"; reason: "state_changed" | "verification_failed" };

export type BookingPaidTransitionDecision =
  | { action: "accept"; reason: "already_paid" | "transitioned" }
  | {
      action: "retry";
      reason: "lookup_failed" | "missing_payment_intent" | "state_mismatch";
    };

export function bookingCheckoutReconciliationDecision(options: {
  booking: HeldBookingCheckout;
  expectedLivemode: boolean;
  session: ReconciledBookingCheckoutSession;
  sessionId: string;
}): BookingCheckoutReconciliationDecision {
  const { booking, expectedLivemode, session, sessionId } = options;

  if (
    session.id !== sessionId ||
    session.livemode !== expectedLivemode ||
    session.mode !== "payment" ||
    session.paymentKind !== "booking_deposit" ||
    session.bookingId !== booking.id ||
    session.artistId !== booking.artistId ||
    session.clientId !== booking.clientId ||
    session.clientReferenceId !== booking.id ||
    session.amountTotal !== booking.totalCents ||
    session.currency?.toLowerCase() !== booking.currency.toLowerCase()
  ) {
    return { action: "hold", reason: "identity_mismatch" };
  }

  if (session.paymentStatus !== "unpaid") {
    return { action: "hold", reason: "payment_activity" };
  }

  if (session.status === "open") {
    return { action: "expire", reason: "open_unpaid" };
  }

  if (session.status === "expired") {
    return { action: "release", reason: "expired_unpaid" };
  }

  return { action: "hold", reason: "unresolved_status" };
}

export function bookingCheckoutReleaseAttemptDecision(options: {
  bookingId: string;
  releasedBookingId: string | null;
  updateError: boolean;
  verifiedReleasedBookingId: string | null;
  verificationError: boolean;
}): BookingCheckoutReleaseAttemptDecision {
  if (options.releasedBookingId === options.bookingId) {
    return { action: "accept", reason: "update_matched" };
  }

  if (options.verificationError) {
    return { action: "reject", reason: "verification_failed" };
  }

  if (options.verifiedReleasedBookingId !== options.bookingId) {
    return { action: "reject", reason: "state_changed" };
  }

  return {
    action: "accept",
    reason: options.updateError
      ? "update_outcome_verified"
      : "already_released",
  };
}

export function bookingPaidTransitionDecision(options: {
  bookingId: string;
  existingPaidBookingId: string | null;
  lookupError: boolean;
  paymentIntentId: string | null;
  transitionedCount: number;
}): BookingPaidTransitionDecision {
  if (options.transitionedCount > 0) {
    return { action: "accept", reason: "transitioned" };
  }

  if (!options.paymentIntentId) {
    return { action: "retry", reason: "missing_payment_intent" };
  }

  if (options.lookupError) {
    return { action: "retry", reason: "lookup_failed" };
  }

  if (options.existingPaidBookingId !== options.bookingId) {
    return { action: "retry", reason: "state_mismatch" };
  }

  return { action: "accept", reason: "already_paid" };
}

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
  checkoutCreationEnabled: boolean;
  fetcher?: Fetcher;
  idempotencyKey: string;
  secretKey: string;
}): Promise<StripeCheckoutSession> {
  if (_options.checkoutCreationEnabled !== true) {
    throw new StripeCheckoutRequestError("Checkout could not open.", false);
  }

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
            "Stripe-Version": STRIPE_API_VERSION,
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
          "Stripe-Version": STRIPE_API_VERSION,
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
