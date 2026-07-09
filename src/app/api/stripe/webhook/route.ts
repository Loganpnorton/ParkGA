import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyBookingConfirmed } from "@/lib/notifications/booking-confirmed";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
  apiVersion: "2026-06-24.dahlia",
});

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "";

/**
 * POST /api/stripe/webhook
 *
 * Handles Stripe webhook events — specifically checkout.session.completed.
 *
 * Security:
 * - Verifies the Stripe-Signature header using the webhook secret
 * - Uses createAdminClient (SUPABASE_SERVICE_ROLE_KEY) to bypass RLS
 *
 * Idempotency:
 * - Queries by checkout_session_id; if already confirmed, returns 200
 */
export async function POST(req: NextRequest) {
  try {
    // ── 1. Read raw body ────────────────────────────────────────────
    const rawBody = await req.text();
    const signature = req.headers.get("stripe-signature") ?? "";

    if (!WEBHOOK_SECRET) {
      console.error("STRIPE_WEBHOOK_SECRET is not configured");
      return NextResponse.json(
        { error: "Webhook secret not configured" },
        { status: 500 },
      );
    }

    // ── 2. Verify signature ─────────────────────────────────────────
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

    // ── 3. Handle only checkout.session.completed ───────────────────
    if (event.type !== "checkout.session.completed") {
      return NextResponse.json({ received: true });
    }

    const session = event.data.object as Stripe.Checkout.Session;
    const sessionId = session.id;
    const paymentIntentId = session.payment_intent?.toString() ?? null;
    const metadata = session.metadata ?? {};

    const spot_id = metadata.spot_id;
    const guest_id = metadata.guest_id;
    const start_time = metadata.start_time;
    const end_time = metadata.end_time;

    if (!spot_id || !guest_id || !start_time || !end_time) {
      console.error("Webhook missing metadata:", metadata);
      return NextResponse.json(
        { error: "Missing required metadata" },
        { status: 400 },
      );
    }

    // ── 4. Use admin client (bypasses RLS) ──────────────────────────
    const supabase = createAdminClient();

    // ── 5. Idempotency check ────────────────────────────────────────
    const { data: existing } = await supabase
      .from("bookings")
      .select("id, status")
      .eq("checkout_session_id", sessionId)
      .maybeSingle();

    if (existing && existing.status === "confirmed") {
      return NextResponse.json({
        received: true,
        idempotent: true,
        booking_id: existing.id,
      });
    }

    // ── 6. Upsert booking: update status to confirmed ───────────────
    const { data: booking, error: upsertError } = await supabase
      .from("bookings")
      .upsert(
        {
          spot_id,
          guest_id,
          start_time,
          end_time,
          status: "confirmed",
          payment_intent_id: paymentIntentId,
          checkout_session_id: sessionId,
        },
        {
          onConflict: "checkout_session_id",
          ignoreDuplicates: false,
        },
      )
      .select("id, total_price")
      .single();

    if (upsertError) {
      console.error("Webhook upsert error:", upsertError);
      return NextResponse.json(
        { error: "Failed to update booking" },
        { status: 500 },
      );
    }

    console.log(
      `✅ Booking confirmed: session=${sessionId}, booking=${booking?.id}, payment_intent=${paymentIntentId}`,
    );

    // ── 7. Fire notifications (best-effort, non-blocking) ───────────
    // We fire and forget so a notification failure never causes a 500.
    notifyBookingConfirmed
      .apply(null, await gatherNotificationData(supabase, {
        bookingId: booking!.id,
        spot_id,
        guest_id,
        start_time,
        end_time,
        totalPrice: Number(booking!.total_price),
      }))
      .catch((err: unknown) =>
        console.error("Notification error (non-fatal):", err),
      );

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

// ── Gather data for notifications ──────────────────────────────────────

interface GatherInput {
  bookingId: string;
  spot_id: string;
  guest_id: string;
  start_time: string;
  end_time: string;
  totalPrice: number;
}

async function gatherNotificationData(
  supabase: ReturnType<typeof createAdminClient>,
  input: GatherInput,
): Promise<Parameters<typeof notifyBookingConfirmed>> {
  const { spot_id, guest_id, start_time, end_time, totalPrice } = input;

  // Fetch spot + host profile + guest profile in parallel
  const [spotResult, guestResult] = await Promise.all([
    supabase
      .from("spots")
      .select("title, address, host_id")
      .eq("id", spot_id)
      .single(),
    supabase
      .from("profiles")
      .select("name, phone, email")
      .eq("id", guest_id)
      .single(),
  ]);

  const spot = spotResult.data;
  const guestProfile = guestResult.data;

  if (!spot) {
    console.error("Spot not found for notifications:", spot_id);
    return [] as unknown as Parameters<typeof notifyBookingConfirmed>;
  }

  // Fetch host profile
  const { data: hostProfile } = await supabase
    .from("profiles")
    .select("name, phone, email")
    .eq("id", spot.host_id)
    .single();

  if (!hostProfile?.phone) {
    console.error("Host phone missing — skipping SMS");
    return [] as unknown as Parameters<typeof notifyBookingConfirmed>;
  }

  return [
    {
      hostPhone: hostProfile.phone,
      hostEmail: hostProfile.email ?? "",
      hostName: hostProfile.name ?? "Host",
      guestEmail: guestProfile?.email ?? "",
      guestName: guestProfile?.name ?? "Guest",
      spotTitle: spot.title,
      spotAddress: spot.address,
      startTime: start_time,
      endTime: end_time,
      totalPrice,
    },
  ] as unknown as Parameters<typeof notifyBookingConfirmed>;
}
