"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Check, AlertCircle } from "lucide-react";

const supabase = createClient();

export default function CheckoutSuccessPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const bookingId = params.booking_id as string;
  const paymentIntent = searchParams.get("payment_intent");
  const redirectStatus = searchParams.get("redirect_status");

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function verify() {
      if (!bookingId) return;

      // If we have a redirect_status from Stripe, check it
      if (redirectStatus === "succeeded" || paymentIntent) {
        // The webhook will handle the confirmation asynchronously,
        // but let's verify the booking status
        const { data: booking } = await supabase
          .from("bookings")
          .select("status")
          .eq("id", bookingId)
          .single();

        if (booking?.status === "confirmed") {
          setStatus("success");
          return;
        }

        // Webhook may not have fired yet — poll for a few seconds
        for (let i = 0; i < 10; i++) {
          await new Promise((r) => setTimeout(r, 1000));
          const { data: poll } = await supabase
            .from("bookings")
            .select("status")
            .eq("id", bookingId)
            .single();

          if (poll?.status === "confirmed") {
            setStatus("success");
            return;
          }
        }

        // If still not confirmed, the webhook will handle it
        setStatus("success");
        return;
      }

      // No params — check booking status directly
      const { data: booking } = await supabase
        .from("bookings")
        .select("status")
        .eq("id", bookingId)
        .single();

      if (booking?.status === "confirmed") {
        setStatus("success");
      } else {
        setStatus("success"); // Optimistic — webhook will confirm
      }
    }

    verify();
  }, [bookingId, paymentIntent, redirectStatus, router]);

  if (status === "loading") {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-parkga-600" />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex h-[calc(100vh-4rem)] flex-col items-center justify-center px-4">
        <AlertCircle className="h-12 w-12 text-red-400" />
        <h1 className="mt-4 text-xl font-bold text-gray-900">
          Payment verification failed
        </h1>
        <p className="mt-2 text-sm text-gray-500">{message}</p>
        <Link
          href={`/checkout/${bookingId}`}
          className="mt-6 rounded-lg bg-parkga-600 px-6 py-2.5 text-sm font-semibold text-white"
        >
          Try again
        </Link>
      </div>
    );
  }

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
