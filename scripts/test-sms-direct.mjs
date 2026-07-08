/**
 * Direct Twilio SMS test for booking reminder.
 * Sends the reminder SMS directly since we already have
 * the confirmed booking & profile data from the MCP queries.
 * 
 * Run: node --env-file=".env.local" scripts/test-sms-direct.mjs
 */
import Twilio from "twilio";

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE = process.env.TWILIO_PHONE_NUMBER;

if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_PHONE) {
  console.error("Missing Twilio env vars");
  process.exit(1);
}

const twilio = Twilio(TWILIO_SID, TWILIO_TOKEN);

// Data from the confirmed booking (booking 0745f97e) and profile
const guestPhone = "+14782274806";
const guestName = "Demo Host";
const spotTitle = "Downtown Parking Spot";
const spotAddress = "123 Main St, Atlanta, GA";
const lat = 33.749;
const lng = -84.388;
const startTime = "2026-07-08T19:56:33.000Z";
const endTime = "2026-07-08T21:56:33.000Z";

const startDate = new Date(startTime);
const endDate = new Date(endTime);

const dateStr = startDate.toLocaleDateString("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
});

const startStr = startDate.toLocaleTimeString("en-US", {
  hour: "numeric",
  minute: "2-digit",
});

const endStr = endDate.toLocaleTimeString("en-US", {
  hour: "numeric",
  minute: "2-digit",
});

const mapsUrl = `https:/\/www.google.com/maps/search/?api=1&query=${encodeURIComponent(spotAddress)}`;
const mapsCoordsUrl = `https:/\/www.google.com/maps?q=${lat},${lng}`;

const body = [
  `Parking Starts in 1 Hour!`,
  ``,
  `Hi ${guestName},`,
  `Your booking at "${spotTitle}" starts soon.`,
  ``,
  `Date: ${dateStr}`,
  `Time: ${startStr} - ${endStr}`,
  ``,
  `Location: ${spotAddress}`,
  `Maps: ${mapsUrl}`,
  `Exact pin: ${mapsCoordsUrl}`,
  ``,
  `Park safe!`,
].join("\n");

console.log("\nSending test SMS booking reminder\n");
console.log(`To: ${guestPhone}`);
console.log(`From: ${TWILIO_PHONE}`);
console.log(`\nMessage body:\n${body}\n`);

try {
  const message = await twilio.messages.create({
    to: guestPhone,
    from: TWILIO_PHONE,
    body,
  });
  console.log(`SMS sent successfully!`);
  console.log(`   SID: ${message.sid}`);
  console.log(`   Status: ${message.status}`);
  if (message.dateSent) {
    console.log(`   Date Sent: ${message.dateSent}`);
  }
} catch (err) {
  console.error(`Twilio error: ${err.message}`);
  if (err.code === 21211) {
    console.error("   Invalid 'To' phone number - check format");
  } else if (err.code === 21608) {
    console.error("   Phone number needs verification in Twilio console");
  }
}

console.log("\nTest complete\n");