import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/twilio/client", () => ({ sendSms: vi.fn(), buildGoogleMapsUrl: (address: string) => `maps:${address}` }));

import { sendSms } from "@/lib/twilio/client";
import { notifyGuestBookingReminder } from "./booking-reminder";

describe("booking reminders", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends the guest a time window and both map references", async () => {
    await notifyGuestBookingReminder({ guestPhone: "+15555550200", guestName: "Grace", spotTitle: "Lot A", spotAddress: "1 Main St", lat: 33.89, lng: -84.46, startTime: "2026-09-01T18:00:00Z", endTime: "2026-09-01T20:00:00Z" });
    expect(sendSms).toHaveBeenCalledOnce();
    const body = vi.mocked(sendSms).mock.calls[0][1];
    expect(body).toContain("Lot A");
    expect(body).toContain("maps:1 Main St");
    expect(body).toContain("33.89,-84.46");
  });
});

