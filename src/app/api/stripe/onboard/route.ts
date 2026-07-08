import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
  apiVersion: "2026-06-24.dahlia",
});

export async function POST(_req: NextRequest) {
  try {
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
          mcc: "7523",
          url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://parkga.com",
        },
      });

      accountId = account.id;

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ stripe_account_id: accountId })
        .eq("id", user.id);

      if (updateError) {
        console.error("Failed to save stripe_account_id:", updateError);
      }
    }

    const origin =
      _req.headers.get("origin") ??
      process.env.NEXT_PUBLIC_SITE_URL ??
      "http://localhost:3000";

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}/dashboard?stripe=refresh&tab=listings`,
      return_url: `${origin}/dashboard?stripe=success&tab=listings`,
      type: "account_onboarding",
    });

    return NextResponse.json({
      url: accountLink.url,
      account_id: accountId,
    });
  } catch (err) {
    console.error("Stripe onboard error:", err);
    const message =
      err instanceof Error ? err.message : "An unexpected error occurred.";

    if (
      message.includes("sign up for Connect") ||
      message.includes("must sign up for Connect")
    ) {
      return NextResponse.json(
        {
          error:
            "Stripe Connect is not yet activated for this account. Please visit https://dashboard.stripe.com/connect to activate it, then try again.",
          connect_url: "https://dashboard.stripe.com/connect",
        },
        { status: 400 },
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}