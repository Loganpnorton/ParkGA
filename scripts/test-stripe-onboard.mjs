/**
 * Test script to verify Stripe Connect Express account creation.
 * Run: node scripts/test-stripe-onboard.mjs
 *
 * This simulates what the API route does.
 * It requires STRIPE_SECRET_KEY to be set in your environment.
 */

import Stripe from "stripe";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

if (!STRIPE_SECRET_KEY || STRIPE_SECRET_KEY === "sk_test_your_stripe_secret_key") {
  console.error("\n❌ STRIPE_SECRET_KEY is not set.");
  console.error("   Set it in .env.local or export it:");
  console.error('   $env:STRIPE_SECRET_KEY="sk_test_..."\n');
  process.exit(1);
}

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2026-06-24.dahlia",
});

console.log("\n🧪 Testing Stripe Connect Express Account Creation\n");

try {
  // Step 1: Create Express account
  console.log("📦 Creating Express account...");
  const account = await stripe.accounts.create({
    type: "express",
    country: "US",
    email: "test-host-test@parkga.com",
    business_type: "individual",
    capabilities: {
      transfers: { requested: true },
    },
    business_profile: {
      mcc: "7523",
      url: "https://parkga.com",
    },
  });

  console.log(`   ✅ Account created: ${account.id}`);
  console.log(`   ✅ Type: ${account.type}`);
  console.log(`   ✅ Email: ${account.email}`);
  console.log(`   ✅ Capabilities: ${JSON.stringify(account.capabilities)}\n`);

  // Step 2: Create account link for onboarding
  console.log("🔗 Generating onboarding link...");
  const accountLink = await stripe.accountLinks.create({
    account: account.id,
    refresh_url: "http://localhost:3000/dashboard?stripe=refresh",
    return_url: "http://localhost:3000/dashboard?stripe=success",
    type: "account_onboarding",
  });

  console.log(`   ✅ Onboarding URL: ${accountLink.url}`);
  console.log(`   ✅ Expires at: ${new Date(accountLink.expires_at * 1000).toISOString()}\n`);

  // Step 3: Verify we can retrieve the account
  console.log("🔍 Verifying account retrieval...");
  const retrieved = await stripe.accounts.retrieve(account.id);
  console.log(`   ✅ Retrieved: ${retrieved.id}`);
  console.log(`   ✅ Charges enabled: ${retrieved.charges_enabled}`);
  console.log(`   ✅ Payouts enabled: ${retrieved.payouts_enabled}`);
  console.log(`   ✅ Details submitted: ${retrieved.details_submitted}\n`);

  console.log("🎉 All tests passed! Stripe Connect Express is working correctly.\n");

  // Cleanup: delete test account
  console.log("🧹 Cleaning up test account...");
  await stripe.accounts.del(account.id);
  console.log("   ✅ Test account deleted.\n");

} catch (err) {
  console.error("\n❌ Test failed:", err.message);
  if (err instanceof Stripe.errors.StripeError) {
    console.error(`   Type: ${err.type}`);
    console.error(`   Code: ${err.code}`);
    console.error(`   Status: ${err.statusCode}`);
  }
  process.exit(1);
}