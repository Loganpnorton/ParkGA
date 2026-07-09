"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Star, ChevronLeft, ChevronRight } from "lucide-react";

/* ── Types ────────────────────────────────────────────────────────────── */
export interface TrendingSpot {
  id: string;
  title: string;
  address: string;
  price_per_hour: number | null;
  price_per_event: number | null;
  images: string[];
  avg_rating: number | null;
  review_count: number;
}

/* ── Fallback Images ──────────────────────────────────────────────────── */
const FALLBACK_IMAGES = [
  "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=600&q=80",
  "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=600&q=80",
  "https://images.unsplash.com/photo-1506521781265-d8422e82f816?w=600&q=80",
];

/** Force every spot to have an image — DB empty arrays get fallbacks.     */
export function enforceSpotImages(spots: TrendingSpot[]): TrendingSpot[] {
  return spots.map((spot, i) => ({
    ...spot,
    images:
      spot.images && spot.images.length > 0 && spot.images[0]
        ? spot.images
        : [FALLBACK_IMAGES[i % FALLBACK_IMAGES.length]],
  }));
}

/* ── Spot Card ────────────────────────────────────────────────────────── */
function SpotCard({
  spot,
  index,
  activeIndex,
  spotsLength,
}: {
  spot: TrendingSpot;
  index: number;
  activeIndex: number;
  spotsLength: number;
}) {
  const displayImage =
    spot.images?.length > 0
      ? spot.images[0]
      : FALLBACK_IMAGES[index % FALLBACK_IMAGES.length];

  const displayPrice = spot.price_per_event ?? spot.price_per_hour ?? 0;
  const priceLabel = spot.price_per_event
    ? `$${Number(displayPrice).toFixed(0)}`
    : `$${Number(displayPrice).toFixed(2)}/hr`;
  const unit = spot.price_per_event ? " per event" : "";

  // Compute position relative to activeIndex with infinite wrapping
  const diff = ((index - activeIndex) % spotsLength + spotsLength) % spotsLength;
  // Normalize so diff is in the range [-floor(n/2), floor(n/2)]
  const normalized =
    diff > Math.floor(spotsLength / 2) ? diff - spotsLength : diff;

  let x: string | number = 0;
  let scale = 1;
  let zIndex = 10;
  let opacity = 1;

  if (normalized === 0) {
    // Active — center
    x = 0;
    scale = 1;
    zIndex = 10;
    opacity = 1;
  } else if (normalized === 1 || normalized === -(spotsLength - 1)) {
    // Next — right
    x = "110%";
    scale = 0.85;
    zIndex = 5;
    opacity = 0.6;
  } else if (normalized === -1 || normalized === (spotsLength - 1)) {
    // Prev — left
    x = "-110%";
    scale = 0.85;
    zIndex = 5;
    opacity = 0.6;
  } else {
    // Hidden
    x = 0;
    scale = 0.8;
    zIndex = 0;
    opacity = 0;
  }

  return (
    <motion.div
      className="absolute w-[85vw] sm:w-[350px] h-[400px] bg-white rounded-xl shadow-lg border border-gray-100 flex flex-col overflow-hidden origin-center"
      animate={{ x, scale, zIndex, opacity }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      style={{ zIndex }}
    >
      <Link
        href={`/listings/${spot.id}`}
        className="group flex flex-col h-full"
      >
        {/* Image — top half */}
        <div className="relative h-1/2 overflow-hidden bg-gray-100">
          <img
            src={displayImage}
            alt={spot.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
            draggable={false}
          />
        </div>

        {/* Details — bottom half */}
        <div className="flex flex-col justify-between flex-1 p-5">
          <div>
            <h3 className="font-semibold text-gray-900 truncate group-hover:text-parkga-600 transition-colors">
              {spot.title}
            </h3>
            <p className="mt-0.5 text-sm text-gray-500 truncate">
              {spot.address}
            </p>
          </div>

          <div className="flex items-center justify-between mt-3">
            <span className="text-lg font-bold text-gray-900">
              {priceLabel}
              <span className="text-sm font-normal text-gray-500">
                {unit}
              </span>
            </span>

            {spot.avg_rating ? (
              <span className="flex items-center gap-1 text-sm text-gray-600">
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                {spot.avg_rating.toFixed(1)}
                <span className="text-gray-400">
                  ({spot.review_count})
                </span>
              </span>
            ) : null}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

/* ── Skeleton ─────────────────────────────────────────────────────────── */
function SkeletonCard() {
  return (
    <div className="absolute w-[85vw] sm:w-[350px] h-[400px] bg-white rounded-xl shadow-lg border border-gray-100 flex flex-col overflow-hidden animate-pulse">
      <div className="h-1/2 bg-gray-200" />
      <div className="p-5 space-y-3">
        <div className="h-4 bg-gray-200 rounded w-3/4" />
        <div className="h-3 bg-gray-200 rounded w-1/2" />
        <div className="flex items-center gap-2">
          <div className="h-4 bg-gray-200 rounded w-16" />
          <div className="h-3 bg-gray-200 rounded w-12" />
        </div>
      </div>
    </div>
  );
}

/* ── Trending Carousel ───────────────────────────────────────────────── */
export default function TrendingCarousel({
  spots,
  loading,
}: {
  spots: TrendingSpot[];
  loading: boolean;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const displaySpots = spots.length > 0 ? spots : [];

  // Next / Prev with infinite modulo wrapping
  const goNext = useCallback(
    () => setActiveIndex((prev) => (prev + 1) % displaySpots.length),
    [displaySpots.length],
  );

  const goPrev = useCallback(
    () =>
      setActiveIndex(
        (prev) => (prev - 1 + displaySpots.length) % displaySpots.length,
      ),
    [displaySpots.length],
  );

  // Auto-play
  useEffect(() => {
    if (isPaused || loading || displaySpots.length === 0) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(goNext, 4000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPaused, loading, displaySpots.length, goNext]);

  if (loading) {
    return (
      <div className="relative w-full h-[450px] flex justify-center items-center overflow-hidden">
        <SkeletonCard />
      </div>
    );
  }

  if (displaySpots.length === 0) {
    return (
      <div className="relative w-full h-[450px] flex justify-center items-center overflow-hidden">
        <div className="text-center text-gray-400">
          <p>No spots available yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative w-full h-[450px] flex justify-center items-center overflow-hidden"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Cards stack */}
      <AnimatePresence mode="popLayout">
        {displaySpots.map((spot, i) => (
          <SpotCard
            key={spot.id}
            spot={spot}
            index={i}
            activeIndex={activeIndex}
            spotsLength={displaySpots.length}
          />
        ))}
      </AnimatePresence>

      {/* Arrow controls */}
      <button
        onClick={goPrev}
        className="absolute left-3 top-1/2 -translate-y-1/2 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow-lg backdrop-blur-sm transition-all hover:bg-white hover:shadow-xl active:scale-95"
        aria-label="Previous spot"
      >
        <ChevronLeft className="h-5 w-5 text-gray-700" />
      </button>
      <button
        onClick={goNext}
        className="absolute right-3 top-1/2 -translate-y-1/2 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow-lg backdrop-blur-sm transition-all hover:bg-white hover:shadow-xl active:scale-95"
        aria-label="Next spot"
      >
        <ChevronRight className="h-5 w-5 text-gray-700" />
      </button>

      {/* Dots indicator */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
        {displaySpots.map((_, i) => (
          <button
            key={i}
            onClick={() => setActiveIndex(i)}
            className={`h-2 rounded-full transition-all duration-300 ${
              i === activeIndex
                ? "w-6 bg-parkga-600"
                : "w-2 bg-gray-300 hover:bg-gray-400"
            }`}
            aria-label={`Go to spot ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
