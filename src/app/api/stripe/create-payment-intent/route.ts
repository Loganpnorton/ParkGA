import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
  apiVersion: "2026-06-24.dahlia",
});

const PLATFORM_FEE_PERCENT = 0.15; // 15% platform fee

/**
 * POST /api/stripe/create-payment-intent
 *
 * Accepts a booking_id, looks up the pending booking + associated spot,
 * creates a PaymentIntent with Stripe Connect destination charge,
 * updates the booking record with the payment_intent_id, and returns
 * the client_secret for use with Stripe Elements on the frontend.
 */
export async function POST(req: NextRequest) {
  try {
    // ── 1. Authenticate ─────────────────────────────────────────────
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "You must be signed in to book." },
        { status: 401 },
      );
    }

    // ── 2. Parse request body ───────────────────────────────────────
    const body = await req.json();
    const { booking_id } = body as { booking_id: string };

    if (!booking_id) {
      return NextResponse.json(
        { error: "Missing required field: booking_id." },
        { status: 400 },
      );
    }

    // ── 3. Fetch booking ────────────────────────────────────────────
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select("*")
      .eq("id", booking_id)
      .eq("guest_id", user.id)
      .single();

    if (bookingError || !booking) {
      return NextResponse.json(
        { error: "Booking not found." },
        { status: 404 },
      );
    }

    if (booking.status !== "pending") {
      return NextResponse.json(
        { error: "Booking is not in a pending state." },
        { status: 400 },
      );
    }

    if (booking.payment_intent_id) {
      // Booking already has a PaymentIntent — return its client_secret
      try {
        const existingPi = await stripe.paymentIntents.retrieve(
          booking.payment_intent_id,
        );
        if (existingPi.status === "requires_payment_method") {
          return NextResponse.json({ client_secret: existingPi.client_secret });
        }
      } catch {
        // PI may have expired or been deleted; proceed to create a new one
      }
    }

    // ── 4. Fetch spot + host profile ────────────────────────────────
    const { data: spot, error: spotError } = await supabase
      .from("spots")
      .select("*, host_id")
      .eq("id", booking.spot_id)
      .single();

    if (spotError || !spot) {
      return NextResponse.json(
        { error: "Spot not found." },
        { status: 404 },
      );
    }

    const { data: hostProfile } = await supabase
      .from("profiles")
      .select("stripe_account_id")
      .eq("id", spot.host_id)
      .single();

    if (!hostProfile?.stripe_account_id) {
      return NextResponse.json(
        {
          error:
            "The host has not connected their Stripe account yet. Please try again later.",
        },
        { status: 400 },
      );
    }

    // ── 5. Calculate price ──────────────────────────────────────────
    const start = new Date(booking.start_time);
    const end = new Date(booking.end_time);
    const hours =
      (end.getTime() - start.getTime()) / (1000 * 60 * 60);

    let totalAmountCents: number;

    if (spot.price_per_event && hours <= 24) {
      totalAmountCents = Math.round(spot.price_per_event * 100);
    } else if (spot.price_per_hour) {
      totalAmountCents = Math.round(hours * spot.price_per_hour * 100);
    } else {
      return NextResponse.json(
        { error: "This spot has no valid pricing configured." },
        { status: 400 },
      );
    }

    const feeCents = Math.round(totalAmountCents * PLATFORM_FEE_PERCENT);
    const hostReceivesCents = totalAmountCents - feeCents;

    if (totalAmountCents < 50) {
      return NextResponse.json(
        { error: "Total must be at least $0.50." },
        { status: 400 },
      );
    }

    // ── 6. Create PaymentIntent (Destination Charge) ────────────────
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalAmountCents,
      currency: "usd",
      transfer_data: {
        destination: hostProfile.stripe_account_id,
      },
      application_fee_amount: feeCents,
      metadata: {
        booking_id,
        spot_id: spot.id,
        host_id: spot.host_id,
        guest_id: user.id,
        start_time: booking.start_time,
        end_time: booking.end_time,
        hours: hours.toFixed(2),
        host_receives_cents: String(hostReceivesCents),
        fee_percent: String(PLATFORM_FEE_PERCENT * 100),
      },
    });

    // ── 7. Update booking with payment_intent_id ────────────────────
    const { error: updateError } = await supabase
      .from("bookings")
      .update({
        payment_intent_id: paymentIntent.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", booking_id);

    if (updateError) {
      console.error("Failed to update booking with payment_intent_id:", updateError);
      // Non-fatal — the PI exists in Stripe
    }

    // ── 8. Return client_secret ─────────────────────────────────────
    return NextResponse.json({
      client_secret: paymentIntent.client_secret,
      total: totalAmountCents / 100,
      platform_fee: feeCents / 100,
      host_payout: hostReceivesCents / 100,
    });
  } catch (err) {
    console.error("Create PaymentIntent error:", err);
    const message =
      err instanceof Error ? err.message : "An unexpected error occurred.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
