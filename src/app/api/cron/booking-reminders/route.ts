import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyGuestBookingReminder } from "@/lib/notifications/booking-reminder";

/**
 * GET /api/cron/booking-reminders
 *
 * Cron job that runs every 15 minutes. Finds confirmed bookings
 * that start in approximately 1 hour and sends an SMS reminder
 * to the guest with a Google Maps link.
 *
 * Setup: Add this URL to Vercel Cron Jobs or any cron service.
 *
 * crontab example (every 15 minutes):
 *   every 15 min: curl https://parkga.com/api/cron/booking-reminders
 */
interface ReminderSpot {
  title: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
}

export async function GET(req: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (
      !cronSecret ||
      req.headers.get("authorization") !== `Bearer ${cronSecret}`
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createAdminClient();

    // Find bookings starting in 45-75 minutes from now
    const now = new Date();
    const windowStart = new Date(now.getTime() + 45 * 60 * 1000).toISOString();
    const windowEnd = new Date(now.getTime() + 75 * 60 * 1000).toISOString();

    const { data: bookings } = await supabase
      .from("bookings")
      .select(
        `*,
        spot:spot_id(title, address, lat, lng, host_id)`,
      )
      .eq("status", "confirmed")
      .gte("start_time", windowStart)
      .lte("start_time", windowEnd)
      .limit(50);

    if (!bookings || bookings.length === 0) {
      return NextResponse.json({ sent: 0 });
    }

    let sentCount = 0;

    for (const booking of bookings) {
      const spot = booking.spot as unknown as ReminderSpot;
      if (!spot) continue;

      // Fetch guest profile
      const { data: guest } = await supabase
        .from("profiles")
        .select("name, phone")
        .eq("id", booking.guest_id)
        .single();

      if (!guest?.phone) {
        console.warn(`Guest ${booking.guest_id} has no phone. Skipping.`);
        continue;
      }

      await notifyGuestBookingReminder({
        guestPhone: guest.phone,
        guestName: guest.name ?? "Guest",
        spotTitle: spot.title ?? "Parking Spot",
        spotAddress: spot.address ?? "",
        lat: Number(spot.lat),
        lng: Number(spot.lng),
        startTime: booking.start_time,
        endTime: booking.end_time,
      });

      sentCount++;
    }

    return NextResponse.json({ sent: sentCount, total: bookings.length });
  } catch (err) {
    console.error("Cron booking reminders error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
