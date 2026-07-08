import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";

// Initialize Stripe with the secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
  apiVersion: "2026-06-24.dahlia",
});

/**
 * POST /api/stripe/onboard
 *
 * Creates or retrieves a Stripe Express connected account for the authenticated
 * user, generates an onboarding link, and returns it so the client can redirect
 * the user to Stripe's hosted onboarding flow.
 */
export async function POST(_req: NextRequest) {
  try {
    // 1) Verify the user is authenticated
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "You must be signed in to connect with Stripe." },
        { status: 401 },
      );
    }

    // 2) Fetch the user's profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role, stripe_account_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Profile not found." },
        { status: 404 },
      );
    }

    let accountId = profile.stripe_account_id;

    // 3) Create a Stripe Express account if one doesn't exist
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        country: "US",
        email: user.email,
        business_type: "individual",
        capabilities: {
          transfers: { requested: true },
        },
        business_profile: {
          mcc: "7523", // Parking lots, garages
          url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://parkga.com",
        },
      });

      accountId = account.id;

      // Save the Stripe account ID to the user's profile
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ stripe_account_id: accountId })
        .eq("id", user.id);

      if (updateError) {
        console.error("Failed to save stripe_account_id:", updateError);
        // Non-fatal — the account was created on Stripe's side
      }
    }

    // 4) Generate an Account Link for onboarding
    const origin = _req.headers.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}/dashboard?stripe=refresh`,
      return_url: `${origin}/dashboard?stripe=success`,
      type: "account_onboarding",
    });

    // 5) Return the onboarding URL
    return NextResponse.json({
      url: accountLink.url,
      account_id: accountId,
    });
  } catch (err) {
    console.error("Stripe onboard error:", err);
    const message =
      err instanceof Error ? err.message : "An unexpected error occurred.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}