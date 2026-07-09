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
const SVG_PATH =
  "M 120,160 C 480,130 180,440 600,440 C 1020,440 720,750 1020,750";

/** Floating Map UI — Step 1 infographic */
function FloatingMap() {
  return (
    <motion.div
      className="relative h-28 w-32 rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden"
      animate={{ y: [0, -10, 0] }}
      transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
    >
      {/* Grid streets */}
      <div className="absolute inset-0 bg-[linear-gradient(#e5e7eb_1px,transparent_1px),linear-gradient(90deg,#e5e7eb_1px,transparent_1px)] bg-[size:16px_16px]" />
      {/* Map pin */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="flex flex-col items-center">
          <div className="h-5 w-5 rounded-full bg-parkga-500 flex items-center justify-center shadow-lg">
            <div className="h-2 w-2 rounded-full bg-white" />
          </div>
          <div className="h-3 w-0.5 bg-parkga-700" />
        </div>
      </div>
      {/* $20 badge */}
      <div className="absolute top-2 right-2 rounded-md bg-green-500 px-2 py-0.5 text-xs font-bold text-white shadow">
        $20
      </div>
    </motion.div>
  );
}

/** Tilted Credit Card — Step 2 infographic */
function FloatingCreditCard() {
  return (
    <motion.div
      className="relative h-24 w-36 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 p-4 text-white shadow-2xl rotate-6"
      animate={{ y: [0, -8, 0], rotate: [6, 8, 6] }}
      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
    >
      {/* Chip */}
      <div className="mb-3 h-6 w-8 rounded-md bg-gradient-to-br from-yellow-300 to-yellow-500 shadow-inner" />
      <p className="text-xs tracking-wider text-slate-300">•••• 4242</p>
      <div className="mt-1 flex items-center justify-between">
        <p className="text-[10px] text-slate-400">VALID THRU 12/28</p>
        {/* Stripe/Apple Pay logos */}
        <div className="flex gap-1">
          <div className="h-3 w-5 rounded bg-white/10 flex items-center justify-center text-[6px] text-white/60 font-bold">SP</div>
          <div className="h-3 w-5 rounded bg-white/10 flex items-center justify-center text-[6px] text-white/60 font-bold">AP</div>
        </div>
      </div>
    </motion.div>
  );
}

/** Glowing Digital Pass — Step 3 infographic */
function FloatingPass() {
  return (
    <motion.div
      className="relative h-28 w-36 rounded-xl border border-green-400/40 bg-gradient-to-br from-green-50 to-white p-4 shadow-[0_0_30px_-8px_rgba(22,163,74,0.25)] overflow-hidden"
      initial={{ x: 40, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      {/* Decorative top bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-parkga-400 to-parkga-600" />
      <div className="mt-1 flex items-center gap-2">
        <div className="h-6 w-6 rounded-full bg-parkga-500 flex items-center justify-center">
          <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <span className="text-xs font-bold text-green-700">CONFIRMED</span>
      </div>
      <p className="mt-2 text-[10px] text-gray-500">ParkGA Digital Pass</p>
      <div className="mt-1 h-1 w-full rounded-full bg-green-100">
        <div className="h-1 w-3/4 rounded-full bg-gradient-to-r from-parkga-400 to-parkga-600" />
      </div>
      <p className="mt-1 text-[9px] text-gray-400">Scan to park • #PKGA-2841</p>
      {/* Glow dot */}
      <div className="absolute -bottom-2 -right-2 h-12 w-12 rounded-full bg-parkga-400/10 blur-xl" />
    </motion.div>
  );
}

/* ── Individual step node ─────────────────────────────────────────── */
const STEP_DATA = [
  {
    title: "Find a Spot",
    description:
      "Browse hundreds of verified parking spots near stadiums, airports, and event venues across Georgia. Filter by price, location, and date.",
    icon: Search,
    cardPosition: { left: "27%", top: "8%" },
    InfoGraphic: FloatingMap,
  },
  {
    title: "Book & Pay",
    description:
      "Reserve instantly with secure checkout. No hidden fees, no hassle. Your booking is protected from the moment you pay.",
    icon: CreditCard,
    cardPosition: { left: "3%", top: "36%" },
    InfoGraphic: FloatingCreditCard,
  },
  {
    title: "Park & Go",
    description:
      "Get digital access instructions and park with confidence. We handle the verification so you can focus on the game, event, or wherever life takes you.",
    icon: Car,
    cardPosition: { left: "27%", top: "62%" },
    InfoGraphic: FloatingPass,
  },
];

function StepNode({
  index,
  scrollYProgress,
}: {
  index: number;
  scrollYProgress: import("framer-motion").MotionValue<number>;
}) {
  const step = STEP_DATA[index];
  const InfoGraphic = step.InfoGraphic;

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

  // 3D card variants
  const cardScale = useTransform(isActive, (a) => (a ? 1.05 : 0.9));
  const cardBlur = useTransform(isActive, (a) => (a ? "blur(0px)" : "blur(3px)"));
  const cardY = useTransform(isActive, (a) => (a ? 0 : 20));

  return (
    <motion.div
      className="absolute z-10 flex items-start gap-5"
      style={{ left: step.cardPosition.left, top: step.cardPosition.top, opacity }}
    >
      {/* Dot marker on the SVG path */}
      <motion.div
        className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 shadow-sm"
        style={{ backgroundColor: dotBg, borderColor: dotBorder }}
      >
        <motion.span className="text-sm font-bold" style={{ color: dotText }}>
          {index + 1}
        </motion.span>
      </motion.div>

      {/* 3D Card with floating infographic */}
      <motion.div
        className="w-[85vw] sm:w-[450px] md:w-[500px] rounded-2xl bg-white/95 p-6 shadow-lg backdrop-blur-sm ring-1 ring-gray-100 transition-shadow duration-500"
        style={{
          scale: cardScale,
          filter: cardBlur,
          y: cardY,
          boxShadow: useTransform(isActive, (a) =>
            a
              ? "0 0 60px -15px rgba(22,163,74,0.3), 0 20px 60px -15px rgba(0,0,0,0.15)"
              : "0 4px 20px rgba(0,0,0,0.08)",
          ),
        }}
      >
        <div className="flex items-start gap-6">
          {/* Text side */}
          <div className="flex-1 min-w-0">
            <div className="mb-3 inline-flex rounded-lg bg-parkga-100 p-2.5">
              <step.icon className="h-5 w-5 text-parkga-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900">{step.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-500">
              {step.description}
            </p>
          </div>

          {/* Infographic side */}
          <div className="hidden sm:flex items-center justify-center w-36 shrink-0">
            <InfoGraphic />
          </div>
        </div>
      </motion.div>
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
        {/* Dot pattern background */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.15]"
          style={{
            backgroundImage:
              "radial-gradient(circle, #16a34a 0.75px, transparent 0.75px)",
            backgroundSize: "24px 24px",
          }}
        />

        {/* Title */}
        <div className="pointer-events-none absolute left-0 right-0 top-8 z-20 mx-auto w-full text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            How It Works
          </h2>
          <p className="mt-2 text-sm text-gray-500">
            Scroll to follow the journey
          </p>
        </div>

        {/* Full-screen SVG with glow filter */}
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 1200 900"
          preserveAspectRatio="xMidYMid meet"
          style={{ pointerEvents: "none" }}
        >
          <defs>
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Grey background path */}
          <path
            d={SVG_PATH}
            stroke="#e5e7eb"
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
          />
          {/* Glowing green laser path */}
          <motion.path
            d={SVG_PATH}
            stroke="#16a34a"
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
            filter="url(#glow)"
            style={{ pathLength: scrollYProgress }}
          />
        </svg>

        {/* Step nodes */}
        {STEP_DATA.map((_, i) => (
          <StepNode
            key={STEP_DATA[i].title}
            index={i}
            scrollYProgress={scrollYProgress}
          />
        ))}

        {/* Scroll hint */}
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
