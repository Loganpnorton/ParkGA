/**
 * Sends an SMS to the host when a booking is confirmed.
 *
 * This is called from the Stripe webhook when it transitions
 * a booking from "pending" to "confirmed".
 */

import { sendSms, buildGoogleMapsUrl } from "@/lib/twilio/client";

interface BookingConfirmedInput {
  hostPhone: string;
  hostName: string;
  guestName: string;
  spotTitle: string;
  spotAddress: string;
  startTime: string;
  endTime: string;
  totalPrice: number;
}

export async function notifyHostBookingConfirmed(
  input: BookingConfirmedInput,
): Promise<void> {
  const {
    hostPhone,
    hostName,
    guestName,
    spotTitle,
    startTime,
    endTime,
    totalPrice,
    spotAddress,
  } = input;

  const startDate = new Date(startTime);
  const endDate = new Date(endTime);

  const dateStr = startDate.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const startStr = startDate.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  const endStr = endDate.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  const body = [
    `🎉 New Booking Confirmed!`,
    ``,
    `Hi ${hostName},`,
    `${guestName} has booked "${spotTitle}".`,
    ``,
    `📅 ${dateStr}`,
    `⏰ ${startStr} – ${endStr}`,
    `💰 $${totalPrice.toFixed(2)} total`,
    ``,
    `📍 ${spotAddress}`,
    `🗺️ ${buildGoogleMapsUrl(spotAddress)}`,
    ``,
    `Check your dashboard for details.`,
  ].join("\n");

  await sendSms(hostPhone, body);
}