/**
 * Sends an SMS to the guest 1 hour before their booking starts
 * with a Google Maps link to the spot address.
 *
 * This is designed to be called from a scheduled function (e.g. Vercel Cron)
 * or from a Supabase pg_cron job.
 */

import { sendSms, buildGoogleMapsUrl } from "@/lib/twilio/client";

interface BookingReminderInput {
  guestPhone: string;
  guestName: string;
  spotTitle: string;
  spotAddress: string;
  lat: number;
  lng: number;
  startTime: string;
  endTime: string;
}

export async function notifyGuestBookingReminder(
  input: BookingReminderInput,
): Promise<void> {
  const {
    guestPhone,
    guestName,
    spotTitle,
    spotAddress,
    lat,
    lng,
    startTime,
    endTime,
  } = input;

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

  const mapsUrl = buildGoogleMapsUrl(spotAddress);
  const mapsCoordsUrl = `https://www.google.com/maps?q=${lat},${lng}`;

  const body = [
    `⏰ Parking Starts in 1 Hour!`,
    ``,
    `Hi ${guestName},`,
    `Your booking at "${spotTitle}" starts soon.`,
    ``,
    `📅 ${dateStr}`,
    `⏰ ${startStr} – ${endStr}`,
    ``,
    `📍 ${spotAddress}`,
    `🗺️ Open in Maps: ${mapsUrl}`,
    `📍 Exact pin: ${mapsCoordsUrl}`,
    ``,
    `Park safe! 🚗`,
  ].join("\n");

  await sendSms(guestPhone, body);
}