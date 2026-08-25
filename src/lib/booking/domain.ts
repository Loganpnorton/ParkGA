export interface BookingRequest {
  spot_id?: string;
  start_time?: string;
  end_time?: string;
}

export interface SpotPricing {
  price_per_event?: number | null;
  price_per_hour?: number | null;
}

export interface BookingPrice {
  hours: number;
  totalAmountCents: number;
  feeCents: number;
  hostReceivesCents: number;
}

export function validateBookingRequest(input: BookingRequest): {
  spotId: string;
  startTime: string;
  endTime: string;
} {
  const spotId = input.spot_id?.trim();
  const startTime = input.start_time;
  const endTime = input.end_time;
  if (!spotId || !startTime || !endTime) {
    throw new Error("Missing required fields: spot_id, start_time, end_time.");
  }
  const start = new Date(startTime);
  const end = new Date(endTime);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
    throw new Error("Booking times must be valid ISO dates.");
  }
  if (end <= start) throw new Error("Booking end time must be after its start time.");
  return { spotId, startTime, endTime };
}

export function calculateBookingPrice(
  pricing: SpotPricing,
  startTime: string,
  endTime: string,
  platformFeePercent = 0.15,
): BookingPrice {
  const hours = (new Date(endTime).getTime() - new Date(startTime).getTime()) / 3_600_000;
  let totalAmountCents: number;
  if (pricing.price_per_event && hours <= 24) {
    totalAmountCents = Math.round(pricing.price_per_event * 100);
  } else if (pricing.price_per_hour) {
    totalAmountCents = Math.round(hours * pricing.price_per_hour * 100);
  } else {
    throw new Error("This spot has no valid pricing configured.");
  }
  if (totalAmountCents < 50) throw new Error("Total must be at least $0.50.");
  const feeCents = Math.round(totalAmountCents * platformFeePercent);
  return { hours, totalAmountCents, feeCents, hostReceivesCents: totalAmountCents - feeCents };
}

export function canAccessBooking(
  actorId: string | null,
  booking: { guest_id: string; host_id?: string | null },
  role: "guest" | "host",
): boolean {
  if (!actorId) return false;
  return role === "guest" ? booking.guest_id === actorId : booking.host_id === actorId;
}

export type PaymentTransition = "confirm" | "duplicate" | "conflict";

export function classifyPaymentTransition(
  existing: { status: string; payment_intent_id?: string | null } | null,
  incomingPaymentIntentId: string,
): PaymentTransition {
  if (existing?.status !== "confirmed") return "confirm";
  return existing.payment_intent_id === incomingPaymentIntentId ? "duplicate" : "conflict";
}

