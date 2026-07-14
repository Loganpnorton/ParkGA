"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, Calendar } from "lucide-react";
import HowItWorks from "@/components/HowItWorks";
import { createClient } from "@/lib/supabase/client";
import TrendingCarousel, {
  type TrendingSpot,
  enforceSpotImages,
} from "@/components/TrendingCarousel";

/* ── Types ────────────────────────────────────────────────────────────── */
/* (TrendingSpot is now imported from TrendingCarousel)                    */

/* ── Typing Effect Hook ───────────────────────────────────────────── */
function useTypingEffect(
  words: string[],
  typingSpeed = 100,
  deletingSpeed = 55,
  pauseTime = 2200,
) {
  const [text, setText] = useState("");
  const [wordIndex, setWordIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const currentWord = words[wordIndex];

    const timeout = setTimeout(
      () => {
        if (!isDeleting) {
          if (text.length < currentWord.length) {
            setText(currentWord.slice(0, text.length + 1));
            return;
          }
          const pause = setTimeout(() => setIsDeleting(true), pauseTime);
          return () => clearTimeout(pause);
        }

        if (text.length > 0) {
          setText(currentWord.slice(0, text.length - 1));
          return;
        }
        setIsDeleting(false);
        setWordIndex((prev) => (prev + 1) % words.length);
      },
      isDeleting ? deletingSpeed : typingSpeed,
    );

    return () => clearTimeout(timeout);
  }, [text, wordIndex, isDeleting, words, typingSpeed, deletingSpeed, pauseTime]);

  return text;
}

const CYCLING_WORDS = ["Braves Games.", "The BeltLine.", "UGA Tailgates.", "Georgia."];

/* ── Trending Spots Section ────────────────────────────────────────── */
function TrendingSpotsSection() {
  const [spots, setSpots] = useState<TrendingSpot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    supabase
      .from("spots")
      .select(
        `
          id,
          title,
          address,
          price_per_hour,
          price_per_event,
          images,
          reviews ( rating )
        `,
        { count: "exact" },
      )
      .eq("active", true)
      .limit(4)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          console.error("Failed to load trending spots:", error);
          setLoading(false);
          return;
        }

        const mapped: TrendingSpot[] = (data ?? []).map((row: Record<string, unknown>) => {
          const reviews = row.reviews as { rating: number }[] | null;
          const ratings = reviews?.map((r) => r.rating) ?? [];
          const avg =
            ratings.length > 0
              ? ratings.reduce((a, b) => a + b, 0) / ratings.length
              : null;

          return {
            id: row.id as string,
            title: row.title as string,
            address: row.address as string,
            price_per_hour: row.price_per_hour as number | null,
            price_per_event: row.price_per_event as number | null,
            images: (row.images as string[]) ?? [],
            avg_rating: avg,
            review_count: ratings.length,
          };
        });

        setSpots(mapped);
        setLoading(false);
      });
  }, []);

  const enforcedSpots = enforceSpotImages(spots);

  return (
    <section className="py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Trending Parking Spots in Georgia
            </h2>
            <p className="mt-2 text-lg text-gray-600">
              Popular spots drivers are booking right now.
            </p>
          </div>
          <Link
            href="/listings"
            className="hidden sm:inline-flex items-center gap-1 text-sm font-semibold text-parkga-600 hover:text-parkga-700 transition-colors"
          >
            View all &rarr;
          </Link>
        </div>

        {/* Framer Motion center-focus carousel */}
        <div className="mt-10">
          <TrendingCarousel spots={enforcedSpots} loading={loading} />
        </div>
      </div>
    </section>
  );
}


/* ── Home Page ──────────────────────────────────────────────────────── */
export default function HomePage() {
  const router = useRouter();
  const typedText = useTypingEffect(CYCLING_WORDS);

  const [location, setLocation] = useState("");

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (location.trim()) params.set("q", location.trim());
    router.push(`/listings?${params.toString()}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  return (
    <>
      {/* ── Hero Section ─────────────────────────────────────────────── */}
      <section className="relative flex min-h-[90vh] items-center overflow-hidden bg-gray-900">
        {/* Background image with Ken Burns effect + dark overlay */}
        <div
          className="animate-ken-burns absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=1920&q=80')",
          }}
        />
        <div className="absolute inset-0 bg-black/60" />

        <div className="relative z-10 mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:py-32">
          <div className="mx-auto max-w-3xl text-center">
            <div className="flex items-center justify-center h-[56px] sm:h-[72px] md:h-[80px] break-words whitespace-normal">
              <h1 className="text-4xl font-bold leading-tight flex-wrap text-white md:text-6xl">
                Find Parking for{" "}
                <span className="inline-block text-parkga-400 break-words">
                  {typedText}
                  <span className="animate-cursor ml-0.5 font-light text-parkga-400">|</span>
                </span>
              </h1>
            </div>

            <p className="mt-3 leading-6 text-gray-300 text-xs sm:text-sm md:mt-6 md:text-lg md:leading-8">
              ParkGA is the peer-to-peer marketplace that connects drivers with
              affordable parking spots hosted by locals. Skip the expensive lots
              and park smarter.
            </p>

            {/* ── Pill-Shaped Search Bar ──────────────────────────────── */}
            <div className="mt-4 md:mt-10">
              <div className="mx-auto flex max-w-3xl flex-col md:flex-row items-stretch md:items-center rounded-xl md:rounded-full bg-white p-2 shadow-2xl gap-2 md:gap-0">
                <div className="flex flex-1 items-center gap-2 px-4 py-3 md:py-2 rounded-lg md:rounded-none border md:border-0 border-gray-200">
                  <Search className="h-5 w-5 shrink-0 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Where to? (e.g., Truist Park)"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="w-full border-none bg-transparent text-sm text-gray-900 placeholder-gray-400 outline-none focus:outline-none min-h-[44px]"
                  />
                </div>

                <div className="hidden md:block h-8 w-px bg-gray-200" />

                <div className="flex md:flex-1 items-center gap-2 px-4 py-3 md:py-2 rounded-lg md:rounded-none border md:border-0 border-gray-200">
                  <Calendar className="h-5 w-5 shrink-0 text-gray-400" />
                  <span className="whitespace-nowrap text-sm text-gray-400">Add dates</span>
                </div>

                <div className="hidden md:block h-8 w-px bg-gray-200" />

                <div className="px-0 md:px-2">
                  <button
                    onClick={handleSearch}
                    className="flex w-full md:w-auto cursor-pointer items-center justify-center gap-2 rounded-full bg-parkga-600 px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-parkga-700 hover:shadow-lg active:scale-95 min-h-[44px]"
                  >
                    <Search className="h-4 w-4" />
                    <span>Search</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white to-transparent" />
      </section>

      {/* ── Trending Spots Section ─────────────────────────────────────── */}
      <TrendingSpotsSection />

      {/* ── How It Works Section (sticky-scroll) ──────────────────────────── */}
      <HowItWorks />

      {/* ── Diffused transition: white → brand-900 ───────────────────────── */}
      <div className="h-24 bg-gradient-to-b from-white via-white/60 to-brand-900" />

      {/* ── Unified Host + CTA Block ─────────────────────────────────────── */}
      <section className="bg-brand-900">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center gap-12 md:flex-row md:gap-16">
            {/* Left — Content */}
            <div className="w-full text-center md:w-1/2 md:text-left">
              <p className="text-sm font-semibold uppercase tracking-widest text-parkga-300">
                Become a Host
              </p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
                Your Driveway.
                <span className="block text-parkga-400">Their Parking Spot.</span>
              </h2>
              <p className="mt-6 text-lg leading-8 text-brand-100/80">
                Unlike corporate garages, ParkGA is built by locals, for locals.
                Turn your empty driveway into passive income during game days and
                local events. We handle the payments, you keep the profits.
              </p>

              {/* CTAs */}
              <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row md:justify-start">
                <a
                  href="/host/new"
                  className="inline-flex items-center gap-2 rounded-xl bg-parkga-500 px-8 py-4 text-base font-semibold text-white shadow-lg transition-all duration-300 hover:bg-parkga-400 hover:shadow-xl active:scale-95"
                >
                  Start Earning Today
                  <span aria-hidden="true" className="text-lg">&rarr;</span>
                </a>
                <a
                  href="/auth/signup"
                  className="inline-flex items-center gap-2 rounded-xl bg-transparent border-2 border-white px-8 py-4 text-base font-semibold text-white transition-all duration-300 hover:bg-white hover:text-green-900"
                >
                  Create an Account
                </a>
              </div>

              {/* Trust markers */}
              <div className="mt-10 flex flex-wrap items-center gap-8 text-sm text-brand-200/60">
                <span className="flex items-center gap-1.5">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Free to list
                </span>
                <span className="flex items-center gap-1.5">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Secure payouts
                </span>
                <span className="flex items-center gap-1.5">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  24/7 support
                </span>
              </div>
            </div>

            {/* Right — Image */}
            <div className="w-full md:w-1/2">
              <div className="overflow-hidden rounded-2xl shadow-2xl shadow-brand-950/50">
                <div
                  className="aspect-[4/3] w-full bg-cover bg-center transition-transform duration-700 hover:scale-105"
                  style={{
                    backgroundImage:
                      "url('https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&q=80')",
                  }}
                />
              </div>
              <p className="mt-3 text-center text-xs text-brand-200/40 md:text-left">
                A typical Atlanta driveway — ready to earn.
              </p>
            </div>
          </div>
        </div>

        {/* ── Bottom transition: seamless into footer's brand-900 ── */}
        <div className="h-8" />
      </section>
    </>
  );
}
