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
 * Logs detailed diagnostics so failures are visible in Vercel logs.
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
  const recipients = Array.isArray(to) ? to.join(", ") : to;

  console.log(`📨 [Resend] Attempting send — from="${from}" to="${recipients}" subject="${subject}"`);

  try {
    const resend = getResendClient();
    const { data, error } = await resend.emails.send({
      from,
      to,
      subject,
      html,
    });

    if (error) {
      console.error(
        `❌ [Resend] API returned an error — name=${error.name} message=${error.message}`,
        error,
      );
      return false;
    }

    console.log(`✅ [Resend] Email sent successfully — id=${data?.id} to="${recipients}"`);
    return true;
  } catch (err) {
    console.error(
      `❌ [Resend] Exception thrown — ${err instanceof Error ? err.message : String(err)}`,
      err,
    );
    return false;
  }
}

/**
 * Default "from" address for transactional booking emails.
 *
 * The env-var value is passed through stripQuotes() so that setting
 *   RESEND_FROM="ParkGA <bookings@parkga.com>"
 * in a .env file or Vercel dashboard does NOT include the literal
 * quote characters in the actual from-string (which would break
 * Resend's format validation).
 *
 * ⚠️ Resend free/test tier:
 * - Defaults to "ParkGA <onboarding@resend.dev>"
 * - This only delivers to the email you registered to Resend with.
 * - To send to any recipient, verify a domain at
 *   https://resend.com/domains  and set RESEND_FROM accordingly.
 */
export const BOOKINGS_FROM = stripQuotes(
  process.env.RESEND_FROM ?? "ParkGA <onboarding@resend.dev>",
);
