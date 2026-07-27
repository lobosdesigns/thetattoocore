import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { checkRateLimit } from "@/lib/http/reliability";
import { platformFeeDescription } from "@/lib/payments/fees";
import { siteName, siteUrl } from "@/lib/site";
import {
  createStripeCheckoutSession,
  expireCheckoutSessionBeforeRollback,
  StripeCheckoutRequestError,
  type StripeCheckoutSession,
} from "@/lib/stripe/checkout-session";
import { stripeCheckoutPreflight } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type Claims = {
  sub: string;
};

type BookingRequest = {
  artist_id: string;
  client_id: string;
  currency: string;
  deposit_amount_cents: number;
  id: string;
  payment_status: string;
  platform_fee_cents: number;
  status: string;
  stripe_checkout_session_id: string | null;
  title: string;
  total_cents: number;
};

function safeInternalReturnPath(value: FormDataEntryValue | null) {
  const text = String(value ?? "")
    .trim()
    .slice(0, 240);

  if (!text || !text.startsWith("/") || text.startsWith("//") || text.includes("\\")) {
    return null;
  }

  return text;
}

function cleanUuid(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim().slice(0, 80);

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)
    ? text
    : "";
}

function hasSupportedFormContentType(request: Request) {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";

  return (
    contentType.startsWith("application/x-www-form-urlencoded") ||
    contentType.startsWith("multipart/form-data")
  );
}

function hasSafeFormSize(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? "0");

  return Number.isFinite(contentLength) && contentLength <= 4096;
}

function pathWithMessage(returnTo: string | null, message: string) {
  if (!returnTo) {
    return `/account?message=${encodeURIComponent(message)}#booking-settings`;
  }

  const separator = returnTo.includes("?") ? "&" : "?";

  return `${returnTo}${separator}message=${encodeURIComponent(message)}`;
}

function redirectWithMessage(message: string, returnTo: string | null = null) {
  return NextResponse.redirect(
    `${siteUrl}${pathWithMessage(returnTo, message)}`,
    { status: 303 },
  );
}

async function createBookingCheckoutSession(
  booking: BookingRequest,
  idempotencyKey: string,
  returnTo: string | null,
  secretKey: string,
) {
  const successUrl = `${siteUrl}${pathWithMessage(
    returnTo,
    "Booking deposit received. Deposit status will update soon.",
  )}`;
  const cancelUrl = `${siteUrl}${pathWithMessage(
    returnTo,
    "Booking deposit checkout canceled.",
  )}`;
  const body = new URLSearchParams({
    "allow_promotion_codes": "false",
    "billing_address_collection": "auto",
    "client_reference_id": booking.id,
    "line_items[0][price_data][currency]": booking.currency.toLowerCase(),
    "line_items[0][price_data][product_data][metadata][booking_request_id]":
      booking.id,
    "line_items[0][price_data][product_data][name]": `${siteName} booking deposit`,
    "line_items[0][price_data][product_data][description]":
      booking.title.slice(0, 500),
    "line_items[0][price_data][unit_amount]": String(
      booking.deposit_amount_cents,
    ),
    "line_items[0][quantity]": "1",
    "metadata[artist_id]": booking.artist_id,
    "metadata[booking_deposit_cents]": String(booking.deposit_amount_cents),
    "metadata[booking_request_id]": booking.id,
    "metadata[client_id]": booking.client_id,
    "metadata[payment_kind]": "booking_deposit",
    "metadata[platform_fee_cents]": String(booking.platform_fee_cents),
    "mode": "payment",
    "payment_intent_data[metadata][artist_id]": booking.artist_id,
    "payment_intent_data[metadata][booking_deposit_cents]": String(
      booking.deposit_amount_cents,
    ),
    "payment_intent_data[metadata][booking_request_id]": booking.id,
    "payment_intent_data[metadata][client_id]": booking.client_id,
    "payment_intent_data[metadata][payment_kind]": "booking_deposit",
    "payment_intent_data[metadata][platform_fee_cents]": String(
      booking.platform_fee_cents,
    ),
    "submit_type": "pay",
    "success_url": successUrl,
    "cancel_url": cancelUrl,
  });

  if (booking.platform_fee_cents > 0) {
    body.set("line_items[1][price_data][currency]", booking.currency.toLowerCase());
    body.set("line_items[1][price_data][product_data][name]", `${siteName} platform fee`);
    body.set(
      "line_items[1][price_data][product_data][description]",
      platformFeeDescription("booking"),
    );
    body.set(
      "line_items[1][price_data][unit_amount]",
      String(booking.platform_fee_cents),
    );
    body.set("line_items[1][quantity]", "1");
  }

  return createStripeCheckoutSession({
    body,
    idempotencyKey,
    secretKey,
  });
}

export async function POST(request: Request) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const canProcessStripeWebhooks = Boolean(
    process.env.STRIPE_WEBHOOK_SECRET && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  if (!secretKey) {
    return redirectWithMessage(
      "Booking checkout is temporarily unavailable. Please try again later.",
    );
  }

  if (!canProcessStripeWebhooks) {
    return redirectWithMessage(
      "Booking checkout is temporarily unavailable. Please try again later.",
    );
  }

  if (!hasSupportedFormContentType(request) || !hasSafeFormSize(request)) {
    return redirectWithMessage("Booking checkout could not open. Please try again.");
  }

  const formData = await request.formData();
  const bookingId = cleanUuid(formData.get("booking_id"));
  const returnTo = safeInternalReturnPath(formData.get("return_to"));

  if (!bookingId) {
    return redirectWithMessage("Choose a booking request first.", returnTo);
  }

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims as Claims | undefined;

  if (!claims?.sub) {
    return NextResponse.redirect(
      `${siteUrl}/login?message=${encodeURIComponent("Sign in to pay a booking deposit.")}&return_to=${encodeURIComponent(returnTo ?? "/account#booking-settings")}`,
      { status: 303 },
    );
  }

  const limit = checkRateLimit({
    identity: claims.sub,
    limit: 8,
    request,
    scope: "booking-checkout",
    windowMs: 5 * 60_000,
  });

  if (limit.limited) {
    return redirectWithMessage(
      "Too many checkout attempts. Please try again later.",
      returnTo,
    );
  }

  const checkoutPreflight = stripeCheckoutPreflight();
  if (!checkoutPreflight.ready) {
    console.error("Booking checkout mode preflight failed.", checkoutPreflight);
    return redirectWithMessage(
      "Booking checkout is temporarily unavailable. Please try again later.",
      returnTo,
    );
  }

  const { data: booking, error } = await supabase
    .from("booking_requests")
    .select(
      "id, artist_id, client_id, title, status, payment_status, deposit_amount_cents, platform_fee_cents, total_cents, currency, stripe_checkout_session_id",
    )
    .eq("id", bookingId)
    .eq("client_id", claims.sub)
    .maybeSingle<BookingRequest>();

  if (error || !booking) {
    return redirectWithMessage("That booking request was not found.", returnTo);
  }

  if (!["accepted", "rescheduled"].includes(booking.status)) {
    return redirectWithMessage(
      "The artist or studio must accept before deposit checkout opens.",
      returnTo,
    );
  }

  if (booking.deposit_amount_cents <= 0 || booking.total_cents <= 0) {
    return redirectWithMessage("This booking does not have a deposit to pay yet.", returnTo);
  }

  if (booking.payment_status === "paid") {
    return redirectWithMessage("That booking deposit is already paid.", returnTo);
  }

  if (booking.payment_status === "checkout_started") {
    return redirectWithMessage(
      "Booking deposit checkout has already started. Finish that checkout or wait for it to expire before trying again.",
      returnTo,
    );
  }

  if (!["not_ready", "payment_failed"].includes(booking.payment_status)) {
    return redirectWithMessage("That booking deposit is not ready for checkout.", returnTo);
  }

  const adminSupabase = createAdminClient();
  if (!adminSupabase) {
    return redirectWithMessage(
      "Booking checkout is temporarily unavailable. Please try again later.",
      returnTo,
    );
  }

  const { data: reservedBooking, error: reserveError } = await adminSupabase
    .rpc("reserve_booking_deposit_checkout", {
      p_booking_id: booking.id,
      p_client_id: claims.sub,
    })
    .maybeSingle<BookingRequest>();

  if (reserveError) {
    console.error("Booking deposit reservation failed.", reserveError);
    return redirectWithMessage(
      "The booking deposit could not be reserved before checkout. Please try again.",
      returnTo,
    );
  }

  if (!reservedBooking) {
    return redirectWithMessage(
      "This booking deposit is no longer available for checkout. Refresh your bookings and try again.",
      returnTo,
    );
  }

  const rollBackReservation = async () => {
    const { data: releasedBooking, error: releaseError } = await adminSupabase
      .from("booking_requests")
      .update({
        payment_status: booking.payment_status,
        status: booking.status,
        stripe_checkout_session_id: booking.stripe_checkout_session_id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", booking.id)
      .eq("client_id", claims.sub)
      .eq("payment_status", "checkout_started")
      .eq("status", "deposit_pending")
      .is("stripe_checkout_session_id", null)
      .select("id")
      .maybeSingle<{ id: string }>();

    if (releaseError) {
      console.error(
        "Booking checkout reservation release failed.",
        releaseError,
      );
      return false;
    }

    return Boolean(releasedBooking);
  };

  const checkoutAttemptId = crypto.randomUUID();
  let session: StripeCheckoutSession;

  try {
    session = await createBookingCheckoutSession(
      reservedBooking,
      `ttc_booking_${booking.id}_${checkoutAttemptId}`,
      returnTo,
      secretKey,
    );
  } catch (error) {
    console.error("Booking checkout session creation failed.", error);

    if (
      error instanceof StripeCheckoutRequestError &&
      error.outcomeUnknown
    ) {
      return redirectWithMessage(
        "Checkout status could not be confirmed. Please wait before trying again or contact Support.",
        returnTo,
      );
    }

    const released = await rollBackReservation();

    if (!released) {
      console.error(
        "Booking checkout reservation release could not be confirmed.",
      );
      return redirectWithMessage(
        "Checkout status needs review. Please wait before trying again or contact Support.",
        returnTo,
      );
    }

    return redirectWithMessage(
      "Booking checkout could not open. Please try again.",
      returnTo,
    );
  }

  const releaseSessionAndReservation = () =>
    expireCheckoutSessionBeforeRollback({
      idempotencyKey: `ttc_booking_expire_${booking.id}_${checkoutAttemptId}`,
      rollback: rollBackReservation,
      secretKey,
      sessionId: session.id,
    });

  if (!session.url) {
    const released = await releaseSessionAndReservation();

    if (!released) {
      console.error("Booking checkout expiration could not be confirmed.");
      return redirectWithMessage(
        "Checkout status needs review. Please wait before trying again or contact Support.",
        returnTo,
      );
    }

    return redirectWithMessage(
      `${siteName} could not open checkout for this booking deposit.`,
      returnTo,
    );
  }

  const { data: updatedBooking, error: updateError } = await adminSupabase
    .from("booking_requests")
    .update({
      payment_status: "checkout_started",
      status: "deposit_pending",
      stripe_checkout_session_id: session.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", booking.id)
    .eq("client_id", claims.sub)
    .eq("payment_status", "checkout_started")
    .eq("status", "deposit_pending")
    .is("stripe_checkout_session_id", null)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (updateError) {
    console.error("Booking checkout session save failed.", updateError);
    const released = await releaseSessionAndReservation();

    if (!released) {
      console.error("Booking checkout expiration could not be confirmed.");
      return redirectWithMessage(
        "Checkout status needs review. Please wait before trying again or contact Support.",
        returnTo,
      );
    }

    return redirectWithMessage(
      "Checkout started, but the checkout could not be saved. Please contact support if this repeats.",
      returnTo,
    );
  }

  if (!updatedBooking) {
    const released = await releaseSessionAndReservation();

    if (!released) {
      console.error("Booking checkout expiration could not be confirmed.");
      return redirectWithMessage(
        "Checkout status needs review. Please wait before trying again or contact Support.",
        returnTo,
      );
    }

    return redirectWithMessage(
      "Checkout started, but the booking could not be reserved for this checkout.",
      returnTo,
    );
  }

  revalidatePath("/account");
  revalidatePath("/notifications");

  return NextResponse.redirect(session.url, { status: 303 });
}
