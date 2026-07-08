import Twilio from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID ?? "";
const authToken = process.env.TWILIO_AUTH_TOKEN ?? "";
const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID ?? "";

let client: Twilio.Twilio | null = null;

export function getTwilioClient(): Twilio.Twilio {
  if (!client) {
    if (!accountSid || !authToken) {
      throw new Error(
        "TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN must be set in environment variables.",
      );
    }
    client = Twilio(accountSid, authToken);
  }
  return client;
}

export async function sendSms(
  to: string,
  body: string,
): Promise<string | null> {
  try {
    const twilio = getTwilioClient();

    const params: Record<string, string> = {
      to,
      body,
    };

    if (messagingServiceSid) {
      params.messagingServiceSid = messagingServiceSid;
    } else {
      const fromNumber = process.env.TWILIO_PHONE_NUMBER;
      if (!fromNumber) {
        throw new Error(
          "TWILIO_PHONE_NUMBER or TWILIO_MESSAGING_SERVICE_SID must be set.",
        );
      }
      params.from = fromNumber;
    }

    const message = await twilio.messages.create(
      params as any,
    );
    console.log(`📱 SMS sent to ${to}: SID ${message.sid}`);
    return message.sid;
  } catch (err) {
    console.error(
      "❌ Failed to send SMS:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

export function buildGoogleMapsUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

export function buildGoogleMapsCoordsUrl(
  lat: string | number,
  lng: string | number,
): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}