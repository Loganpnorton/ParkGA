/**
 * Test script to verify Stripe Checkout Session creation with Connect
 * destination charges and 15% platform fee.
 *
 * Run: node scripts/test-stripe-checkout.mjs
 *
 * Requires STRIPE_SECRET_KEY set in environment AND Stripe Connect activated.
 * Uses a test Express account if one exists, or creates one.
 */

import Stripe from "stripe";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

if (!STRIPE_SECRET_KEY || STRIPE_SECRET_KEY === "sk_test_your_stripe_secret_key") {
  console.error("\n❌ STRIPE_SECRET_KEY is not set.");
  process.exit(1);
}

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2026-06-24.dahlia",
});

const PLATFORM_FEE_PERCENT = 0.15;

console.log("\n🧪 Testing Stripe Checkout Session with Connect Fee Split\n");

async function run() {
  // -- 1. Create or reuse a test connected account ------------------
  let connectedAccountId;
  try {
    console.log("📦 Creating test Express connected account...");
    const account = await stripe.accounts.create({
      type: "express",
      country: "US",
      email: "test-host-checkout@parkga.com",
      business_type: "individual",
      capabilities: { transfers: { requested: true } },
      business_profile: { mcc: "7523", url: "https://parkga.com" },
    });
    connectedAccountId = account.id;
    console.log(`   ✅ Connected account: ${connectedAccountId}\n`);
  } catch (err) {
    if (err.message?.includes("sign up for Connect")) {
      console.error("   ❌ Stripe Connect not activated yet.");
      console.error("   → Visit https://dashboard.stripe.com/connect to activate it.\n");
      process.exit(1);
    }
    throw err;
  }

  // -- 2. Create a test price / product -----------------------------
  const totalAmountCents = 2000; // $20.00
  const feeCents = Math.round(totalAmountCents * PLATFORM_FEE_PERCENT); // $3.00
  const hostReceivesCents = totalAmountCents - feeCents; // $17.00

  console.log(`💰 Price Simulation:`);
  console.log(`   Total guest pays:   $${(totalAmountCents / 100).toFixed(2)}`);
  console.log(`   Platform fee (15%): $${(feeCents / 100).toFixed(2)}`);
  console.log(`   Host receives:      $${(hostReceivesCents / 100).toFixed(2)}\n`);

  // -- 3. Create Checkout Session (destination charge) --------------
  console.log("🔗 Creating Checkout Session...");
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_intent_data: {
      transfer_data: {
        destination: connectedAccountId,
      },
      application_fee_amount: feeCents,
      metadata: {
        spot_id: "test-spot-123",
        host_id: "test-host-456",
        guest_id: "test-guest-789",
        start_time: "2026-07-08T14:00:00Z",
        end_time: "2026-07-08T18:00:00Z",
        hours: "4.00",
        host_receives_cents: String(hostReceivesCents),
        fee_percent: String(PLATFORM_FEE_PERCENT * 100),
      },
    },
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: "Covered Driveway - 5 min walk to Truist Park",
            description: "123 Main St, Atlanta - 4.0 hrs",
          },
          unit_amount: totalAmountCents,
        },
        quantity: 1,
      },
    ],
    metadata: {
      spot_id: "test-spot-123",
      host_id: "test-host-456",
      guest_id: "test-guest-789",
      start_time: "2026-07-08T14:00:00Z",
      end_time: "2026-07-08T18:00:00Z",
      hours: "4.00",
    },
    success_url: "https://parkga.com/listings/test-spot-123?checkout=success",
    cancel_url: "https://parkga.com/listings/test-spot-123?checkout=cancel",
  });

  console.log(`   ✅ Session ID: ${session.id}`);
  console.log(`   ✅ Mode: ${session.mode}`);
  console.log(`   ✅ Payment Status: ${session.payment_status}`);
  console.log(`   ✅ URL: ${session.url}\n`);

  // -- 4. Verify split payment data on the PaymentIntent ------------
  console.log("🔍 Verifying PaymentIntent...");
  const paymentIntent = await stripe.paymentIntents.retrieve(
    session.payment_intent?.toString() ?? "",
  );

  console.log(`   ✅ PaymentIntent: ${paymentIntent.id}`);
  console.log(`   ✅ Amount: $${(paymentIntent.amount / 100).toFixed(2)}`);
  console.log(`   ✅ Application fee: $${((paymentIntent.application_fee_amount ?? 0) / 100).toFixed(2)}`);
  console.log(`   ✅ Transfer data destination: ${paymentIntent.transfer_data?.destination}`);
  console.log(`   ✅ Metadata: ${JSON.stringify(paymentIntent.metadata)}\n`);

  // -- Verify the math ----------------------------------------------
  const actualFee = paymentIntent.application_fee_amount ?? 0;
  const actualTotal = paymentIntent.amount;
  const actualHostShare = actualTotal - actualFee;

  console.log("📐 Fee Split Verification:");
  console.log(`   Guest pays:     $${(actualTotal / 100).toFixed(2)}`);
  console.log(`   Platform keeps: $${(actualFee / 100).toFixed(2)} (${(actualFee / actualTotal * 100).toFixed(1)}%)`);
  console.log(`   Host receives:  $${(actualHostShare / 100).toFixed(2)} (${(actualHostShare / actualTotal * 100).toFixed(1)}%)`);
  console.log();

  const feeMatches = actualFee === feeCents;
  const splitCorrect = actualTotal - actualFee > 0;

  if (feeMatches && splitCorrect) {
    console.log("🎉 All checks passed! The 15% platform fee split works correctly.\n");
  } else {
    console.log("❌ Fee split verification failed.\n");
    process.exit(1);
  }

  // -- 5. Cleanup: delete test account ------------------------------
  console.log("🧹 Cleaning up test account...");
  await stripe.accounts.del(connectedAccountId);
  console.log("   ✅ Test account deleted.\n");
}

run().catch((err) => {
  console.error("\n❌ Test failed:", err.message);
  process.exit(1);
});