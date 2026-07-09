"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { loadStripe, StripeElementsOptions } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { createClient } from "@/lib/supabase/client";
import {
  Loader2,
  Check,
  ArrowLeft,
  AlertCircle,
  CreditCard,
  MapPin,
  Calendar,
  Clock,
  DollarSign,
  Shield,
} from "lucide-react";

const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";
const stripePromise = loadStripe(stripePublishableKey);

const supabase = createClient();

// ─── Types ─────────────────────────────────────────────────────────────
interface BookingWithSpot {
  id: string;
  spot_id: string;
  guest_id: string;
  start_time: string;
  end_time: string;
  total_price: number;
  status: string;
  payment_intent_id: string | null;
  created_at: string;
}

interface SpotInfo {
  id: string;
  title: string;
  address: string;
  price_per_hour: number | null;
  price_per_event: number | null;
  images: string[];
}

// ─── Formatting helpers ────────────────────────────────────────────────
function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function getDuration(start: string, end: string): string {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const hrs = ms / (1000 * 60 * 60);
  if (hrs < 1) return `${Math.round(ms / (1000 * 60))} min`;
  return `${hrs.toFixed(1)} hrs`;
}

// ─── Checkout Form ─────────────────────────────────────────────────────
function CheckoutForm({
  booking,
  spot,
  clientSecret,
  onSuccess,
}: {
  booking: BookingWithSpot;
  spot: SpotInfo;
  clientSecret: string;
  onSuccess: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!stripe || !elements) return;

    setProcessing(true);
    setError(null);

    const { error: submitError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/checkout/${booking.id}/success`,
      },
      redirect: "if_required",
    });

    if (submitError) {
      setError(submitError.message ?? "Payment failed. Please try again.");
      setProcessing(false);
      return;
    }

    // If redirect: "if_required" and no error, payment succeeded without redirect
    onSuccess();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement />

      {error && (
        <div className="flex items-center gap-1.5 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || processing}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-parkga-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-parkga-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {processing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <CreditCard className="h-4 w-4" />
            Pay ${booking.total_price.toFixed(2)}
          </>
        )}
      </button>

      <p className="flex items-center justify-center gap-1 text-center text-xs text-gray-400">
        <Shield className="h-3 w-3" />
        Secured by Stripe
      </p>
    </form>
  );
}

// ─── Main Checkout Page ────────────────────────────────────────────────
export default function CheckoutPage() {
  const params = useParams();
  const router = useRouter();
  const bookingId = params.booking_id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [booking, setBooking] = useState<BookingWithSpot | null>(null);
  const [spot, setSpot] = useState<SpotInfo | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);

  useEffect(() => {
    async function init() {
      if (!bookingId) return;

      // 1. Check auth
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push(`/auth/login?redirect=/checkout/${bookingId}`);
        return;
      }

      // 2. Fetch booking
      const { data: bookingData, error: bookingError } = await supabase
        .from("bookings")
        .select("*")
        .eq("id", bookingId)
        .single();

      if (bookingError || !bookingData) {
        setError("Booking not found.");
        setLoading(false);
        return;
      }

      if (bookingData.guest_id !== user.id) {
        setError("This booking does not belong to you.");
        setLoading(false);
        return;
      }

      if (bookingData.status === "confirmed") {
        setPaid(true);
        setLoading(false);
        return;
      }

      if (bookingData.status !== "pending") {
        setError("This booking cannot be paid for.");
        setLoading(false);
        return;
      }

      setBooking(bookingData as BookingWithSpot);

      // 3. Fetch spot details
      const { data: spotData } = await supabase
        .from("spots")
        .select("id, title, address, price_per_hour, price_per_event, images")
        .eq("id", bookingData.spot_id)
        .single();

      if (spotData) {
        setSpot(spotData as SpotInfo);
      }

      // 4. Create PaymentIntent
      try {
        const res = await fetch("/api/stripe/create-payment-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ booking_id: bookingId }),
        });

        const data = await res.json();

        if (!res.ok) {
          setError(data.error ?? "Failed to initialize payment.");
          setLoading(false);
          return;
        }

        setClientSecret(data.client_secret);
      } catch {
        setError("Network error. Please try again.");
      }

      setLoading(false);
    }

    init();
  }, [bookingId, router]);

  // ── Loading state ──────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-parkga-600" />
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex h-[calc(100vh-4rem)] flex-col items-center justify-center px-4">
        <AlertCircle className="h-12 w-12 text-red-400" />
        <h1 className="mt-4 text-xl font-bold text-gray-900">Something went wrong</h1>
        <p className="mt-2 text-sm text-gray-500">{error}</p>
        <Link
          href="/listings"
          className="mt-6 rounded-lg bg-parkga-600 px-6 py-2.5 text-sm font-semibold text-white"
        >
          Browse spots
        </Link>
      </div>
    );
  }

  // ── Success / Already paid ─────────────────────────────────────────
  if (paid) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-parkga-100">
            <Check className="h-8 w-8 text-parkga-600" />
          </div>
          <h1 className="mt-6 text-3xl font-bold tracking-tight text-gray-900">
            Payment Successful!
          </h1>
          <p className="mt-3 text-sm text-gray-600">
            Your booking has been confirmed. Check your dashboard for details.
          </p>
          <div className="mt-8 flex items-center justify-center gap-4">
            <Link
              href="/dashboard"
              className="rounded-lg bg-parkga-600 px-6 py-2.5 text-sm font-semibold text-white"
            >
              Go to Dashboard
            </Link>
            <Link
              href="/listings"
              className="rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-semibold text-gray-700"
            >
              Browse spots
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Render checkout ────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Back link */}
      <Link
        href={`/listings/${booking?.spot_id}`}
        className="mb-6 inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-parkga-600"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to listing
      </Link>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-5">
        {/* ── Left: Payment form ───────────────────────────────────── */}
        <div className="md:col-span-3">
          <h1 className="text-2xl font-bold text-gray-900">Complete your booking</h1>
          <p className="mt-1 text-sm text-gray-500">
            Enter your payment details to confirm this parking spot.
          </p>

          <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            {clientSecret && stripePublishableKey ? (
              <Elements
                stripe={stripePromise}
                options={{
                  clientSecret,
                  appearance: {
                    theme: "stripe",
                    variables: {
                      colorPrimary: "#16a34a",
                      colorBackground: "#ffffff",
                      colorText: "#111827",
                      fontFamily: "Inter, system-ui, sans-serif",
                    },
                  },
                } as StripeElementsOptions}
              >
                <CheckoutForm
                  booking={booking!}
                  spot={spot!}
                  clientSecret={clientSecret}
                  onSuccess={() => setPaid(true)}
                />
              </Elements>
            ) : (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-parkga-600" />
              </div>
            )}
          </div>
        </div>

        {/* ── Right: Booking summary ───────────────────────────────── */}
        <div className="md:col-span-2">
          <div className="sticky top-24 space-y-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-900">Booking Summary</h3>

              {spot && (
                <div className="mt-4 flex items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100">
                    {spot.images && spot.images.length > 0 ? (
                      <img
                        src={spot.images[0]}
                        alt={spot.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <MapPin className="h-5 w-5 text-gray-400" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {spot.title}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{spot.address}</p>
                  </div>
                </div>
              )}

              {booking && (
                <div className="mt-5 space-y-3 border-t border-gray-100 pt-4">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <span>{formatDate(booking.start_time)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Clock className="h-4 w-4 text-gray-400" />
                    <span>
                      {formatTime(booking.start_time)} – {formatTime(booking.end_time)}
                    </span>
                  </div>
                  {spot && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Clock className="h-4 w-4 text-gray-400" />
                      <span>{getDuration(booking.start_time, booking.end_time)}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-5 space-y-2 border-t border-gray-100 pt-4">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Subtotal</span>
                  <span>${booking?.total_price.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-400">
                  <span>Service fee</span>
                  <span>Included</span>
                </div>
                <div className="flex justify-between border-t border-gray-100 pt-2 text-base font-bold text-gray-900">
                  <span>Total</span>
                  <span>${booking?.total_price.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-xl bg-blue-50 px-4 py-3">
              <Shield className="h-4 w-4 shrink-0 text-blue-600" />
              <p className="text-xs text-blue-700">
                Your payment is processed securely via Stripe. Your card details are never
                stored on our servers.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
