"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { loadStripe, StripeElementsOptions } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Loader2,
  Check,
  ChevronLeft,
  AlertCircle,
  CreditCard,
  MapPin,
  Calendar,
  Clock,
  Shield,
  Mail,
  Phone,
  Car,
  Star,
  ChevronDown,
  ChevronRight,
  XCircle,
  PencilLine,
} from "lucide-react";

const stripePublishableKey =
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";
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
  host_id: string;
}

interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
}

interface VehicleInfo {
  make: string;
  model: string;
  color: string;
  licensePlate: string;
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

function getCancelDate(endTime: string): string {
  const d = new Date(endTime);
  d.setDate(d.getDate() - 1);
  return formatDate(d.toISOString());
}

// ─── Accordion Section Wrapper ─────────────────────────────────────────

function AccordionCard({
  step,
  title,
  isOpen,
  onToggle,
  isComplete,
  isDisabled,
  children,
}: {
  step: number;
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  isComplete: boolean;
  isDisabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`overflow-hidden rounded-xl border bg-white shadow-sm transition-all ${
        isDisabled && !isComplete
          ? "cursor-not-allowed border-gray-100 opacity-60"
          : "border-gray-200 hover:shadow-md"
      } ${isComplete && !isOpen ? "border-brand-200" : ""}`}
    >
      <button
        type="button"
        onClick={isDisabled && !isComplete ? undefined : onToggle}
        className={`flex w-full items-center gap-3 px-5 py-4 text-left transition-colors ${
          isDisabled && !isComplete ? "" : "hover:bg-gray-50/50"
        }`}
      >
        {/* Step number / completed badge */}
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
            isComplete
              ? "bg-brand-600 text-white"
              : isOpen
                ? "bg-parkga-600 text-white"
                : "bg-gray-200 text-gray-500"
          }`}
        >
          {isComplete ? <Check className="h-3.5 w-3.5" /> : step}
        </span>

        {/* Title */}
        <span
          className={`flex-1 text-sm font-semibold ${
            isComplete ? "text-brand-700" : "text-slate-900"
          }`}
        >
          {title}
        </span>

        {/* Summary when collapsed + complete */}
        {isComplete && !isOpen && (
          <span className="mr-1 text-xs text-brand-600 font-medium">Complete</span>
        )}

        {/* Chevron */}
        {isOpen ? (
          <ChevronDown className="h-4 w-4 text-gray-400" />
        ) : (
          <ChevronRight className="h-4 w-4 text-gray-400" />
        )}
      </button>

      {isOpen && <div className="border-t border-gray-100 px-5 py-4">{children}</div>}
    </div>
  );
}

// ─── Payment Form ──────────────────────────────────────────────────────

function PaymentFormContent({
  booking,
  onPaymentComplete,
}: {
  booking: BookingWithSpot;
  onPaymentComplete: () => void;
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

    // Submit the elements (triggers validation, shows wallet sheets)
    const { error: submitError } = await elements.submit();
    if (submitError) {
      setError(submitError.message ?? "Please check your payment details.");
      setProcessing(false);
      return;
    }

    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/checkout/${booking.id}/success`,
      },
      redirect: "if_required",
    });

    if (confirmError) {
      setError(confirmError.message ?? "Payment failed. Please try again.");
      setProcessing(false);
      return;
    }

    // Payment succeeded without redirect (e.g., plain card payment)
    // Advance to vehicle details instead of redirecting
    onPaymentComplete();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <PaymentElement
        options={{
          layout: {
            type: "accordion",
            defaultCollapsed: false,
            spacedAccordionItems: true,
          },
        }}
      />

      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
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
            <LockIcon className="h-4 w-4" />
            Confirm & Pay — ${booking.total_price.toFixed(2)}
          </>
        )}
      </button>

      <div className="flex items-center justify-center gap-1.5 text-xs text-gray-400">
        <Shield className="h-3 w-3" />
        <span>Payments are secured and encrypted by Stripe</span>
      </div>
    </form>
  );
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

// ─── Star Rating Display ───────────────────────────────────────────────

function StarRatingDisplay({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`h-3 w-3 ${
            star <= rating ? "fill-amber-400 text-amber-400" : "text-gray-300"
          }`}
        />
      ))}
    </div>
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
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);

  // ── Editable contact fields ─────────────────────────────────────────
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  // ── Vehicle info fields ─────────────────────────────────────────────
  const [vehicle, setVehicle] = useState<VehicleInfo>({
    make: "",
    model: "",
    color: "",
    licensePlate: "",
  });

  // ── Accordion state ─────────────────────────────────────────────────
  type Section = "contact" | "payment" | "vehicle";
  const [openSection, setOpenSection] = useState<Section>("contact");

  // Completion state
  const [contactComplete, setContactComplete] = useState(false);
  const [paymentComplete, setPaymentComplete] = useState(false);
  const [vehicleComplete, setVehicleComplete] = useState(false);

  // Derived: is contact info valid?
  const isContactValid = email.trim().length > 0 && phone.trim().length > 0;

  // ── Initialize from fetched profile ─────────────────────────────────
  useEffect(() => {
    if (profile) {
      setEmail(profile.email);
      setPhone(profile.phone ?? "");
    }
  }, [profile]);

  // ── Initialization ──────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

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

      // 2. Fetch profile (name, phone)
      const { data: profileData } = await supabase
        .from("profiles")
        .select("id, name, phone")
        .eq("id", user.id)
        .single();

      // 3. Fetch booking
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

      if (!cancelled) {
        setBooking(bookingData as BookingWithSpot);
        const p: UserProfile = {
          id: user.id,
          email: user.email ?? "",
          name: profileData?.name ?? null,
          phone: profileData?.phone ?? null,
        };
        setProfile(p);
        setEmail(p.email);
        setPhone(p.phone ?? "");
      }

      // 4. Fetch spot details
      const { data: spotData } = await supabase
        .from("spots")
        .select("id, title, address, price_per_hour, price_per_event, images, host_id")
        .eq("id", bookingData.spot_id)
        .single();

      if (spotData && !cancelled) {
        setSpot(spotData as SpotInfo);

        // Fetch average rating
        const { data: reviewsData } = await supabase
          .from("reviews")
          .select("rating")
          .eq("spot_id", spotData.id);

        if (reviewsData && reviewsData.length > 0) {
          const avg =
            reviewsData.reduce((sum, r) => sum + r.rating, 0) /
            reviewsData.length;
          setAvgRating(Math.round(avg * 10) / 10);
        }
      }

      // 5. Create PaymentIntent
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

        if (!cancelled) setClientSecret(data.client_secret);
      } catch {
        if (!cancelled) setError("Network error. Please try again.");
      }

      if (!cancelled) setLoading(false);
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [bookingId, router]);

  // ── Save profile changes to Supabase ────────────────────────────────
  const saveContactToProfile = useCallback(async () => {
    if (!profile?.id) return;
    // Only save if phone actually changed from what's in the DB
    const currentPhone = profile.phone ?? "";
    if (phone === currentPhone) return;

    await supabase
      .from("profiles")
      .update({ phone: phone || null, updated_at: new Date().toISOString() })
      .eq("id", profile.id);
  }, [profile, phone, supabase]);

  // ── Handle "Continue" from contact info ─────────────────────────────
  function handleContactContinue() {
    if (!isContactValid) return;
    setContactComplete(true);
    saveContactToProfile();
    setOpenSection("payment");
  }

  // ── Handle successful payment (advance to vehicle, don't redirect) ─
  function handlePaymentComplete() {
    setPaymentComplete(true);
    setOpenSection("vehicle");
    toast.success("Payment successful! 🎉", {
      description: "Add your vehicle details or continue to dashboard.",
      duration: 4000,
    });
  }

  // ── Final redirect to dashboard ─────────────────────────────────────
  function goToDashboard() {
    router.push("/dashboard");
  }

  // ── Handle vehicle save ─────────────────────────────────────────────
  function handleVehicleSave() {
    setVehicleComplete(true);
    toast.success("Booking confirmed! 🎉", {
      description:
        "Your parking spot has been reserved. Check your dashboard for details.",
      duration: 5000,
    });
    goToDashboard();
  }

  // ── Handle skip vehicle ─────────────────────────────────────────────
  function handleSkipVehicle() {
    setVehicleComplete(true);
    toast.success("Booking confirmed! 🎉", {
      description:
        "Your parking spot has been reserved. Check your dashboard for details.",
      duration: 5000,
    });
    goToDashboard();
  }

  // ── Loading state ───────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-parkga-600" />
      </div>
    );
  }

  // ── Error state ─────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center px-4">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
          <XCircle className="h-8 w-8 text-red-500" />
        </div>
        <h1 className="mt-4 text-xl font-bold text-gray-900">
          Something went wrong
        </h1>
        <p className="mt-2 max-w-sm text-center text-sm text-gray-500">
          {error}
        </p>
        <Link
          href="/listings"
          className="mt-6 rounded-lg bg-parkga-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-parkga-700"
        >
          Browse spots
        </Link>
      </div>
    );
  }

  // ── Already paid ────────────────────────────────────────────────────
  if (paid) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-100">
            <Check className="h-8 w-8 text-brand-600" />
          </div>
          <h1 className="mt-6 text-3xl font-bold tracking-tight text-slate-900">
            Already Confirmed!
          </h1>
          <p className="mt-3 text-sm text-slate-600">
            This booking has already been paid and confirmed. Check your
            dashboard for details.
          </p>
          <div className="mt-8 flex items-center justify-center gap-4">
            <Link
              href="/dashboard"
              className="rounded-lg bg-parkga-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-parkga-700"
            >
              Go to Dashboard
            </Link>
            <Link
              href="/listings"
              className="rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
            >
              Browse spots
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Render Split-Screen Checkout ────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Thin top bar */}
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Link
            href={`/listings/${booking?.spot_id}`}
            className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-parkga-600 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </Link>
          <span className="text-sm font-semibold text-gray-900">Checkout</span>
          <div className="w-14" /> {/* spacer */}
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-10">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
          {/* ═══ LEFT COLUMN: Accordion Flow ═══ */}
          <div className="space-y-4 lg:col-span-3">
            <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">
              Complete your booking
            </h1>
            <p className="text-sm text-gray-500">
              Fill in your details below to reserve this parking spot.
            </p>

            <div className="mt-6 space-y-3">
              {/* ═══════════════════════════════════════════════════════
                  1. CONTACT INFO CARD
              ════════════════════════════════════════════════════════ */}
              <AccordionCard
                step={1}
                title="Contact info"
                isOpen={openSection === "contact"}
                onToggle={() => setOpenSection(openSection === "contact" ? "payment" : "contact")}
                isComplete={contactComplete}
              >
                <div className="space-y-5">
                  {/* Email */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                      Email address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="your@email.com"
                        className="block w-full rounded-lg border border-gray-300 pl-10 pr-4 py-2.5 text-sm text-gray-900 transition-colors focus:border-parkga-500 focus:outline-none focus:ring-2 focus:ring-parkga-500/20"
                      />
                    </div>
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                      Phone number
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+1 (555) 123-4567"
                        className="block w-full rounded-lg border border-gray-300 pl-10 pr-4 py-2.5 text-sm text-gray-900 transition-colors focus:border-parkga-500 focus:outline-none focus:ring-2 focus:ring-parkga-500/20"
                      />
                    </div>
                  </div>

                  {/* SMS reminder note */}
                  <div className="rounded-lg bg-parkga-50 px-3 py-2.5">
                    <p className="text-xs text-parkga-700">
                      <span className="font-medium">SMS reminders:</span> We'll
                      send you a text reminder before your reservation starts.
                      Manage notification preferences in your dashboard.
                    </p>
                  </div>

                  {/* Continue button */}
                  <button
                    type="button"
                    onClick={handleContactContinue}
                    disabled={!isContactValid}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-parkga-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-parkga-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Continue to payment
                  </button>
                </div>
              </AccordionCard>

              {/* ═══════════════════════════════════════════════════════
                  2. PAYMENT METHOD CARD
              ════════════════════════════════════════════════════════ */}
              <AccordionCard
                step={2}
                title="Payment method"
                isOpen={openSection === "payment"}
                onToggle={() => setOpenSection(openSection === "payment" ? "vehicle" : "payment")}
                isComplete={paymentComplete}
                isDisabled={!contactComplete}
              >
                {!contactComplete ? (
                  <div className="py-4 text-center text-sm text-gray-400">
                    Please complete your contact information first.
                  </div>
                ) : clientSecret && stripePublishableKey ? (
                  <Elements
                    stripe={stripePromise}
                    options={
                      {
                        clientSecret,
                        appearance: {
                          theme: "stripe",
                          variables: {
                            colorPrimary: "#16a34a",
                            colorBackground: "#ffffff",
                            colorText: "#111827",
                            colorDanger: "#dc2626",
                            fontFamily:
                              'Inter, ui-sans-serif, system-ui, sans-serif',
                            borderRadius: "8px",
                            spacingUnit: "4px",
                          },
                          rules: {
                            ".Input": {
                              border: "1px solid #d1d5db",
                              boxShadow: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
                            },
                            ".Input:focus": {
                              border: "1px solid #16a34a",
                              boxShadow: "0 0 0 3px rgba(22, 163, 74, 0.1)",
                            },
                            ".Label": {
                              fontSize: "13px",
                              fontWeight: "500",
                              color: "#374151",
                            },
                          },
                        },
                      } as StripeElementsOptions
                    }
                  >
                    <PaymentFormContent
                      booking={booking!}
                      onPaymentComplete={handlePaymentComplete}
                    />
                  </Elements>
                ) : (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-parkga-600" />
                  </div>
                )}
              </AccordionCard>

              {/* ═══════════════════════════════════════════════════════
                  3. VEHICLE INFO CARD
              ════════════════════════════════════════════════════════ */}
              <AccordionCard
                step={3}
                title="Vehicle details"
                isOpen={openSection === "vehicle"}
                onToggle={() => setOpenSection(openSection === "vehicle" ? "contact" : "vehicle")}
                isComplete={vehicleComplete}
                isDisabled={!paymentComplete}
              >
                {!paymentComplete ? (
                  <div className="py-4 text-center text-sm text-gray-400">
                    Please complete your payment first.
                  </div>
                ) : (
                  <div className="space-y-5">
                    <p className="text-sm text-gray-600">
                      Help the host identify your vehicle upon arrival. This
                      step is optional.
                    </p>

                    <div className="grid grid-cols-2 gap-3">
                      {/* Make */}
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1.5">
                          Make
                        </label>
                        <input
                          type="text"
                          value={vehicle.make}
                          onChange={(e) =>
                            setVehicle((v) => ({ ...v, make: e.target.value }))
                          }
                          placeholder="e.g. Honda"
                          className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 transition-colors focus:border-parkga-500 focus:outline-none focus:ring-2 focus:ring-parkga-500/20"
                        />
                      </div>

                      {/* Model */}
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1.5">
                          Model
                        </label>
                        <input
                          type="text"
                          value={vehicle.model}
                          onChange={(e) =>
                            setVehicle((v) => ({ ...v, model: e.target.value }))
                          }
                          placeholder="e.g. Civic"
                          className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 transition-colors focus:border-parkga-500 focus:outline-none focus:ring-2 focus:ring-parkga-500/20"
                        />
                      </div>

                      {/* Color */}
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1.5">
                          Color
                        </label>
                        <input
                          type="text"
                          value={vehicle.color}
                          onChange={(e) =>
                            setVehicle((v) => ({ ...v, color: e.target.value }))
                          }
                          placeholder="e.g. Silver"
                          className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 transition-colors focus:border-parkga-500 focus:outline-none focus:ring-2 focus:ring-parkga-500/20"
                        />
                      </div>

                      {/* License Plate */}
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1.5">
                          License plate
                        </label>
                        <input
                          type="text"
                          value={vehicle.licensePlate}
                          onChange={(e) =>
                            setVehicle((v) => ({
                              ...v,
                              licensePlate: e.target.value,
                            }))
                          }
                          placeholder="e.g. ABC 1234"
                          className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 transition-colors focus:border-parkga-500 focus:outline-none focus:ring-2 focus:ring-parkga-500/20"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Save vehicle info */}
                      <button
                        type="button"
                        onClick={handleVehicleSave}
                        className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-parkga-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-parkga-700"
                      >
                        <Check className="h-4 w-4" />
                        Save vehicle
                      </button>

                      {/* Skip */}
                      <button
                        type="button"
                        onClick={handleSkipVehicle}
                        className="flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                      >
                        Skip
                      </button>
                    </div>
                  </div>
                )}
              </AccordionCard>
            </div>

            {/* Security badge */}
            <div className="flex items-center justify-center gap-2 rounded-xl bg-white border border-gray-200 px-4 py-3 shadow-sm">
              <Shield className="h-4 w-4 shrink-0 text-brand-600" />
              <p className="text-xs text-slate-600">
                Your payment information is processed securely via{" "}
                <span className="font-semibold">Stripe</span>. We never store
                your full card details.
              </p>
            </div>
          </div>

          {/* ═══ RIGHT COLUMN: Sticky Order Summary ═══ */}
          <div className="lg:col-span-2">
            <div className="sticky top-24 space-y-4">
              {/* Order Summary Card */}
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                {/* Spot image */}
                {spot && spot.images && spot.images.length > 0 && (
                  <div className="relative h-40 w-full overflow-hidden bg-gray-100">
                    <Image
                      src={spot.images[0]}
                      alt={spot.title}
                      fill
                      className="object-cover"
                    />
                  </div>
                )}

                <div className="p-5">
                  {/* Spot Title */}
                  <h3 className="text-base font-bold text-gray-900">
                    {spot?.title ?? "Parking Spot"}
                  </h3>

                  {/* Star Rating */}
                  {avgRating !== null && (
                    <div className="mt-1.5 flex items-center gap-2">
                      <StarRatingDisplay rating={Math.round(avgRating)} />
                      <span className="text-xs text-gray-500">{avgRating}</span>
                    </div>
                  )}

                  {/* Address */}
                  {spot && (
                    <p className="mt-2 flex items-center gap-1 text-xs text-gray-500">
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span className="truncate">{spot.address}</span>
                    </p>
                  )}

                  {/* Reservation Period */}
                  {booking && (
                    <div className="mt-4 space-y-2 rounded-lg bg-gray-50 p-3">
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <Calendar className="h-3.5 w-3.5 text-gray-400" />
                        <span>
                          <span className="font-medium text-gray-900">
                            {formatDate(booking.start_time)}
                          </span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <Clock className="h-3.5 w-3.5 text-gray-400" />
                        <span>
                          <span className="font-medium text-gray-900">
                            {formatTime(booking.start_time)}
                          </span>
                          <span className="mx-1 text-gray-300">—</span>
                          <span className="font-medium text-gray-900">
                            {formatTime(booking.end_time)}
                          </span>
                        </span>
                      </div>
                      {spot && (
                        <div className="flex items-center gap-2 text-xs text-gray-600">
                          <Clock className="h-3.5 w-3.5 text-gray-400" />
                          <span>{getDuration(booking.start_time, booking.end_time)}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Brand checkmarks */}
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center gap-2 text-xs text-brand-700">
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100">
                        <Check className="h-3 w-3" />
                      </div>
                      <span>
                        Cancel until{" "}
                        <span className="font-medium">
                          {booking
                            ? getCancelDate(booking.start_time)
                            : "the day before"}
                        </span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-brand-700">
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100">
                        <Check className="h-3 w-3" />
                      </div>
                      <span>Easily change & extend in your dashboard</span>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="my-4 border-t border-gray-100" />

                  {/* Price Breakdown */}
                  <div className="space-y-2.5">
                    <div className="flex justify-between text-sm text-slate-600">
                      <span>Subtotal</span>
                      <span className="text-slate-900">
                        ${booking?.total_price.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm text-slate-400">
                      <span>Service fee</span>
                      <span>Included</span>
                    </div>
                    <div className="flex justify-between border-t border-gray-100 pt-2.5 text-base font-bold text-slate-900">
                      <span>Total</span>
                      <span>${booking?.total_price.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Trust badges */}
              <div className="space-y-2 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Shield className="h-3.5 w-3.5 text-brand-600" />
                  Secure checkout with Stripe
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Check className="h-3.5 w-3.5 text-brand-600" />
                  Free cancellation within 24 hours
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Check className="h-3.5 w-3.5 text-brand-600" />
                  24/7 customer support
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
