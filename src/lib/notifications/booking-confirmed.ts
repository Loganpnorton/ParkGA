/**
 * Sends notifications when a booking is confirmed.
 *
 * Channels:
 * 1. SMS to the Host (via Twilio) — existing behaviour
 * 2. Email to the Guest  (via Resend)
 * 3. Email to the Host   (via Resend)
 */

import { sendSms, buildGoogleMapsUrl } from "@/lib/twilio/client";
import { sendEmail, BOOKINGS_FROM } from "@/lib/resend/client";

// ── Shared helpers ─────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function buildEmailHtml({
  headline,
  greeting,
  bodyLines,
  ctaText,
  ctaUrl,
}: {
  headline: string;
  greeting: string;
  bodyLines: string[];
  ctaText?: string;
  ctaUrl?: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f4f4f5;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    .container {
      max-width: 560px;
      margin: 0 auto;
      padding: 24px 16px;
    }
    .card {
      background: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    }
    .header {
      background: #16a34a;
      padding: 24px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      color: #ffffff;
      font-size: 22px;
      font-weight: 700;
    }
    .body {
      padding: 24px;
    }
    .body p {
      margin: 0 0 12px 0;
      color: #374151;
      font-size: 15px;
      line-height: 1.5;
    }
    .detail-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #f3f4f6;
      font-size: 14px;
    }
    .detail-row:last-child {
      border-bottom: none;
    }
    .detail-label {
      color: #9ca3af;
    }
    .detail-value {
      color: #111827;
      font-weight: 600;
    }
    .cta {
      margin-top: 20px;
      text-align: center;
    }
    .cta a {
      display: inline-block;
      background: #16a34a;
      color: #ffffff;
      text-decoration: none;
      padding: 12px 28px;
      border-radius: 8px;
      font-size: 15px;
      font-weight: 600;
    }
    .footer {
      margin-top: 16px;
      text-align: center;
      color: #9ca3af;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        <h1>${headline}</h1>
      </div>
      <div class="body">
        <p>${greeting}</p>
        ${bodyLines.map((line) => `<p>${line}</p>`).join("")}
        ${ctaText && ctaUrl ? `
        <div class="cta">
          <a href="${ctaUrl}" target="_blank">${ctaText}</a>
        </div>
        ` : ""}
        <p style="margin-top:16px;font-size:13px;color:#9ca3af;">
          — ParkGA Team
        </p>
      </div>
    </div>
    <div class="footer">
      <p>ParkGA &mdash; Smart parking near Truist Park</p>
    </div>
  </div>
</body>
</html>`.trim();
}

// ── Input ──────────────────────────────────────────────────────────────

export interface BookingConfirmedInput {
  /** Host phone (SMS) */
  hostPhone: string;
  /** Host email (Resend) */
  hostEmail: string;
  /** Host display name */
  hostName: string;
  /** Guest email (Resend) */
  guestEmail: string;
  /** Guest display name */
  guestName: string;
  /** Spot title */
  spotTitle: string;
  /** Spot address */
  spotAddress: string;
  /** ISO start time */
  startTime: string;
  /** ISO end time */
  endTime: string;
  /** Total price in dollars */
  totalPrice: number;
  /**
   * Stable unique string for Resend idempotency (e.g. checkout_session_id).
   * Prevents duplicate emails if Stripe retries the webhook event.
   */
  idempotencyKey: string;
}

// ── Main ───────────────────────────────────────────────────────────────

export async function notifyBookingConfirmed(
  input: BookingConfirmedInput,
): Promise<void> {
  const {
    hostPhone,
    hostEmail,
    hostName,
    guestEmail,
    guestName,
    spotTitle,
    startTime,
    endTime,
    totalPrice,
    spotAddress,
    idempotencyKey,
  } = input;

  const dateStr   = formatDate(startTime);
  const startStr  = formatTime(startTime);
  const endStr    = formatTime(endTime);
  const mapsUrl   = buildGoogleMapsUrl(spotAddress);
  const dashUrl   = `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/dashboard`;

  // ── 1. SMS to Host (existing) ────────────────────────────────────
  const smsBody = [
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
    `🗺️ ${mapsUrl}`,
    ``,
    `Check your dashboard for details.`,
  ].join("\n");

  await sendSms(hostPhone, smsBody);

  // ── 2. Email to Guest ────────────────────────────────────────────
  await sendEmail({
    from: BOOKINGS_FROM,
    to: guestEmail,
    subject: `Your booking at ${spotTitle} is confirmed!`,
    html: buildEmailHtml({
      headline: "Booking Confirmed 🎉",
      greeting: `Hi ${guestName},`,
      bodyLines: [
        `Your parking spot at <strong>${spotTitle}</strong> has been confirmed.`,
        `You're all set for ${dateStr} from ${startStr} to ${endStr}.`,
      ],
      ctaText: "View My Booking",
      ctaUrl: dashUrl,
    }),
    idempotencyKey: `booking-confirmed-guest-${idempotencyKey}`,
  });

  // ── 3. Email to Host ─────────────────────────────────────────────
  await sendEmail({
    from: BOOKINGS_FROM,
    to: hostEmail,
    subject: `You have a new booking at ${spotTitle}!`,
    html: buildEmailHtml({
      headline: "New Booking! 🎉",
      greeting: `Hi ${hostName},`,
      bodyLines: [
        `<strong>${guestName}</strong> has booked <strong>${spotTitle}</strong>.`,
        `<div class="detail-row"><span class="detail-label">Date</span><span class="detail-value">${dateStr}</span></div>`,
        `<div class="detail-row"><span class="detail-label">Time</span><span class="detail-value">${startStr} – ${endStr}</span></div>`,
        `<div class="detail-row"><span class="detail-label">Total</span><span class="detail-value">$${totalPrice.toFixed(2)}</span></div>`,
        `<div class="detail-row"><span class="detail-label">Location</span><span class="detail-value">${spotAddress}</span></div>`,
      ],
      ctaText: "Go to Dashboard",
      ctaUrl: dashUrl,
    }),
    idempotencyKey: `booking-confirmed-host-${idempotencyKey}`,
  });
}
