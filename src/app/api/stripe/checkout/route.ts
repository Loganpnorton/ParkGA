import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripeClient } from "@/lib/stripe/client";
import { calculateBookingPrice, validateBookingRequest } from "@/lib/booking/domain";

const PLATFORM_FEE_PERCENT = 0.15; // 15% platform fee
const ORIGIN =
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export async function POST(req: NextRequest) {
  try {
    const stripe = getStripeClient();
    // -- 1. Authenticate ---------------------------------------------
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

    // -- 2. Parse request body ---------------------------------------
    const body = await req.json();
    let bookingRequest;
    try {
      bookingRequest = validateBookingRequest(body as {
      spot_id: string;
      start_time: string;
      end_time: string;
      });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Invalid booking request." },
        { status: 400 },
      );
    }
    const { spotId: spot_id, startTime: start_time, endTime: end_time } = bookingRequest;

    // -- 3. Fetch spot + host profile --------------------------------
    const { data: spot, error: spotError } = await supabase
      .from("spots")
      .select("*, host_id")
      .eq("id", spot_id)
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

    // -- 4. Calculate price ------------------------------------------
    let price;
    try {
      price = calculateBookingPrice(spot, start_time, end_time, PLATFORM_FEE_PERCENT);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Invalid spot pricing." },
        { status: 400 },
      );
    }
    const { hours, totalAmountCents, feeCents, hostReceivesCents } = price;

    // -- 5. Create Checkout Session (Destination Charge) -------------
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_intent_data: {
        transfer_data: {
          destination: hostProfile.stripe_account_id,
        },
        application_fee_amount: feeCents,
        metadata: {
          spot_id,
          host_id: spot.host_id,
          guest_id: user.id,
          start_time,
          end_time,
          hours: hours.toFixed(2),
          host_receives_cents: String(hostReceivesCents),
          fee_percent: String(PLATFORM_FEE_PERCENT * 100),
        },
      },
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: spot.title ?? "Parking Spot",
              description:
                spot.price_per_event && hours <= 24
                  ? `${spot.address ?? ""} - Event Parking`
                  : `${spot.address ?? ""} - ${hours.toFixed(1)} hrs`,
              metadata: {
                spot_id,
              },
            },
            unit_amount: totalAmountCents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        spot_id,
        host_id: spot.host_id,
        guest_id: user.id,
        start_time,
        end_time,
        hours: hours.toFixed(2),
      },
      success_url: `${ORIGIN}/listings/${spot_id}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${ORIGIN}/listings/${spot_id}?checkout=cancel`,
    });

    // -- 6. Create booking in pending status -------------------------
    const { error: bookingError } = await supabase.from("bookings").insert({
      spot_id,
      guest_id: user.id,
      start_time,
      end_time,
      total_price: totalAmountCents / 100,
      status: "pending",
      payment_intent_id: null,
      checkout_session_id: session.id, // used by webhook for idempotency
    });

    if (bookingError) {
      console.error("Failed to create booking:", bookingError);
      // Non-fatal - stripe session is created
    }

    // -- 7. Return session URL ---------------------------------------
    return NextResponse.json({
      url: session.url,
      session_id: session.id,
      total: totalAmountCents / 100,
      platform_fee: feeCents / 100,
      host_payout: hostReceivesCents / 100,
    });
  } catch (err) {
    console.error("Stripe checkout error:", err);
    const message =
      err instanceof Error ? err.message : "An unexpected error occurred.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
