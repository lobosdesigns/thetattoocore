import { NextResponse } from "next/server";
import { siteName, siteUrl } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

type CalendarRouteProps = {
  params: Promise<{ id: string }>;
};

type BookingCalendarRow = {
  artist_id: string;
  artist_note: string | null;
  appointment_type_label: string | null;
  body: string;
  client_id: string;
  id: string;
  placement: string | null;
  preferred_city: string | null;
  preferred_slot_label: string | null;
  scheduled_end_at: string | null;
  scheduled_start_at: string | null;
  scheduled_timezone: string | null;
  status: string;
  title: string;
};

function cleanId(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
}

function icsText(value: string | null | undefined) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function stamp(value: Date) {
  return value.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function localStamp(value: string) {
  const date = new Date(value);
  const pad = (part: number) => String(part).padStart(2, "0");

  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}00`;
}

export async function GET(_request: Request, { params }: CalendarRouteProps) {
  const { id } = await params;
  const bookingId = cleanId(id);

  if (!bookingId) {
    return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  }

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims as { sub?: string } | undefined;

  if (!claims?.sub) {
    return NextResponse.redirect(new URL("/login", siteUrl), { status: 303 });
  }

  const { data: booking } = await supabase
    .from("booking_requests")
    .select(
      "id, client_id, artist_id, title, body, placement, preferred_city, appointment_type_label, preferred_slot_label, artist_note, status, scheduled_start_at, scheduled_end_at, scheduled_timezone",
    )
    .eq("id", bookingId)
    .maybeSingle<BookingCalendarRow>();

  if (
    !booking ||
    !booking.scheduled_start_at ||
    !booking.scheduled_end_at ||
    !["accepted", "deposit_pending", "deposit_paid", "completed"].includes(booking.status)
  ) {
    return NextResponse.json({ error: "Calendar file is not available." }, { status: 404 });
  }

  const timezone = booking.scheduled_timezone || "America/Chicago";
  const description = [
    booking.body,
    booking.placement ? `Placement: ${booking.placement}` : null,
    booking.preferred_city ? `City: ${booking.preferred_city}` : null,
    booking.appointment_type_label ? `Type: ${booking.appointment_type_label}` : null,
    booking.preferred_slot_label ? `Preferred slot: ${booking.preferred_slot_label}` : null,
    booking.artist_note ? `Artist note: ${booking.artist_note}` : null,
  ]
    .filter(Boolean)
    .join("\n");
  const now = new Date();
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//TheTattooCore//Booking//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${booking.id}@thetattoocore.com`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART;TZID=${icsText(timezone)}:${localStamp(booking.scheduled_start_at)}`,
    `DTEND;TZID=${icsText(timezone)}:${localStamp(booking.scheduled_end_at)}`,
    `SUMMARY:${icsText(`${siteName} booking: ${booking.title}`)}`,
    `DESCRIPTION:${icsText(description)}`,
    booking.preferred_city ? `LOCATION:${icsText(booking.preferred_city)}` : null,
    `URL:${siteUrl}/account#booking-settings`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ]
    .filter(Boolean)
    .join("\r\n");

  return new NextResponse(ics, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="thetattoocore-booking-${booking.id.slice(0, 8)}.ics"`,
      "Content-Type": "text/calendar; charset=utf-8",
    },
  });
}
