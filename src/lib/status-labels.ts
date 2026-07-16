export function titleCaseStatus(value: string) {
  return value
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function bookingStatusLabel(status: string) {
  if (status === "deposit_paid") return "Deposit paid";
  if (status === "deposit_pending") return "Deposit pending";

  return titleCaseStatus(status);
}

export function bookingPaymentStatusLabel(status: string) {
  if (status === "not_ready") return "Not ready";
  if (status === "checkout_started") return "Checkout started";
  if (status === "payment_failed") return "Payment failed";

  return titleCaseStatus(status);
}

export function commerceStatusLabel(status?: string) {
  if (!status) return "Processing";
  if (status === "pending_checkout") return "Checkout pending";
  if (status === "payment_failed") return "Payment failed";
  if (status === "partially_refunded") return "Partially refunded";

  return titleCaseStatus(status);
}

export function fulfillmentStatusLabel(status: string) {
  if (status === "unfulfilled") return "Not fulfilled";
  if (status === "partially_fulfilled") return "Partially fulfilled";

  return titleCaseStatus(status);
}

export function calendarConnectionStatusLabel(status?: string | null) {
  if (!status || status === "manual") return "Manual setup";
  if (status === "google_planned") return "Google calendar prep";
  if (status === "apple_ical_planned") return "Apple/iCalendar prep";
  if (status === "connected") return "Connected";

  return titleCaseStatus(status);
}

export function accountDeletionStatusLabel(status: string) {
  if (status === "pending") return "Pending review";
  if (status === "reviewing") return "In review";
  if (status === "completed") return "Completed";
  if (status === "rejected") return "Rejected";
  if (status === "cancelled") return "Cancelled";

  return titleCaseStatus(status);
}
