export type BookingRefundStripeContext = {
  refundApplicationFee: boolean;
  stripeAccount: string | null;
};

export type BookingRefundAmountProgress = "advance" | "current" | "stale";

type BookingRefundRouting = {
  connectedAccountId: string | null;
  feePayer: string;
  paymentChargeModel: string;
};

const stripeConnectedAccountPattern = /^acct_[A-Za-z0-9]{8,200}$/;

export function bookingRefundAmountProgress({
  currentAmount,
  incomingAmount,
  totalAmount,
}: {
  currentAmount: number;
  incomingAmount: number;
  totalAmount: number;
}): BookingRefundAmountProgress | null {
  if (
    !Number.isInteger(currentAmount) ||
    !Number.isInteger(incomingAmount) ||
    !Number.isInteger(totalAmount) ||
    totalAmount < 0 ||
    currentAmount < 0 ||
    incomingAmount < 0 ||
    currentAmount > totalAmount ||
    incomingAmount > totalAmount
  ) {
    return null;
  }

  if (incomingAmount > currentAmount) return "advance";
  if (incomingAmount === currentAmount) return "current";

  return "stale";
}

export function bookingRefundStripeContext(
  routing: BookingRefundRouting,
): BookingRefundStripeContext | null {
  if (
    routing.paymentChargeModel === "platform" &&
    routing.feePayer === "client" &&
    routing.connectedAccountId === null
  ) {
    return { refundApplicationFee: false, stripeAccount: null };
  }

  if (
    routing.paymentChargeModel === "connected_direct" &&
    routing.feePayer === "provider" &&
    typeof routing.connectedAccountId === "string" &&
    stripeConnectedAccountPattern.test(routing.connectedAccountId)
  ) {
    return {
      refundApplicationFee: true,
      stripeAccount: routing.connectedAccountId,
    };
  }

  return null;
}
