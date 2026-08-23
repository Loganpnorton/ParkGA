/**
 * Test script to verify the SMS booking reminder flow directly.
 *
 * This script:
 * 1. Connects to Supabase with the anon key (bypasses RLS via admin pattern)
 * 2. Finds confirmed bookings starting in ~45-75 minutes
 * 3. Sends an SMS reminder to the guest
 *
 * Run: node scripts/test-sms-reminder.mjs
 *
 * Prerequisites:
 *   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER
 *   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
 */

import { createClient } from "@supabase/supabase-js";
import Twilio from "twilio";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE = process.env.TWILIO_PHONE_NUMBER;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Missing Supabase env vars");
  process.exit(1);
}
if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_PHONE) {
  console.error("❌ Missing Twilio env vars");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const twilio = Twilio(TWILIO_SID, TWILIO_TOKEN);

console.log("\n🧪 Testing SMS Booking Reminder\n");

async function run() {
  // -- 1. Find confirmed bookings in the window --------------
  const now = new Date();
  const windowStart = new Date(now.getTime() + 45 * 60 * 1000).toISOString();
  const windowEnd = new Date(now.getTime() + 75 * 60 * 1000).toISOString();

  console.log(`Current time: ${now.toISOString()}`);
  console.log(`Window: ${windowStart} → ${windowEnd}\n`);

  const { data: bookings, error } = await supabase
    .from("bookings")
    .select("*, spot:spot_id(title, address, lat, lng)")
    .eq("status", "confirmed")
    .gte("start_time", windowStart)
    .lte("start_time", windowEnd)
    .limit(5);

  if (error) {
    console.error("❌ Query error:", error.message);
    process.exit(1);
  }

  if (!bookings || bookings.length === 0) {
    console.log("⚠️  No confirmed bookings found in the time window.");
    console.log("   Let me check ALL confirmed bookings:");
    const { data: all } = await supabase
      .from("bookings")
      .select("id, status, start_time, guest_id")
      .eq("status", "confirmed");
    console.log(`   Found ${all?.length ?? 0} total confirmed bookings`);
    if (all?.length) {
      all.forEach(b => {
        const diff = (new Date(b.start_time).getTime() - now.getTime()) / 60000;
        console.log(`   - ${b.id.slice(0,8)}: start=${b.start_time} (in ${Math.round(diff)} min)`);
      });
    }
    process.exit(1);
  }

  console.log(`Found ${bookings.length} booking(s) in the window:\n`);

  for (const booking of bookings) {
    const spot = booking.spot;

    // Fetch guest phone
    const { data: guest } = await supabase
      .from("profiles")
      .select("name, phone")
      .eq("id", booking.guest_id)
      .single();

    console.log(`📋 Booking: ${booking.id.slice(0,8)}`);
    console.log(`   Spot: ${spot?.title ?? "N/A"}`);
    console.log(`   Start: ${booking.start_time}`);
    console.log(`   Guest: ${guest?.name ?? "N/A"} (${guest?.phone ?? "no phone"})`);

    if (!guest?.phone) {
      console.log("   ⏭️  Skipping - no phone number\n");
      continue;
    }

    // Build message
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(spot?.address ?? "")}`;
    const coordsUrl = `https://www.google.com/maps?q=${spot?.lat},${spot?.lng}`;
    const startDate = new Date(booking.start_time);
    const endDate = new Date(booking.end_time);

    const body = [
      `⏰ Parking Starts in 1 Hour!`,
      ``,
      `Hi ${guest.name ?? "Guest"},`,
      `Your booking at "${spot?.title}" starts soon.`,
      ``,
      `📅 ${startDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}`,
      `⏰ ${startDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} \u2013 ${endDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`,
      ``,
      `📍 ${spot?.address}`,
      `🗺️ ${mapsUrl}`,
      `📍 Exact pin: ${coordsUrl}`,
      ``,
      `Park safe! 🚗`,
    ].join("\n");

    console.log(`\n📱 Sending SMS to ${guest.phone}...`);
    console.log(`   Message:\n${body}\n`);

    try {
      const message = await twilio.messages.create({
        to: guest.phone,
        from: TWILIO_PHONE,
        body,
      });
      console.log(`   ✅ Sent! SID: ${message.sid}\n`);
    } catch (txErr) {
      console.error(`   ❌ Twilio error: ${txErr.message}\n`);
    }
  }

  console.log("✅ Test complete\n");
}

run().catch((err) => {
  console.error("\n❌ Error:", err.message);
  process.exit(1);
});