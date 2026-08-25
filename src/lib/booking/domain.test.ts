import { describe, expect, it } from "vitest";

import {
  calculateBookingPrice,
  canAccessBooking,
  classifyPaymentTransition,
  validateBookingRequest,
} from "./domain";

describe("booking rules", () => {
  it("validates chronology and required input", () => {
    expect(validateBookingRequest({ spot_id: " spot-1 ", start_time: "2026-09-01T10:00:00Z", end_time: "2026-09-01T12:00:00Z" }).spotId).toBe("spot-1");
    expect(() => validateBookingRequest({ spot_id: "spot-1", start_time: "invalid", end_time: "2026-09-01T12:00:00Z" })).toThrow(/valid ISO/);
    expect(() => validateBookingRequest({ spot_id: "spot-1", start_time: "2026-09-01T12:00:00Z", end_time: "2026-09-01T10:00:00Z" })).toThrow(/after/);
  });

  it("calculates event and hourly prices with platform payout", () => {
    expect(calculateBookingPrice({ price_per_event: 25 }, "2026-09-01T10:00:00Z", "2026-09-01T12:00:00Z")).toEqual({ hours: 2, totalAmountCents: 2500, feeCents: 375, hostReceivesCents: 2125 });
    expect(calculateBookingPrice({ price_per_hour: 7.5 }, "2026-09-01T10:00:00Z", "2026-09-01T13:00:00Z").totalAmountCents).toBe(2250);
  });

  it("enforces guest and host ownership", () => {
    const booking = { guest_id: "guest-1", host_id: "host-1" };
    expect(canAccessBooking("guest-1", booking, "guest")).toBe(true);
    expect(canAccessBooking("host-1", booking, "host")).toBe(true);
    expect(canAccessBooking("attacker", booking, "guest")).toBe(false);
    expect(canAccessBooking(null, booking, "host")).toBe(false);
  });
});

describe("Stripe webhook idempotency", () => {
  it("confirms pending bookings", () => {
    expect(classifyPaymentTransition({ status: "pending", payment_intent_id: null }, "pi_1")).toBe("confirm");
  });

  it("identifies duplicate delivery of the same intent", () => {
    expect(classifyPaymentTransition({ status: "confirmed", payment_intent_id: "pi_1" }, "pi_1")).toBe("duplicate");
  });

  it("refuses to overwrite a booking confirmed by another intent", () => {
    expect(classifyPaymentTransition({ status: "confirmed", payment_intent_id: "pi_original" }, "pi_other")).toBe("conflict");
  });
});

