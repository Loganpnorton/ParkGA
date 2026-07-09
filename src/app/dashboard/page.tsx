"use client";

import { Suspense, useState, useEffect, useRef, FormEvent, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  Calendar,
  List,
  User,
  Loader2,
  Camera,
  Save,
  CreditCard,
  ExternalLink,
  CheckCircle,
  AlertCircle,
  MapPin,
  Clock,
  DollarSign,
  Car,
  Home,
  Plus,
  TrendingUp,
  Star,
  MessageSquare,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/supabase";

type Profile = Database["public"]["Tables"]["profiles"]["Row"] & {
  stripe_account_id?: string | null;
};

type Booking = Database["public"]["Tables"]["bookings"]["Row"] & {
  spot?: {
    title: string;
    address: string;
    price_per_hour: number | null;
    price_per_event: number | null;
    images: string[];
    host_id: string;
  };
};

type Spot = Database["public"]["Tables"]["spots"]["Row"] & {
  host_name?: string;
  bookings_count?: number;
};

type Tab = "bookings" | "listings" | "profile";

interface ReviewFormData {
  bookingId: string;
  spotId: string;
  spotTitle: string;
}

const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "bookings", label: "My Bookings", icon: Calendar },
  { id: "listings", label: "My Listings", icon: List },
  { id: "profile", label: "Profile", icon: User },
];

const statusColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  confirmed: "bg-blue-100 text-blue-700",
  active: "bg-green-100 text-green-700",
  completed: "bg-gray-100 text-gray-600",
  cancelled: "bg-red-100 text-red-700",
  refunded: "bg-purple-100 text-purple-700",
};

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

function DashboardInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<Tab>("bookings");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [stripeStatus, setStripeStatus] = useState<string | null>(null);

  // Data state
  const [myBookings, setMyBookings] = useState<Booking[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [myListings, setMyListings] = useState<Spot[]>([]);
  const [listingsLoading, setListingsLoading] = useState(true);

  // Profile form state
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Stripe onboarding state
  const [stripeOnboarding, setStripeOnboarding] = useState(false);
  const [stripeError, setStripeError] = useState<string | null>(null);

  // Read query params for Stripe return/refresh and tab
  useEffect(() => {
    const stripeParam = searchParams.get("stripe");
    if (stripeParam === "success") setStripeStatus("success");
    else if (stripeParam === "refresh") setStripeStatus("refresh");
    const tabParam = searchParams.get("tab");
    if (tabParam && (tabParam === "bookings" || tabParam === "listings" || tabParam === "profile")) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  // Check auth + fetch profile
  useEffect(() => {
    let cancelled = false;
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/auth/login"); return; }
      if (cancelled) return;

      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (data && !cancelled) {
        setProfile(data as Profile);
        setName(data.name ?? "");
        setPhone(data.phone ?? "");
        setAvatarUrl(data.avatar_url);
      }
      setSessionLoading(false);
      setLoading(false);
    }
    init();
    return () => { cancelled = true; };
  }, [router, supabase]);

  // Fetch bookings for the current user
  const fetchBookings = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("bookings")
      .select("*, spot:spot_id(title, address, price_per_hour, price_per_event, images, host_id)")
      .eq("guest_id", user.id)
      .in("status", ["confirmed", "active", "completed"])
      .order("start_time", { ascending: false });

    if (data) setMyBookings(data as unknown as Booking[]);
    setBookingsLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (sessionLoading) return;
    fetchBookings();

    // Real-time subscription for bookings
    const channel = supabase
      .channel("bookings-changes")
      .on("postgres_changes",
        { event: "*", schema: "public", table: "bookings" },
        () => { fetchBookings(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [sessionLoading, supabase, fetchBookings]);

  // Fetch host's listings
  const fetchListings = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("spots")
      .select("*")
      .eq("host_id", user.id)
      .order("created_at", { ascending: false });

    if (data) {
      // Fetch booking counts for each listing
      const spotsWithCounts = await Promise.all(
        data.map(async (spot) => {
          const { count } = await supabase
            .from("bookings")
            .select("*", { count: "exact", head: true })
            .eq("spot_id", spot.id)
            .in("status", ["confirmed", "active", "completed"]);
          return { ...spot, bookings_count: count ?? 0 };
        }),
      );
      setMyListings(spotsWithCounts);
    }
    setListingsLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (sessionLoading) return;
    fetchListings();

    const channel = supabase
      .channel("spots-changes")
      .on("postgres_changes",
        { event: "*", schema: "public", table: "spots" },
        () => { fetchListings(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [sessionLoading, supabase, fetchListings]);

  // Handle avatar file selection
  function handleAvatarSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/gif", "image/webp"].includes(file.type)) {
      setSaveError("Please select a JPEG, PNG, GIF, or WebP image.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setSaveError("Image must be under 2MB.");
      return;
    }
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setSaveError(null);
  }

  // Save profile
  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaveError("You must be signed in."); setSaving(false); return; }

    let newAvatarUrl = avatarUrl;
    if (avatarFile) {
      const fileExt = avatarFile.name.split(".").pop() ?? "jpg";
      const filePath = `${user.id}/avatar.${fileExt}`;
      if (avatarUrl) {
        const oldPath = avatarUrl.split("/").slice(-2).join("/");
        await supabase.storage.from("avatars").remove([oldPath]);
      }
      const { error: uploadError } = await supabase.storage.from("avatars").upload(filePath, avatarFile, { upsert: true });
      if (uploadError) { setSaveError(uploadError.message); setSaving(false); return; }
      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(filePath);
      newAvatarUrl = publicUrl;
    }

    const { error: updateError } = await supabase.from("profiles").update({
      name, phone: phone || null, avatar_url: newAvatarUrl, updated_at: new Date().toISOString(),
    }).eq("id", user.id);

    if (updateError) { setSaveError(updateError.message); setSaving(false); return; }

    setAvatarUrl(newAvatarUrl);
    setAvatarFile(null);
    setAvatarPreview(null);
    setProfile(prev => prev ? { ...prev, name, phone: phone || null, avatar_url: newAvatarUrl } : prev);
    setSaveSuccess(true);
    setSaving(false);
  }

  // Stripe onboarding
  async function handleStripeOnboard() {
    setStripeOnboarding(true);
    setStripeError(null);
    try {
      const res = await fetch("/api/stripe/onboard", { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setStripeError(data.error ?? "Failed to start Stripe onboarding."); setStripeOnboarding(false); return; }
      window.location.href = data.url;
    } catch {
      setStripeError("Network error. Please try again.");
      setStripeOnboarding(false);
    }
  }

  // Review modal state
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewForm, setReviewForm] = useState<ReviewFormData | null>(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewHoverRating, setReviewHoverRating] = useState(0);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewSuccess, setReviewSuccess] = useState(false);

  // Check if booking already has a review
  async function hasExistingReview(bookingId: string): Promise<boolean> {
    const { data } = await supabase
      .from("reviews")
      .select("id")
      .eq("booking_id", bookingId)
      .maybeSingle();
    return !!data;
  }

  // Open review modal
  async function openReviewModal(booking: Booking) {
    const alreadyReviewed = await hasExistingReview(booking.id);
    if (alreadyReviewed) {
      setReviewError("You have already reviewed this booking.");
      setTimeout(() => setReviewError(null), 3000);
      return;
    }
    setReviewForm({
      bookingId: booking.id,
      spotId: booking.spot_id,
      spotTitle: booking.spot?.title ?? "Parking Spot",
    });
    setReviewRating(0);
    setReviewComment("");
    setReviewError(null);
    setReviewSuccess(false);
    setReviewModalOpen(true);
  }

  // Submit review
  async function handleSubmitReview() {
    if (!reviewForm || reviewRating === 0) return;
    setReviewSubmitting(true);
    setReviewError(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setReviewError("You must be signed in.");
      setReviewSubmitting(false);
      return;
    }

    const { error } = await supabase.from("reviews").insert({
      booking_id: reviewForm.bookingId,
      guest_id: user.id,
      spot_id: reviewForm.spotId,
      rating: reviewRating,
      comment: reviewComment.trim() || null,
    });

    if (error) {
      setReviewError(error.message);
      setReviewSubmitting(false);
      return;
    }

    setReviewSuccess(true);
    setReviewSubmitting(false);
    setTimeout(() => {
      setReviewModalOpen(false);
      fetchBookings();
    }, 1500);
  }

  // Cancel booking
  async function handleCancelBooking(bookingId: string) {
    const { error } = await supabase
      .from("bookings")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", bookingId)
      .eq("status", "pending"); // only pending bookings can be cancelled

    if (!error) fetchBookings();
  }

  if (sessionLoading || loading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-parkga-600" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">Manage your bookings, listings, and profile</p>
        </div>
      </div>

      {stripeStatus === "success" && (
        <div className="mb-6 flex items-center gap-2 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
          <CheckCircle className="h-4 w-4" /> Stripe account connected successfully! You can now receive payouts.
        </div>
      )}
      {stripeStatus === "refresh" && (
        <div className="mb-6 flex items-center gap-2 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">
          <AlertCircle className="h-4 w-4" /> Onboarding was interrupted. Please connect your Stripe account below.
        </div>
      )}

      <div className="mb-8 border-b border-gray-200">
        <nav className="-mb-px flex gap-6">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 border-b-2 px-1 pb-3 text-sm font-medium transition-colors ${
                  isActive ? "border-parkga-600 text-parkga-600" : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                }`}>
                <Icon className="h-4 w-4" /> {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* ═══ MY BOOKINGS (Guest) ═══ */}
      {activeTab === "bookings" && (
        <div>
          {bookingsLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-parkga-600" /></div>
          ) : myBookings.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center shadow-sm">
              <Calendar className="mx-auto h-12 w-12 text-gray-300" />
              <h3 className="mt-4 text-lg font-semibold text-gray-900">No bookings yet</h3>
              <p className="mt-2 text-sm text-gray-500">Find a parking spot and book your first trip.</p>
              <Link href="/listings" className="mt-6 inline-flex rounded-lg bg-parkga-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-parkga-700">
                Browse spots
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Summary cards */}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {[
                  { label: "Upcoming", count: myBookings.filter(b => ["pending", "confirmed"].includes(b.status)).length, color: "text-blue-600", bg: "bg-blue-50" },
                  { label: "Active", count: myBookings.filter(b => b.status === "active").length, color: "text-green-600", bg: "bg-green-50" },
                  { label: "Completed", count: myBookings.filter(b => b.status === "completed").length, color: "text-gray-600", bg: "bg-gray-50" },
                  { label: "Cancelled", count: myBookings.filter(b => b.status === "cancelled").length, color: "text-red-600", bg: "bg-red-50" },
                ].map(stat => (
                  <div key={stat.label} className={`rounded-xl border border-gray-200 ${stat.bg} p-4`}>
                    <p className={`text-2xl font-bold ${stat.color}`}>{stat.count}</p>
                    <p className="text-xs text-gray-500">{stat.label}</p>
                  </div>
                ))}
              </div>

              {/* Booking list */}
              {myBookings.map((booking) => {
                const isUpcoming = ["pending", "confirmed"].includes(booking.status);
                const isPast = ["completed", "cancelled", "refunded"].includes(booking.status);
                return (
                  <div key={booking.id} className={`rounded-xl border p-4 transition-shadow hover:shadow-sm ${
                    isPast ? "border-gray-100 bg-gray-50" : "border-gray-200 bg-white"
                  }`}>
                    <div className="flex items-start gap-4">
                      {/* Thumbnail */}
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100">
                        {booking.spot?.images && booking.spot.images.length > 0 ? (
                          <Image src={booking.spot.images[0]} alt={booking.spot?.title ?? ""} width={64} height={64} className="h-full w-full object-cover" />
                        ) : (
                          <Car className="h-6 w-6 text-gray-300" />
                        )}
                      </div>
                      {/* Details */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="text-sm font-semibold text-gray-900">{booking.spot?.title ?? "Parking Spot"}</h4>
                            <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
                              <MapPin className="h-3 w-3" />
                              {booking.spot?.address ?? ""}
                            </p>
                          </div>
                          <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusColors[booking.status] ?? "bg-gray-100 text-gray-600"}`}>
                            {booking.status}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDate(booking.start_time)} · {formatTime(booking.start_time)} – {formatTime(booking.end_time)}
                          </span>
                          <span className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3" />
                            ${Number(booking.total_price).toFixed(2)} total
                          </span>
                        </div>
                      </div>
                    </div>
                    {/* Actions */}
                    <div className="mt-3 flex items-center gap-2 border-t border-gray-100 pt-3">
                      {isUpcoming && (
                        <>
                          <Link href={`/listings/${booking.spot_id}`} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50">
                            View Spot
                          </Link>
                          {booking.status === "pending" && (
                            <button onClick={() => handleCancelBooking(booking.id)}
                              className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50">
                              Cancel
                            </button>
                          )}
                        </>
                      )}
                      {(booking.status === "completed" || (booking.status === "confirmed" && new Date(booking.end_time) < new Date())) && (
                        <button onClick={() => openReviewModal(booking)}
                          className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-100">
                          <Star className="h-3 w-3" />
                          Leave a Review
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══ MY LISTINGS (Host) ═══ */}
      {activeTab === "listings" && (
        <div>
          {/* Stripe Connect Warning */}
          {profile && !profile.stripe_account_id && (
            <div className="mb-6 rounded-xl border-2 border-amber-300 bg-amber-50 p-5 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100">
                  <AlertCircle className="h-5 w-5 text-amber-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-amber-800">
                    ⚠️ Connect Stripe to receive payments
                  </h3>
                  <p className="mt-1 text-sm text-amber-700">
                    You need to connect a Stripe account before you can publish
                    listings and receive payouts. Guests won't be able to book
                    your spots until this is set up.
                  </p>
                  <button
                    type="button"
                    onClick={handleStripeOnboard}
                    disabled={stripeOnboarding}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {stripeOnboarding ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ExternalLink className="h-4 w-4" />
                    )}
                    Connect with Stripe
                  </button>
                  {stripeError && (
                    <p className="mt-2 flex items-center gap-1 text-xs text-red-600">
                      <AlertCircle className="h-3 w-3" />
                      {stripeError}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="mb-6 flex items-center justify-between">
            <p className="text-sm text-gray-500">{myListings.length} listing{myListings.length !== 1 ? "s" : ""}</p>
            <Link href="/host/new"
              className="inline-flex items-center gap-1.5 rounded-lg bg-parkga-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-parkga-700">
              <Plus className="h-4 w-4" /> New Listing
            </Link>
          </div>

          {listingsLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-parkga-600" /></div>
          ) : myListings.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center shadow-sm">
              <Home className="mx-auto h-12 w-12 text-gray-300" />
              <h3 className="mt-4 text-lg font-semibold text-gray-900">No listings yet</h3>
              <p className="mt-2 text-sm text-gray-500">List a parking space to start earning.</p>
              <Link href="/host/new" className="mt-6 inline-flex rounded-lg bg-parkga-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-parkga-700">
                Create your first listing
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Earnings summary */}
              <div className="rounded-xl border border-gray-200 bg-gradient-to-r from-parkga-50 to-white p-4">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <TrendingUp className="h-4 w-4 text-parkga-600" />
                  <span>Total bookings across all listings: <strong className="text-gray-900">{myListings.reduce((sum, l) => sum + (l.bookings_count ?? 0), 0)}</strong></span>
                </div>
              </div>

              {myListings.map((spot) => (
                <div key={spot.id} className="rounded-xl border border-gray-200 bg-white p-4 transition-shadow hover:shadow-sm">
                  <div className="flex items-start gap-4">
                    {/* Thumbnail */}
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100">
                      {spot.images && spot.images.length > 0 ? (
                        <Image src={spot.images[0]} alt={spot.title} width={64} height={64} className="h-full w-full object-cover" />
                      ) : (
                        <Car className="h-6 w-6 text-gray-300" />
                      )}
                    </div>
                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="text-sm font-semibold text-gray-900">{spot.title}</h4>
                          <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
                            <MapPin className="h-3 w-3" />
                            {spot.address}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          {spot.price_per_hour && (
                            <p className="text-sm font-bold text-parkga-600">${spot.price_per_hour}<span className="text-xs font-normal text-gray-500">/hr</span></p>
                          )}
                          <p className="mt-0.5 text-xs text-gray-400">
                            {spot.bookings_count ?? 0} booking{(spot.bookings_count ?? 0) !== 1 ? "s" : ""}
                          </p>
                        </div>
                      </div>
                      {/* Feature chips */}
                      {(spot.features && typeof spot.features === 'object' && Object.keys(spot.features).length > 0) && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {Object.entries(spot.features as Record<string, boolean>).filter(([, v]) => v).slice(0, 3).map(([k]) => (
                            <span key={k} className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
                              {k.replace(/_/g, " ")}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2 border-t border-gray-100 pt-3">
                    <Link href={`/listings/${spot.id}`} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50">
                      View
                    </Link>
                    <Link href={`/host/new`} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50">
                      Edit
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ PROFILE ═══ */}
      {activeTab === "profile" && (
        <div className="space-y-6">
          {/* Stripe Connect Section */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
                <CreditCard className="h-5 w-5 text-purple-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-gray-900">Stripe Connect — Receive Payouts</h3>
                <p className="mt-0.5 text-xs text-gray-500">
                  {profile?.stripe_account_id
                    ? "Your Stripe account is linked."
                    : "Link your Stripe account to receive payouts."}
                </p>
              </div>
              <button type="button" onClick={handleStripeOnboard} disabled={stripeOnboarding}
                className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50">
                {stripeOnboarding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5" />}
                {profile?.stripe_account_id ? "Manage Payouts" : "Connect with Stripe"}
              </button>
            </div>
            {stripeError && <p className="mt-3 flex items-center gap-1 text-xs text-red-600"><AlertCircle className="h-3 w-3" />{stripeError}</p>}
          </div>

          {/* Profile Form */}
          <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
            <form onSubmit={handleSave} className="space-y-8">
              <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
                <div className="relative">
                  <div className="h-24 w-24 overflow-hidden rounded-full border-2 border-gray-200 bg-gray-100">
                    {(avatarPreview || avatarUrl) && (
                      <Image src={avatarPreview ?? avatarUrl!} alt="Profile avatar" width={96} height={96} className="h-full w-full object-cover" />
                    )}
                    {!avatarPreview && !avatarUrl && (
                      <div className="flex h-full w-full items-center justify-center"><User className="h-10 w-10 text-gray-400" /></div>
                    )}
                  </div>
                  <button type="button" onClick={() => fileInputRef.current?.click()}
                    className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-parkga-600 text-white shadow-sm transition-colors hover:bg-parkga-700"
                    aria-label="Change avatar">
                    <Camera className="h-4 w-4" />
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden" onChange={handleAvatarSelect} />
                </div>
                <div className="text-center sm:text-left">
                  <h3 className="text-lg font-semibold text-gray-900">Profile Photo</h3>
                  <p className="mt-1 text-sm text-gray-500">JPEG, PNG, GIF, or WebP. Max 2MB.</p>
                  {avatarFile && (
                    <button type="button" onClick={() => { setAvatarFile(null); setAvatarPreview(null); }} className="mt-2 text-sm font-medium text-red-600 hover:text-red-700">Remove</button>
                  )}
                </div>
              </div>

              {saveSuccess && <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">Profile updated successfully.</div>}
              {saveError && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{saveError}</div>}

              <div>
                <label htmlFor="profile-name" className="block text-sm font-medium text-gray-700">Full name</label>
                <input id="profile-name" type="text" required value={name} onChange={(e) => setName(e.target.value)}
                  className="mt-1.5 block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 transition-colors focus:border-parkga-500 focus:outline-none focus:ring-2 focus:ring-parkga-500/20" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <input type="email" disabled className="mt-1.5 block w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-gray-500" placeholder="Email linked to your account" />
                <p className="mt-1 text-xs text-gray-400">Email is managed through your authentication provider.</p>
              </div>

              <div>
                <label htmlFor="profile-phone" className="block text-sm font-medium text-gray-700">Phone number</label>
                <input id="profile-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 (555) 123-4567"
                  className="mt-1.5 block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 transition-colors focus:border-parkga-500 focus:outline-none focus:ring-2 focus:ring-parkga-500/20" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Account type</label>
                <div className="mt-1.5">
                  <span className="inline-flex items-center rounded-full bg-parkga-100 px-3 py-1 text-sm font-medium text-parkga-700">
                    Member
                  </span>
                </div>
              </div>

              <div className="flex justify-end border-t border-gray-100 pt-6">
                <button type="submit" disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-parkga-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-parkga-700 disabled:cursor-not-allowed disabled:opacity-50">
                  {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : <><Save className="h-4 w-4" /> Save changes</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══ REVIEW MODAL ═══ */}
      {reviewModalOpen && reviewForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Leave a Review</h3>
              <button type="button" onClick={() => setReviewModalOpen(false)}
                className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-1 text-sm text-gray-500">{reviewForm.spotTitle}</p>

            {/* Error */}
            {reviewError && (
              <div className="mt-4 flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {reviewError}
              </div>
            )}

            {/* Success */}
            {reviewSuccess && (
              <div className="mt-4 flex items-center gap-2 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
                <CheckCircle className="h-4 w-4" />
                Review submitted! Thank you.
              </div>
            )}

            {!reviewSuccess && (
              <>
                {/* Star Rating */}
                <div className="mt-5">
                  <label className="text-sm font-medium text-gray-700">Rating</label>
                  <div className="mt-2 flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setReviewRating(star)}
                        onMouseEnter={() => setReviewHoverRating(star)}
                        onMouseLeave={() => setReviewHoverRating(0)}
                        className="p-0.5 transition-transform hover:scale-110"
                      >
                        <Star
                          className={`h-7 w-7 ${
                            (reviewHoverRating || reviewRating) >= star
                              ? "fill-amber-400 text-amber-400"
                              : "text-gray-300"
                          }`}
                        />
                      </button>
                    ))}
                    <span className="ml-2 text-xs text-gray-400">
                      {reviewRating > 0
                        ? ["", "Poor", "Fair", "Good", "Very Good", "Excellent"][reviewRating]
                        : "Click to rate"}
                    </span>
                  </div>
                </div>

                {/* Comment */}
                <div className="mt-4">
                  <label htmlFor="review-comment" className="text-sm font-medium text-gray-700">Comment <span className="text-gray-400">(optional)</span></label>
                  <textarea
                    id="review-comment"
                    rows={3}
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    placeholder="Share your experience..."
                    maxLength={500}
                    className="mt-1.5 block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 transition-colors focus:border-parkga-500 focus:outline-none focus:ring-2 focus:ring-parkga-500/20"
                  />
                  <p className="mt-1 text-right text-[10px] text-gray-400">{reviewComment.length}/500</p>
                </div>

                {/* Submit */}
                <div className="mt-5 flex justify-end gap-3 border-t border-gray-100 pt-4">
                  <button
                    type="button"
                    onClick={() => setReviewModalOpen(false)}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmitReview}
                    disabled={reviewRating === 0 || reviewSubmitting}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {reviewSubmitting ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Submitting...</>
                    ) : (
                      <><Star className="h-4 w-4" /> Submit Review</>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[calc(100vh-4rem)] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-parkga-600" /></div>}>
      <DashboardInner />
    </Suspense>
  );
}