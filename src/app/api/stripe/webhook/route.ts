import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyBookingConfirmed } from "@/lib/notifications/booking-confirmed";
import { getStripeClient } from "@/lib/stripe/client";

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "";

/**
 * POST /api/stripe/webhook
 *
 * Handles Stripe webhook events - specifically payment_intent.succeeded.
 *
 * Security:
 * - Verifies the Stripe-Signature header using the webhook secret
 * - Uses createAdminClient (SUPABASE_SERVICE_ROLE_KEY) to bypass RLS
 *
 * Idempotency:
 * - Queries by payment_intent_id; if already confirmed, returns 200
 */
export async function POST(req: NextRequest) {
  try {
    const stripe = getStripeClient();
    // -- 1. Read raw body --------------------------------------------
    const rawBody = await req.text();
    const signature = req.headers.get("stripe-signature") ?? "";

    if (!WEBHOOK_SECRET) {
      console.error("STRIPE_WEBHOOK_SECRET is not configured");
      return NextResponse.json(
        { error: "Webhook secret not configured" },
        { status: 500 },
      );
    }

    // -- 2. Verify signature -----------------------------------------
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, WEBHOOK_SECRET);
    } catch (sigErr) {
      console.error("Stripe webhook signature verification failed:", sigErr);
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 400 },
      );
    }

    // -- 3. Handle only payment_intent.succeeded ---------------------
    if (event.type !== "payment_intent.succeeded") {
      return NextResponse.json({ received: true });
    }

    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    const paymentIntentId = paymentIntent.id;
    const metadata = paymentIntent.metadata ?? {};

    const booking_id = metadata.booking_id;

    if (!booking_id) {
      console.error("Webhook missing booking_id in metadata:", metadata);
      return NextResponse.json(
        { error: "Missing booking_id in metadata" },
        { status: 400 },
      );
    }

    // -- 4. Use admin client (bypasses RLS) --------------------------
    const supabase = createAdminClient();

    // -- 5. Idempotency check ----------------------------------------
    const { data: existing } = await supabase
      .from("bookings")
      .select("id, status")
      .eq("payment_intent_id", paymentIntentId)
      .maybeSingle();

    if (existing && existing.status === "confirmed") {
      return NextResponse.json({
        received: true,
        idempotent: true,
        booking_id: existing.id,
      });
    }

    // -- 6. Update booking: set status to confirmed ------------------
    const totalPriceCents = paymentIntent.amount ?? 0;
    const totalPriceDollars = totalPriceCents / 100;

    const { data: booking, error: updateError } = await supabase
      .from("bookings")
      .update({
        status: "confirmed",
        total_price: totalPriceDollars,
        payment_intent_id: paymentIntentId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", booking_id)
      .select("id, total_price, spot_id, guest_id, start_time, end_time")
      .single();

    if (updateError) {
      console.error("Webhook update error:", updateError);
      return NextResponse.json(
        { error: "Failed to update booking" },
        { status: 500 },
      );
    }

    console.log(
      `✅ Booking confirmed: booking=${booking?.id}, payment_intent=${paymentIntentId}`,
    );

    // -- 7. Fire notifications ----------------------------------------
    if (booking) {
      await fireNotifications(supabase, {
        booking_id: booking.id,
        spot_id: booking.spot_id,
        guest_id: booking.guest_id,
        start_time: booking.start_time,
        end_time: booking.end_time,
        totalPrice: Number(booking.total_price),
        paymentIntentId,
      });
    }

    return NextResponse.json({
      received: true,
      booking_id: booking?.id,
      status: "confirmed",
    });
  } catch (err) {
    console.error("Stripe webhook error:", err);
    const message =
      err instanceof Error ? err.message : "An unexpected error occurred.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// -- Fire notifications (non-blocking, best-effort) ---------------------

interface NotifInput {
  booking_id: string;
  spot_id: string;
  guest_id: string;
  start_time: string;
  end_time: string;
  totalPrice: number;
  paymentIntentId: string;
}

async function fireNotifications(
  supabase: ReturnType<typeof createAdminClient>,
  input: NotifInput,
): Promise<void> {
  const { spot_id, guest_id, start_time, end_time, totalPrice, paymentIntentId } = input;

  try {
    // Fetch spot + guest profile + host profile in parallel
    const [spotResult, guestProfileResult, hostIdResult] = await Promise.all([
      supabase.from("spots").select("title, address, host_id").eq("id", spot_id).single(),
      supabase.from("profiles").select("name, phone").eq("id", guest_id).single(),
      supabase.from("spots").select("host_id").eq("id", spot_id).single(),
    ]);

    const spot = spotResult.data;
    const guestProfile = guestProfileResult.data;
    const hostId = hostIdResult.data?.host_id;

    if (!spot || !hostId) {
      return console.error("Missing spot/host data for notifications");
    }

    // Fetch host profile
    const { data: hostProfile } = await supabase
      .from("profiles")
      .select("name, phone")
      .eq("id", hostId)
      .single();

    // Get emails from auth.users (admin API - always available)
    const [guestUser, hostUser] = await Promise.all([
      supabase.auth.admin.getUserById(guest_id).catch(() => ({ data: { user: null } })),
      supabase.auth.admin.getUserById(hostId).catch(() => ({ data: { user: null } })),
    ]);

    const guestEmail = guestUser?.data?.user?.email ?? "";
    const hostEmail = hostUser?.data?.user?.email ?? "";
    const hostPhone = hostProfile?.phone ?? "";

    await notifyBookingConfirmed({
      hostPhone,
      hostEmail,
      hostName: hostProfile?.name ?? "Host",
      guestEmail,
      guestName: guestProfile?.name ?? "Guest",
      spotTitle: spot.title,
      spotAddress: spot.address,
      startTime: start_time,
      endTime: end_time,
      totalPrice,
      idempotencyKey: paymentIntentId,
    });
  } catch (err) {
    console.error("Notifications error (non-fatal):", err);
  }
}
