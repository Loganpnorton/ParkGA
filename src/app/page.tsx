"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import { Search, Calendar, MapPin, Shield, DollarSign, Car, CreditCard } from "lucide-react";
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

/* ── How It Works Section (Sticky Scroll) ─────────────────────────── */
const HOW_IT_WORKS_STEPS = [
  {
    title: "Find a Spot",
    description:
      "Browse hundreds of verified parking spots near stadiums, airports, and event venues across Georgia. Filter by price, location, and date.",
    icon: Search,
    cardPosition: { left: "22%", top: "12%" },
  },
  {
    title: "Book & Pay",
    description:
      "Reserve instantly with secure checkout. No hidden fees, no hassle. Your booking is protected from the moment you pay.",
    icon: CreditCard,
    cardPosition: { left: "12%", top: "42%" },
  },
  {
    title: "Park & Go",
    description:
      "Get digital access instructions and park with confidence. We handle the verification so you can focus on the game, event, or wherever life takes you.",
    icon: Car,
    cardPosition: { left: "38%", top: "70%" },
  },
];

/** Smooth SVG winding path connecting the 3 step nodes */
const SVG_PATH =
  "M 120,160 C 480,130 180,440 600,440 C 1020,440 720,750 1020,750";

/* ── Individual step node (receives scrollYProgress as a prop) ────── */
function StepNode({
  step,
  index,
  scrollYProgress,
}: {
  step: (typeof HOW_IT_WORKS_STEPS)[number];
  index: number;
  scrollYProgress: import("framer-motion").MotionValue<number>;
}) {
  const Icon = step.icon;

  // Map progress ranges per step: [fadeInStart, fullyVisibleStart]
  const ranges = [
    [0, 0.35],
    [0.25, 0.65],
    [0.55, 1],
  ] as const;
  const [fadeIn, full] = ranges[index];

  const opacity = useTransform(scrollYProgress, (p: number) => {
    if (p < fadeIn) return 0.35;
    if (p > full) return 1;
    return 0.35 + ((p - fadeIn) / (full - fadeIn)) * 0.65;
  });

  const isActive = useTransform(scrollYProgress, (p: number) => p >= fadeIn);

  const dotBg = useTransform(isActive, (a) => (a ? "#16a34a" : "#ffffff"));
  const dotBorder = useTransform(isActive, (a) =>
    a ? "#16a34a" : "#d1d5db",
  );
  const dotText = useTransform(isActive, (a) => (a ? "#ffffff" : "#9ca3af"));

  return (
    <motion.div
      className="absolute z-10 flex items-start gap-5"
      style={{ left: step.cardPosition.left, top: step.cardPosition.top, opacity }}
    >
      {/* Dot marker on the SVG path */}
      <motion.div
        className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 shadow-sm transition-shadow duration-300"
        style={{ backgroundColor: dotBg, borderColor: dotBorder }}
      >
        <motion.span
          className="text-sm font-bold"
          style={{ color: dotText }}
        >
          {index + 1}
        </motion.span>
      </motion.div>

      {/* Card */}
      <div className="max-w-xs rounded-2xl bg-white/90 p-5 shadow-lg backdrop-blur-sm ring-1 ring-gray-100">
        <div className="mb-2 inline-flex rounded-lg bg-parkga-100 p-2">
          <Icon className="h-5 w-5 text-parkga-600" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900">{step.title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-gray-500">
          {step.description}
        </p>
      </div>
    </motion.div>
  );
}

function HowItWorksSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  const scrollHintOpacity = useTransform(
    scrollYProgress,
    [0, 0.12, 0.25],
    [1, 0.5, 0],
  );

  return (
    <section ref={containerRef} className="relative h-[300vh]">
      <div className="sticky top-0 flex h-screen items-center overflow-hidden bg-gradient-to-b from-white via-parkga-50/20 to-white">
        {/* Title */}
        <div className="pointer-events-none absolute left-0 right-0 top-8 z-20 mx-auto w-full text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            How It Works
          </h2>
          <p className="mt-2 text-sm text-gray-500">
            Scroll to follow the journey
          </p>
        </div>

        {/* Full-screen SVG */}
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 1200 900"
          preserveAspectRatio="xMidYMid meet"
          style={{ pointerEvents: "none" }}
        >
          {/* Grey background path */}
          <path
            d={SVG_PATH}
            stroke="#e5e7eb"
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
          />
          {/* Animated green path */}
          <motion.path
            d={SVG_PATH}
            stroke="#16a34a"
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
            style={{ pathLength: scrollYProgress }}
          />
        </svg>

        {/* Step nodes */}
        {HOW_IT_WORKS_STEPS.map((step, i) => (
          <StepNode
            key={step.title}
            step={step}
            index={i}
            scrollYProgress={scrollYProgress}
          />
        ))}

        {/* Scroll hint (fades after user starts scrolling) */}
        <motion.div
          className="absolute bottom-6 left-1/2 z-20 -translate-x-1/2"
          style={{ opacity: scrollHintOpacity }}
        >
          <div className="flex flex-col items-center gap-1 text-xs text-gray-400">
            <svg
              className="h-5 w-5 animate-bounce"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 14l-7 7m0 0l-7-7m7 7V3"
              />
            </svg>
            <span>Scroll</span>
          </div>
        </motion.div>
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
            <div className="flex items-center justify-center h-[48px] sm:h-[56px] md:h-[72px] lg:h-[80px] xl:h-[96px]">
              <h1 className="whitespace-nowrap text-xl font-extrabold tracking-tight text-white sm:text-2xl md:text-4xl lg:text-5xl xl:text-6xl">
                Find Parking for{" "}
                <span className="inline-block text-parkga-400">
                  {typedText}
                  <span className="animate-cursor ml-0.5 font-light text-parkga-400">|</span>
                </span>
              </h1>
            </div>

            <p className="mt-4 text-sm leading-7 text-gray-300 sm:text-base sm:leading-8 md:mt-6 md:text-lg">
              ParkGA is the peer-to-peer marketplace that connects drivers with
              affordable parking spots hosted by locals. Skip the expensive lots
              and park smarter.
            </p>

            {/* ── Pill-Shaped Search Bar ──────────────────────────────── */}
            <div className="mt-6 md:mt-10">
              <div className="mx-auto flex max-w-3xl items-center rounded-full bg-white p-2 shadow-2xl">
                <div className="flex flex-1 items-center gap-2 px-4 py-2">
                  <Search className="h-5 w-5 shrink-0 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Where to? (e.g., Truist Park)"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="w-full border-none bg-transparent text-sm text-gray-900 placeholder-gray-400 outline-none focus:outline-none"
                  />
                </div>

                <div className="hidden h-8 w-px bg-gray-200 sm:block" />

                <div className="hidden flex-1 items-center gap-2 px-4 py-2 sm:flex">
                  <Calendar className="h-5 w-5 shrink-0 text-gray-400" />
                  <span className="whitespace-nowrap text-sm text-gray-400">Add dates</span>
                </div>

                <div className="hidden h-8 w-px bg-gray-200 sm:block" />

                <div className="px-2">
                  <button
                    onClick={handleSearch}
                    className="flex cursor-pointer items-center gap-2 rounded-full bg-parkga-600 px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-parkga-700 hover:shadow-lg active:scale-95"
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
      <HowItWorksSection />

      {/* ── Diffused transition: white → green-900 ───────────────────────── */}
      <div className="h-24 bg-gradient-to-b from-white via-white/60 to-green-900" />

      {/* ── Unified Host + CTA Block ─────────────────────────────────────── */}
      <section className="bg-green-900">
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
              <p className="mt-6 text-lg leading-8 text-green-100/80">
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
                  className="inline-flex items-center gap-2 rounded-xl border border-green-500/30 px-8 py-4 text-base font-semibold text-green-100 transition-all duration-300 hover:border-green-500/60 hover:bg-white/5"
                >
                  Create an Account
                </a>
              </div>

              {/* Trust markers */}
              <div className="mt-10 flex flex-wrap items-center gap-8 text-sm text-green-200/60">
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
              <div className="overflow-hidden rounded-2xl shadow-2xl shadow-green-950/50">
                <div
                  className="aspect-[4/3] w-full bg-cover bg-center transition-transform duration-700 hover:scale-105"
                  style={{
                    backgroundImage:
                      "url('https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&q=80')",
                  }}
                />
              </div>
              <p className="mt-3 text-center text-xs text-green-200/40 md:text-left">
                A typical Atlanta driveway — ready to earn.
              </p>
            </div>
          </div>
        </div>

        {/* ── Bottom transition: green-900 → footer gray-50 ─────────────── */}
        <div className="h-24 bg-gradient-to-b from-green-900 via-green-800/20 to-gray-50" />
      </section>
    </>
  );
}
