import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY ?? "";

let _resend: Resend | null = null;

/**
 * Returns a singleton Resend client.
 * Throws if RESEND_API_KEY is not set.
 */
export function getResendClient(): Resend {
  if (!_resend) {
    if (!apiKey) {
      throw new Error(
        "RESEND_API_KEY must be set in environment variables.",
      );
    }
    _resend = new Resend(apiKey);
  }
  return _resend;
}

/**
 * Strip wrapping quotes from a string.
 * Vercel / .env files may include literal " or ' around a value.
 */
function stripQuotes(s: string): string {
  return s.replace(/^["']|["']$/g, "").trim();
}

/**
 * Send an email via Resend.
 * Failures are logged but never thrown.
 */
export async function sendEmail({
  from,
  to,
  subject,
  html,
  idempotencyKey,
}: {
  from: string;
  to: string | string[];
  subject: string;
  html: string;
  /** Prevents duplicate sends when Stripe retries */
  idempotencyKey?: string;
}): Promise<boolean> {
  try {
    const resend = getResendClient();
    const { error } = await resend.emails.send({
      from,
      to,
      subject,
      html,
      ...(idempotencyKey ? { idempotencyKey } : {}),
    });

    if (error) {
      console.error("Resend error:", error);
      return false;
    }

    return true;
  } catch (err) {
    console.error("Resend exception:", err);
    return false;
  }
}

/**
 * Default "from" address for transactional booking emails.
 * Set via RESEND_FROM env var.  Falls back to onboarding@resend.dev
 * for the free tier (only delivers to the Resend account owner).
 */
export const BOOKINGS_FROM = stripQuotes(
  process.env.RESEND_FROM ?? "ParkGA <onboarding@resend.dev>",
);
