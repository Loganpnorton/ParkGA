"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { motion, useMotionValue, animate, PanInfo } from "framer-motion";
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
  "https://images.unsplash.com/photo-1506521781265-d8422e82f816?w=600&q=80",
  "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=600&q=80",
  "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=600&q=80",
  "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600&q=80",
  "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=600&q=80",
  "https://images.unsplash.com/photo-1572120360610-d9f2e15e2fc1?w=600&q=80",
  "https://images.unsplash.com/photo-1590674899484-d5640d46f70f?w=600&q=80",
  "https://images.unsplash.com/photo-1605146769289-440113cc3d00?w=600&q=80",
];

/** Force every spot to have an image — DB empty arrays get replaced with
 *  a deterministic fallback from the curated Unsplash set.                */
export function enforceSpotImages(spots: TrendingSpot[]): TrendingSpot[] {
  return spots.map((spot, i) => ({
    ...spot,
    images:
      spot.images && spot.images.length > 0 && spot.images[0]
        ? spot.images
        : [FALLBACK_IMAGES[i % FALLBACK_IMAGES.length]],
  }));
}

/* ── Helpers ──────────────────────────────────────────────────────────── */
const GAP = 16; // matches Tailwind gap-4

function cardWidth(vw: number): number {
  if (vw >= 768) return 350;
  if (vw >= 640) return 320;
  return vw * 0.85;
}

/* ── Skeleton ─────────────────────────────────────────────────────────── */
function SkeletonSlide() {
  return (
    <div className="shrink-0 w-[85vw] sm:w-[320px] md:w-[350px] aspect-[4/5] animate-pulse rounded-2xl border border-gray-200 bg-white overflow-hidden">
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

/* ── Spot Slide ───────────────────────────────────────────────────────── */
function SpotSlide({
  spot,
  index,
  activeIndex,
}: {
  spot: TrendingSpot;
  index: number;
  activeIndex: number;
}) {
  const imageUrl = spot.images[0] ?? FALLBACK_IMAGES[index % FALLBACK_IMAGES.length];

  const displayPrice = spot.price_per_event ?? spot.price_per_hour ?? 0;
  const priceLabel = spot.price_per_event
    ? `$${Number(displayPrice).toFixed(0)}`
    : `$${Number(displayPrice).toFixed(2)}/hr`;
  const unit = spot.price_per_event ? " per event" : "";

  const distance = Math.abs(index - activeIndex);
  const scale = distance === 0 ? 1 : distance === 1 ? 0.9 : 0.85;
  const opacity = distance === 0 ? 1 : distance === 1 ? 0.6 : 0.35;
  const zIndex = distance === 0 ? 10 : 0;

  return (
    <motion.div
      layout
      animate={{ scale, opacity, zIndex }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="shrink-0 w-[85vw] sm:w-[320px] md:w-[350px] aspect-[4/5] flex flex-col rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm"
      style={{ zIndex }}
    >
      <Link
        href={`/listings/${spot.id}`}
        className="group flex flex-col h-full"
      >
        {/* Image — exactly 50% of card height */}
        <div className="relative h-1/2 overflow-hidden">
          <div
            className="h-full w-full bg-cover bg-center transition-transform duration-500 group-hover:scale-110"
            style={{ backgroundImage: `url('${imageUrl}')` }}
          />
        </div>

        {/* Details — bottom 50% */}
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
              <span className="text-sm font-normal text-gray-500">{unit}</span>
            </span>

            {spot.avg_rating ? (
              <span className="flex items-center gap-1 text-sm text-gray-600">
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                {spot.avg_rating.toFixed(1)}
                <span className="text-gray-400">({spot.review_count})</span>
              </span>
            ) : null}
          </div>
        </div>
      </Link>
    </motion.div>
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
  const [vw, setVw] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isDraggingRef = useRef(false);

  // Track viewport width for responsive calculations
  useEffect(() => {
    const update = () => setVw(window.innerWidth);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const cw = vw ? cardWidth(vw) : 350;
  const totalCards = spots.length > 0 ? spots.length : 4;
  const trackWidth = totalCards * (cw + GAP);

  // Calculate x offset to center the active index
  const getTargetX = useCallback(
    (index: number) => {
      const viewportCenter = (vw || 1200) / 2;
      const cardCenter = index * (cw + GAP) + cw / 2;
      return viewportCenter - cardCenter;
    },
    [vw, cw],
  );

  // Snap to card on drag end
  const handleDragEnd = useCallback(
    (_: unknown, info: PanInfo) => {
      isDraggingRef.current = false;
      const currentX = x.get();
      // Estimate which index we're nearest based on velocity + position
      const velocityOffset = info.velocity.x * 0.15;
      const estimatedIndex = Math.round(
        (-(currentX + velocityOffset) + (vw || 1200) / 2 - cw / 2) / (cw + GAP),
      );
      const clamped = Math.max(0, Math.min(estimatedIndex, spots.length - 1));
      setActiveIndex(clamped);
      animate(x, getTargetX(clamped), {
        type: "spring",
        stiffness: 300,
        damping: 30,
      });
    },
    [x, vw, cw, spots.length, getTargetX],
  );

  // Animate to activeIndex when it changes programmatically
  useEffect(() => {
    if (!isDraggingRef.current) {
      animate(x, getTargetX(activeIndex), {
        type: "spring",
        stiffness: 300,
        damping: 30,
      });
    }
  }, [activeIndex, getTargetX, x]);

  // Auto-play
  useEffect(() => {
    if (isPaused || loading || spots.length === 0) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % spots.length);
    }, 4000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPaused, loading, spots.length]);

  const displaySpots = spots.length > 0 ? spots : [];

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Track */}
      <div className="overflow-hidden select-none" style={{ touchAction: "pan-y" }}>
        <motion.div
          ref={trackRef}
          className="flex gap-4 cursor-grab active:cursor-grabbing"
          style={{ x }}
          drag="x"
          dragConstraints={{
            left: -(trackWidth - (vw || 1200)),
            right: 0,
          }}
          dragElastic={0.15}
          onDragStart={() => {
            isDraggingRef.current = true;
            setIsPaused(true);
          }}
          onDragEnd={handleDragEnd}
        >
          {loading
            ? Array.from({ length: 4 }).map((_, i) => <SkeletonSlide key={i} />)
            : displaySpots.map((spot, i) => (
                <SpotSlide
                  key={spot.id}
                  spot={spot}
                  index={i}
                  activeIndex={activeIndex}
                />
              ))}
        </motion.div>
      </div>

      {/* Arrow controls */}
      {!loading && displaySpots.length > 0 && (
        <>
          <button
            onClick={() =>
              setActiveIndex((prev) =>
                prev === 0 ? displaySpots.length - 1 : prev - 1,
              )
            }
            className="absolute left-2 top-1/2 -translate-y-1/2 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow-lg backdrop-blur-sm transition-all hover:bg-white hover:shadow-xl active:scale-95"
            aria-label="Previous spot"
          >
            <ChevronLeft className="h-5 w-5 text-gray-700" />
          </button>
          <button
            onClick={() =>
              setActiveIndex((prev) => (prev + 1) % displaySpots.length)
            }
            className="absolute right-2 top-1/2 -translate-y-1/2 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow-lg backdrop-blur-sm transition-all hover:bg-white hover:shadow-xl active:scale-95"
            aria-label="Next spot"
          >
            <ChevronRight className="h-5 w-5 text-gray-700" />
          </button>
        </>
      )}

      {/* Dots indicator */}
      {!loading && displaySpots.length > 0 && (
        <div className="mt-6 flex items-center justify-center gap-2">
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
      )}
    </div>
  );
}
