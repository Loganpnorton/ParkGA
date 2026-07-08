import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { notifyHostBookingConfirmed } from "@/lib/notifications/booking-confirmed";

/**
 * POST /api/notifications/booking-confirmed
 *
 * Triggered by the Stripe webhook after a booking transitions
 * to "confirmed". Sends an SMS to the host.
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

    // Fetch booking with spot and host profile
    const supabase = await createClient();
    const { data: booking } = await supabase
      .from("bookings")
      .select(
        `*,
        spot:spot_id(title, address, host_id),
        host:spot_id(host_id)`,
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
      .select("name, phone")
      .eq("id", (booking.spot as any).host_id)
      .single();

    if (!hostProfile?.phone) {
      console.warn(
        `Host ${(booking.spot as any).host_id} has no phone number set. Skipping SMS.`,
      );
      return NextResponse.json({
        sent: false,
        reason: "Host has no phone number",
      });
    }

    // Fetch guest profile
    const { data: guestProfile } = await supabase
      .from("profiles")
      .select("name")
      .eq("id", booking.guest_id)
      .single();

    await notifyHostBookingConfirmed({
      hostPhone: hostProfile.phone,
      hostName: hostProfile.name ?? "Host",
      guestName: guestProfile?.name ?? "A guest",
      spotTitle: (booking.spot as any).title ?? "Parking Spot",
      spotAddress: (booking.spot as any).address ?? "",
      startTime: booking.start_time,
      endTime: booking.end_time,
      totalPrice: Number(booking.total_price),
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