import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/twilio/client", () => ({ sendSms: vi.fn(), buildGoogleMapsUrl: (address: string) => `maps:${address}` }));
vi.mock("@/lib/resend/client", () => ({ sendEmail: vi.fn(), BOOKINGS_FROM: "bookings@example.com" }));

import { sendEmail } from "@/lib/resend/client";
import { sendSms } from "@/lib/twilio/client";
import { notifyBookingConfirmed } from "./booking-confirmed";

describe("booking confirmation notifications", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fans out one SMS and two idempotent emails", async () => {
    await notifyBookingConfirmed({ hostPhone: "+15555550100", hostEmail: "host@example.com", hostName: "Harper", guestEmail: "guest@example.com", guestName: "Grace", spotTitle: "Lot A", spotAddress: "1 Main St", startTime: "2026-09-01T18:00:00Z", endTime: "2026-09-01T20:00:00Z", totalPrice: 25, idempotencyKey: "pi_safe_fixture" });
    expect(sendSms).toHaveBeenCalledOnce();
    expect(sendSms).toHaveBeenCalledWith("+15555550100", expect.stringContaining("Lot A"));
    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(vi.mocked(sendEmail).mock.calls.map(([message]) => message.idempotencyKey)).toEqual(["booking-confirmed-guest-pi_safe_fixture", "booking-confirmed-host-pi_safe_fixture"]);
  });
});

