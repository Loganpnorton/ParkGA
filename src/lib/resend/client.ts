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
 * Send an email via Resend.
 * Silently logs errors so a failure here doesn't crash the caller.
 */
export async function sendEmail({
  from,
  to,
  subject,
  html,
}: {
  from: string;
  to: string | string[];
  subject: string;
  html: string;
}): Promise<boolean> {
  try {
    const resend = getResendClient();
    const { data, error } = await resend.emails.send({
      from,
      to,
      subject,
      html,
    });

    if (error) {
      console.error("❌ Resend email error:", error);
      return false;
    }

    console.log(`📧 Email sent to ${to}: id=${data?.id}`);
    return true;
  } catch (err) {
    console.error(
      "❌ Failed to send email via Resend:",
      err instanceof Error ? err.message : err,
    );
    return false;
  }
}

/**
 * Default "from" address for transactional booking emails.
 *
 * ⚠️ Resend free/test tier REQUIREMENTS:
 * - The `from` domain MUST be verified in your Resend dashboard.
 * - Until you verify a domain, set RESEND_FROM to
 *   "ParkGA <onboarding@resend.dev>" — this only delivers to the
 *   email address you signed up to Resend with.
 * - Once you verify a domain (e.g. parkga.com), set
 *   RESEND_FROM="ParkGA <bookings@parkga.com>"
 */
export const BOOKINGS_FROM =
  process.env.RESEND_FROM ?? "ParkGA <onboarding@resend.dev>";
