"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  MapPin,
  Clock,
  DollarSign,
  Car,
  Star,
  User,
  ChevronLeft,
  Loader2,
  Calendar,
  Shield,
  Check,
  Send,
  AlertCircle,
  Navigation,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import "mapbox-gl/dist/mapbox-gl.css";

// Dynamic Map (SSR disabled)
const Map = dynamic(
  () => import("react-map-gl/mapbox").then((mod) => mod.default),
  { ssr: false },
);
const Marker = dynamic(
  () => import("react-map-gl/mapbox").then((mod) => mod.Marker),
  { ssr: false },
);

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

// ─── Types ─────────────────────────────────────────────────────────────
interface Spot {
  id: string;
  host_id: string;
  title: string;
  description: string;
  address: string;
  lat: number;
  lng: number;
  price_per_hour: number | null;
  price_per_event: number | null;
  features: Record<string, boolean>;
  images: string[];
  created_at: string;
}

interface Review {
  id: string;
  guest_id: string;
  rating: number;
  comment: string;
  created_at: string;
  guest_name?: string;
}

interface HostProfile {
  name: string | null;
  avatar_url: string | null;
  phone: string | null;
  created_at: string;
}

const featureLabels: Record<string, string> = {
  covered: "Covered Parking",
  secure: "Security Camera",
  ev_charger: "EV Charger",
  "247_access": "24/7 Access",
  handicap: "Handicap Accessible",
  oversize: "Oversize Vehicle",
  lighting: "Well Lit",
  gate: "Gated Entry",
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ─── Star Rating ───────────────────────────────────────────────────────
function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`h-3.5 w-3.5 ${
            star <= rating ? "fill-amber-400 text-amber-400" : "text-gray-300"
          }`}
        />
      ))}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────
export default function SpotDetailPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();
  const id = params.id as string;

  const [spot, setSpot] = useState<Spot | null>(null);
  const [host, setHost] = useState<HostProfile | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [selectedImage, setSelectedImage] = useState(0);

  // Booking widget state
  const [bookingMode, setBookingMode] = useState<"hourly" | "event">("hourly");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  const [bookError, setBookError] = useState<string | null>(null);
  const [booking, setBooking] = useState(false);
  const [bookSuccess, setBookSuccess] = useState(false);

  // ── Fetch data ───────────────────────────────────────────────────
  useEffect(() => {
    async function fetchData() {
      if (!id) return;

      // Fetch spot + host in parallel
      const { data: spotData, error: spotError } = await supabase
        .from("spots")
        .select("*")
        .eq("id", id)
        .single();

      if (spotError || !spotData) {
        router.push("/listings");
        return;
      }

      setSpot(spotData as Spot);

      // Fetch host profile
      const { data: hostData } = await supabase
        .from("profiles")
        .select("name, avatar_url, phone, created_at")
        .eq("id", (spotData as Spot).host_id)
        .single();
      setHost(hostData);

      // Fetch reviews + guest names
      const { data: reviewData } = await supabase
        .from("reviews")
        .select("*")
        .eq("spot_id", id)
        .order("created_at", { ascending: false });

      if (reviewData && reviewData.length > 0) {
        const guestIds = [...new Set(reviewData.map((r) => r.guest_id))];
        const { data: guestProfiles } = await supabase
          .from("profiles")
          .select("id, name")
          .in("id", guestIds);

        const nameMap: Record<string, string> = {};
        if (guestProfiles) {
          guestProfiles.forEach((p) => {
            nameMap[p.id] = p.name ?? "Anonymous";
          });
        }

        setReviews(
          reviewData.map((r) => ({
            ...r,
            guest_name: nameMap[r.guest_id] ?? "Anonymous",
          })),
        );
      }

      setLoading(false);
    }

    fetchData();
  }, [id, supabase, router]);

  // ── Price calculation ────────────────────────────────────────────
  const totalPrice = useMemo(() => {
    if (bookingMode === "event") {
      return spot?.price_per_event ?? 0;
    }

    if (!startDate || !endDate || !spot?.price_per_hour) return 0;

    const start = new Date(`${startDate}T${startTime || "00:00"}`);
    const end = new Date(`${endDate}T${endTime || "23:59"}`);

    if (start >= end) return 0;

    const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    return Math.max(0, Math.round(hours * spot.price_per_hour * 100) / 100);
  }, [bookingMode, startDate, startTime, endDate, endTime, spot]);

  const totalHours = useMemo(() => {
    if (bookingMode !== "hourly" || !startDate || !endDate) return 0;
    const start = new Date(`${startDate}T${startTime || "00:00"}`);
    const end = new Date(`${endDate}T${endTime || "23:59"}`);
    if (start >= end) return 0;
    return Math.round(((end.getTime() - start.getTime()) / (1000 * 60 * 60)) * 10) / 10;
  }, [bookingMode, startDate, startTime, endDate, endTime]);

  // ── Book handler ─────────────────────────────────────────────────
  async function handleBook() {
    setBookError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/auth/login");
      return;
    }

    if (bookingMode === "hourly" && (!startDate || !endDate)) {
      setBookError("Please select start and end times.");
      return;
    }

    setBooking(true);

    const p_start =
      bookingMode === "hourly"
        ? `${startDate}T${startTime || "00:00"}:00Z`
        : new Date().toISOString();
    const p_end =
      bookingMode === "hourly"
        ? `${endDate}T${endTime || "23:59"}:00Z`
        : new Date().toISOString();

    if (bookingMode === "hourly" && new Date(p_start) >= new Date(p_end)) {
      setBookError("End time must be after start time.");
      setBooking(false);
      return;
    }

    // Check availability
    const { data: available } = await supabase.rpc("get_available_spots", {
      p_start_time: p_start,
      p_end_time: p_end,
    });

    if (!available || !Array.isArray(available) || available.length === 0) {
      setBookError("This spot is not available during the selected time.");
      setBooking(false);
      return;
    }

    // Insert booking
    const { error: bookErr } = await supabase.from("bookings").insert({
      spot_id: id,
      guest_id: user.id,
      start_time: p_start,
      end_time: p_end,
      total_price: totalPrice,
      status: "pending",
    });

    if (bookErr) {
      setBookError(bookErr.message);
      setBooking(false);
      return;
    }

    setBookSuccess(true);
    setBooking(false);
  }

  // ── Loading ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-parkga-600" />
      </div>
    );
  }

  if (!spot) {
    return (
      <div className="flex h-[calc(100vh-4rem)] flex-col items-center justify-center px-4">
        <MapPin className="h-12 w-12 text-gray-300" />
        <h1 className="mt-4 text-xl font-bold text-gray-900">Spot not found</h1>
        <Link
          href="/listings"
          className="mt-4 rounded-lg bg-parkga-600 px-6 py-2.5 text-sm font-semibold text-white"
        >
          Browse spots
        </Link>
      </div>
    );
  }

  const hasHourly = spot.price_per_hour !== null;
  const hasEvent = spot.price_per_event !== null;
  const featureEntries = Object.entries(spot.features).filter(
    ([, v]) => v,
  );
  const avgRating =
    reviews.length > 0
      ? Math.round(
          (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length) * 10,
        ) / 10
      : null;

  // ── Success ──────────────────────────────────────────────────────
  if (bookSuccess) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-parkga-100">
            <Check className="h-8 w-8 text-parkga-600" />
          </div>
          <h1 className="mt-6 text-3xl font-bold tracking-tight text-gray-900">
            Booking Requested!
          </h1>
          <p className="mt-3 text-sm text-gray-600">
            Your booking for{" "}
            <span className="font-semibold">{spot.title}</span> has been
            submitted. Check your dashboard for updates.
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
              Browse More
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ─── Render ─────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Back link */}
      <Link
        href="/listings"
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-parkga-600"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to listings
      </Link>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* ── Left Column: Images + Details + Reviews ─────────────── */}
        <div className="lg:col-span-2 space-y-8">
          {/* Image Gallery */}
          <div>
            <div className="relative aspect-video overflow-hidden rounded-2xl bg-gray-100">
              {spot.images && spot.images.length > 0 ? (
                <Image
                  src={spot.images[selectedImage]}
                  alt={spot.title}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <Car className="h-16 w-16 text-gray-300" />
                </div>
              )}
            </div>
            {spot.images && spot.images.length > 1 && (
              <div className="mt-3 flex gap-2 overflow-x-auto">
                {spot.images.map((img, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setSelectedImage(i)}
                    className={`relative h-16 w-24 shrink-0 overflow-hidden rounded-lg border-2 ${
                      i === selectedImage
                        ? "border-parkga-500"
                        : "border-transparent"
                    }`}
                  >
                    <Image
                      src={img}
                      alt={`Photo ${i + 1}`}
                      fill
                      className="object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Spot Title & Info */}
          <div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
                  {spot.title}
                </h1>
                <p className="mt-1 flex items-center gap-1 text-sm text-gray-500">
                  <MapPin className="h-4 w-4" />
                  {spot.address}
                </p>
              </div>
              <div className="shrink-0 text-right">
                {hasHourly && (
                  <p className="text-2xl font-bold text-parkga-600">
                    ${spot.price_per_hour}
                    <span className="text-sm font-normal text-gray-500">/hr</span>
                  </p>
                )}
                {hasEvent && (
                  <p className="text-sm text-gray-500">
                    ${spot.price_per_event}
                    <span className="text-gray-400">/event</span>
                  </p>
                )}
              </div>
            </div>

            {/* Rating */}
            {avgRating && (
              <div className="mt-3 flex items-center gap-2">
                <StarRating rating={Math.round(avgRating)} />
                <span className="text-sm text-gray-500">
                  {avgRating} ({reviews.length} review{reviews.length !== 1 ? "s" : ""})
                </span>
              </div>
            )}
          </div>

          {/* Host */}
          {host && (
            <div className="rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-gray-100">
                  {host.avatar_url ? (
                    <Image
                      src={host.avatar_url}
                      alt={host.name ?? "Host"}
                      width={48}
                      height={48}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <User className="h-6 w-6 text-gray-400" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    Hosted by {host.name ?? "Anonymous"}
                  </p>
                  <p className="text-xs text-gray-500">
                    Member since {formatDate(host.created_at)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Description */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              About this spot
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">
              {spot.description}
            </p>
          </div>

          {/* Features */}
          {featureEntries.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Features & Amenities
              </h2>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {featureEntries.map(([key]) => (
                  <div
                    key={key}
                    className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2"
                  >
                    <Check className="h-4 w-4 text-parkga-600" />
                    <span className="text-sm text-gray-700">
                      {featureLabels[key] ?? key.replace(/_/g, " ")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Location Map */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Location</h2>
            <div className="mt-3 overflow-hidden rounded-xl border border-gray-200">
              <div className="h-[250px] w-full">
                {MAPBOX_TOKEN &&
                MAPBOX_TOKEN !== "your_mapbox_token_here" ? (
                  <Map
                    mapboxAccessToken={MAPBOX_TOKEN}
                    initialViewState={{
                      latitude: spot.lat,
                      longitude: spot.lng,
                      zoom: 15,
                    }}
                    style={{ width: "100%", height: "100%" }}
                    mapStyle="mapbox://styles/mapbox/streets-v12"
                    onLoad={() => setMapLoaded(true)}
                    attributionControl={false}
                  >
                    {mapLoaded && (
                      <Marker
                        longitude={spot.lng}
                        latitude={spot.lat}
                        anchor="bottom"
                      >
                        <MapPin className="h-8 w-8 text-parkga-600 drop-shadow-md" />
                      </Marker>
                    )}
                  </Map>
                ) : (
                  <div className="flex h-full items-center justify-center bg-gray-50 text-sm text-gray-400">
                    Map requires a Mapbox token
                  </div>
                )}
              </div>
              <div className="border-t border-gray-200 px-4 py-2">
                <p className="flex items-center gap-1 text-xs text-gray-500">
                  <Navigation className="h-3 w-3" />
                  {spot.address}
                </p>
              </div>
            </div>
          </div>

          {/* Reviews */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Reviews
              {reviews.length > 0 && (
                <span className="ml-2 text-sm font-normal text-gray-500">
                  ({reviews.length})
                </span>
              )}
            </h2>
            {reviews.length === 0 ? (
              <div className="mt-4 rounded-xl border border-gray-200 p-8 text-center">
                <Star className="mx-auto h-8 w-8 text-gray-300" />
                <p className="mt-2 text-sm text-gray-500">No reviews yet</p>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                {reviews.map((review) => (
                  <div
                    key={review.id}
                    className="rounded-xl border border-gray-200 p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100">
                          <User className="h-4 w-4 text-gray-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {review.guest_name}
                          </p>
                          <p className="text-[10px] text-gray-400">
                            {formatDate(review.created_at)}
                          </p>
                        </div>
                      </div>
                      <StarRating rating={review.rating} />
                    </div>
                    <p className="mt-3 text-sm text-gray-600">
                      {review.comment}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Right Column: Sticky Booking Widget ─────────────────── */}
        <div className="lg:col-span-1">
          <div className="sticky top-24 space-y-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-bold text-gray-900">
                ${" "}
                {bookingMode === "hourly" && spot.price_per_hour
                  ? spot.price_per_hour
                  : spot.price_per_event}
                <span className="text-sm font-normal text-gray-500">
                  {bookingMode === "hourly" ? "/hour" : "/event"}
                </span>
              </h3>

              {/* Mode toggle */}
              {hasHourly && hasEvent && (
                <div className="mt-4 flex rounded-lg border border-gray-200 p-0.5">
                  <button
                    type="button"
                    onClick={() => setBookingMode("hourly")}
                    className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                      bookingMode === "hourly"
                        ? "bg-parkga-600 text-white"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    Hourly
                  </button>
                  <button
                    type="button"
                    onClick={() => setBookingMode("event")}
                    className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                      bookingMode === "event"
                        ? "bg-parkga-600 text-white"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    Event
                  </button>
                </div>
              )}

              {/* Hourly booking inputs */}
              {bookingMode === "hourly" && (
                <div className="mt-5 space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-medium text-gray-500">
                        From
                      </label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="mt-0.5 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs text-gray-900 focus:border-parkga-500 focus:outline-none focus:ring-1 focus:ring-parkga-500/20"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-medium text-gray-500">
                        Time
                      </label>
                      <input
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="mt-0.5 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs text-gray-900 focus:border-parkga-500 focus:outline-none focus:ring-1 focus:ring-parkga-500/20"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-medium text-gray-500">
                        To
                      </label>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="mt-0.5 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs text-gray-900 focus:border-parkga-500 focus:outline-none focus:ring-1 focus:ring-parkga-500/20"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-medium text-gray-500">
                        Time
                      </label>
                      <input
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className="mt-0.5 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs text-gray-900 focus:border-parkga-500 focus:outline-none focus:ring-1 focus:ring-parkga-500/20"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Event booking info */}
              {bookingMode === "event" && (
                <div className="mt-5 rounded-lg bg-parkga-50 px-4 py-3">
                  <p className="text-xs text-parkga-700">
                    <Calendar className="mr-1 inline h-3 w-3" />
                    Ideal for game days and concerts. One flat price covers
                    the full event duration.
                  </p>
                </div>
              )}

              {/* Price breakdown */}
              {bookingMode === "hourly" && totalHours > 0 && (
                <div className="mt-5 space-y-2 border-t border-gray-100 pt-4">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>
                      ${spot.price_per_hour} x {totalHours} hrs
                    </span>
                    <span>${totalPrice.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-400">
                    <span>Service fee</span>
                    <span>Included</span>
                  </div>
                  <div className="flex justify-between border-t border-gray-100 pt-2 text-base font-bold text-gray-900">
                    <span>Total</span>
                    <span>${totalPrice.toFixed(2)}</span>
                  </div>
                </div>
              )}

              {bookingMode === "event" && (
                <div className="mt-5 space-y-2 border-t border-gray-100 pt-4">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Event rate</span>
                    <span>${spot.price_per_event}</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-400">
                    <span>Service fee</span>
                    <span>Included</span>
                  </div>
                  <div className="flex justify-between border-t border-gray-100 pt-2 text-base font-bold text-gray-900">
                    <span>Total</span>
                    <span>${spot.price_per_event}</span>
                  </div>
                </div>
              )}

              {/* Error */}
              {bookError && (
                <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  {bookError}
                </div>
              )}

              {/* Book button */}
              <button
                type="button"
                onClick={handleBook}
                disabled={
                  booking ||
                  (bookingMode === "hourly" && (!startDate || !endDate))
                }
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-parkga-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-parkga-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {booking ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Booking...
                  </>
                ) : (
                  <>
                    <Calendar className="h-4 w-4" />
                    {bookingMode === "event"
                      ? "Book Event"
                      : totalPrice > 0
                        ? `Book — $${totalPrice.toFixed(2)}`
                        : "Select time to book"}
                  </>
                )}
              </button>

              {/* Trust badges */}
              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2 text-[11px] text-gray-500">
                  <Shield className="h-3.5 w-3.5 text-parkga-600" />
                  Secure payment with Stripe
                </div>
                <div className="flex items-center gap-2 text-[11px] text-gray-500">
                  <Check className="h-3.5 w-3.5 text-parkga-600" />
                  Free cancellation within 24 hours
                </div>
              </div>
            </div>

            {/* Quick stats */}
            <div className="rounded-xl border border-gray-200 p-4">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Quick Info
              </h4>
              <div className="mt-3 space-y-2">
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <MapPin className="h-4 w-4 text-gray-400" />
                  {spot.address}
                </div>
                {host?.phone && (
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <User className="h-4 w-4 text-gray-400" />
                    {host.phone}
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <Clock className="h-4 w-4 text-gray-400" />
                  Listed {formatDate(spot.created_at)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}