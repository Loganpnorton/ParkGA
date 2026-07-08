import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";

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
 * - Uses the raw request body (required for signature verification)
 *
 * Idempotency:
 * - The checkout route stores session.id in booking.checkout_session_id
 * - The webhook queries by checkout_session_id; if found, returns 200 (already processed)
 * - This prevents double-booking if Stripe sends the event twice
 */
export async function POST(req: NextRequest) {
  try {
    // ── 1. Read raw body ────────────────────────────────────────────
    // Stripe requires the raw body for signature verification
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
      // Other events (e.g. payment_intent.succeeded) are ignored
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

    // ── 4. Idempotency check ────────────────────────────────────────
    // Query for a booking with this checkout_session_id
    const supabase = await createClient();

    const { data: existing } = await supabase
      .from("bookings")
      .select("id, status")
      .eq("checkout_session_id", sessionId)
      .maybeSingle();

    if (existing && existing.status === "confirmed") {
      // Already processed — idempotent
      return NextResponse.json({
        received: true,
        idempotent: true,
        booking_id: existing.id,
      });
    }

    // ── 5. Upsert booking: update status to confirmed ───────────────
    // Use upsert with checkout_session_id as the conflict key so that
    // even if the webhook fires twice, only one update happens.
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
      .select("id")
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

