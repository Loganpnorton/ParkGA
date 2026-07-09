import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyBookingConfirmed } from "@/lib/notifications/booking-confirmed";

/**
 * POST /api/notifications/booking-confirmed
 *
 * Legacy endpoint — the Stripe webhook now fires notifications directly.
 * Kept for manual testing / re-triggering.
 *
 * Body: { booking_id: string }
 */
export async function POST(req: NextRequest) {
  try {
    const { booking_id } = await req.json();

    if (!booking_id) {
      return NextResponse.json(
        { error: "Missing booking_id" },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();

    // Fetch booking with spot + host + guest data
    const { data: booking } = await supabase
      .from("bookings")
      .select(
        `*,
        spot:spot_id(title, address, host_id)`,
      )
      .eq("id", booking_id)
      .single();

    if (!booking) {
      return NextResponse.json(
        { error: "Booking not found" },
        { status: 404 },
      );
    }

    // Fetch host profile
    const { data: hostProfile } = await supabase
      .from("profiles")
      .select("name, phone, email")
      .eq("id", (booking.spot as any).host_id)
      .single();

    if (!hostProfile?.phone) {
      console.warn(
        `Host ${(booking.spot as any).host_id} has no phone — skipping SMS.`,
      );
    }

    // Fetch guest profile
    const { data: guestProfile } = await supabase
      .from("profiles")
      .select("name, email")
      .eq("id", booking.guest_id)
      .single();

    await notifyBookingConfirmed({
      hostPhone: hostProfile?.phone ?? "",
      hostEmail: hostProfile?.email ?? "",
      hostName: hostProfile?.name ?? "Host",
      guestEmail: guestProfile?.email ?? "",
      guestName: guestProfile?.name ?? "Guest",
      spotTitle: (booking.spot as any).title ?? "Parking Spot",
      spotAddress: (booking.spot as any).address ?? "",
      startTime: booking.start_time,
      endTime: booking.end_time,
      totalPrice: Number(booking.total_price),
      idempotencyKey: booking_id,
    });

    return NextResponse.json({ sent: true });
  } catch (err) {
    console.error("Booking confirmed notification error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
