import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { platformFeeDescription } from "@/lib/payments/fees";
import { siteName, siteUrl } from "@/lib/site";
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

type CheckoutSession = {
  id: string;
  url: string | null;
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
  returnTo: string | null,
) {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error("Booking checkout is almost ready. Payment setup is still being finished.");
  }

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

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    body,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    method: "POST",
  });
  const session = (await response.json()) as
    | CheckoutSession
    | { error?: { message?: string } };

  if (!response.ok || !("id" in session)) {
    const message =
      "error" in session && session.error?.message
        ? session.error.message
        : "Booking checkout could not open.";

    throw new Error(message);
  }

  return session;
}

export async function POST(request: Request) {
  const canProcessStripeWebhooks = Boolean(
    process.env.STRIPE_WEBHOOK_SECRET && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  if (!process.env.STRIPE_SECRET_KEY) {
    return redirectWithMessage(
      "Booking checkout is almost ready. Payment setup is still being finished.",
    );
  }

  if (!canProcessStripeWebhooks) {
    return redirectWithMessage(
      "Booking checkout is almost ready. Payment setup is still being finished.",
    );
  }

  const formData = await request.formData();
  const bookingId = String(formData.get("booking_id") ?? "").trim();
  const returnTo = safeInternalReturnPath(formData.get("return_to"));

  if (!bookingId) {
    return redirectWithMessage("Choose a booking request first.", returnTo);
  }

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims as Claims | undefined;

  if (!claims?.sub) {
    const params = new URLSearchParams({
      message: "Sign in to pay a booking deposit.",
      return_to: returnTo ?? "/account#booking-settings",
    });

    return NextResponse.redirect(`${siteUrl}/login?${params.toString()}`, { status: 303 });
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

  if (booking.status !== "accepted") {
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
      "Booking checkout is almost ready. Payment setup is still being finished.",
      returnTo,
    );
  }

  const { data: reservedBooking, error: reserveError } = await adminSupabase
    .from("booking_requests")
    .update({
      payment_status: "checkout_started",
      status: "deposit_pending",
      stripe_checkout_session_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", booking.id)
    .eq("client_id", claims.sub)
    .eq("status", "accepted")
    .in("payment_status", ["not_ready", "payment_failed"])
    .select("id")
    .maybeSingle<{ id: string }>();

  if (reserveError) {
    return redirectWithMessage(
      reserveError.message || "The booking deposit could not be reserved before checkout.",
      returnTo,
    );
  }

  if (!reservedBooking) {
    return redirectWithMessage(
      "Booking deposit checkout has already started. Finish that checkout or wait for it to expire before trying again.",
      returnTo,
    );
  }

  const rollBackReservation = async () => {
    await adminSupabase
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
      .is("stripe_checkout_session_id", null);
  };

  let session: CheckoutSession;

  try {
    session = await createBookingCheckoutSession(booking, returnTo);
  } catch (error) {
    await rollBackReservation();
    return redirectWithMessage(
      error instanceof Error ? error.message : "Booking checkout could not open.",
      returnTo,
    );
  }

  if (!session.url) {
    await rollBackReservation();
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
    return redirectWithMessage(
      updateError.message || "Checkout started, but the checkout could not be saved.",
      returnTo,
    );
  }

  if (!updatedBooking) {
    return redirectWithMessage(
      "Checkout started, but the booking could not be reserved for this checkout.",
      returnTo,
    );
  }

  revalidatePath("/account");
  revalidatePath("/notifications");

  return NextResponse.redirect(session.url, { status: 303 });
}
