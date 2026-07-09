"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, Calendar, MapPin, Shield, DollarSign, Star, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/* ── Types ────────────────────────────────────────────────────────────── */
interface TrendingSpot {
  id: string;
  title: string;
  address: string;
  price_per_hour: number | null;
  price_per_event: number | null;
  images: string[];
  avg_rating: number | null;
  review_count: number;
}

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

const features = [
  {
    icon: MapPin,
    title: "Find Parking Anywhere",
    description:
      "Browse hundreds of verified parking spots near stadiums, airports, downtown areas, and more across Georgia.",
  },
  {
    icon: Shield,
    title: "Safe & Secure",
    description:
      "Every booking is protected. We verify hosts and provide secure payments so you can park with confidence.",
  },
  {
    icon: DollarSign,
    title: "Earn from Your Space",
    description:
      "Got an unused driveway, garage, or parking lot? List it on ParkGA and start earning passive income today.",
  },
  {
    icon: Search,
    title: "Easy Booking",
    description:
      "Search by location, date, and price. Book instantly with a few taps. No hassle, no hidden fees.",
  },
];

/* ── Skeleton Card ─────────────────────────────────────────────────── */
function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-xl border border-gray-200 overflow-hidden">
      <div className="aspect-[4/3] bg-gray-200" />
      <div className="p-4 space-y-3">
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

/* ── Spot Card ─────────────────────────────────────────────────────── */
function SpotCard({ spot }: { spot: TrendingSpot }) {
  const imageUrl =
    spot.images && spot.images.length > 0
      ? spot.images[0]
      : "https://images.unsplash.com/photo-1506521781265-d8422e82f816?w=600&q=80";

  const displayPrice =
    spot.price_per_event ?? spot.price_per_hour ?? 0;
  const priceLabel =
    spot.price_per_event ? `$${Number(displayPrice).toFixed(0)}` : `$${Number(displayPrice).toFixed(2)}/hr`;
  const unit = spot.price_per_event ? " per event" : "";

  return (
    <Link
      href={`/listings/${spot.id}`}
      className="group block rounded-xl border border-gray-200 overflow-hidden transition-all hover:shadow-lg hover:-translate-y-1"
    >
      {/* Edge-to-edge image */}
      <div className="relative aspect-[4/3] overflow-hidden">
        <div
          className="h-full w-full bg-cover bg-center transition-transform duration-500 group-hover:scale-110"
          style={{ backgroundImage: `url('${imageUrl}')` }}
        />
      </div>

      {/* Details */}
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 truncate group-hover:text-parkga-600 transition-colors">
          {spot.title}
        </h3>
        <p className="mt-0.5 text-sm text-gray-500 truncate">{spot.address}</p>

        <div className="mt-2 flex items-center justify-between">
          <span className="text-lg font-bold text-gray-900">
            {priceLabel}
            <span className="text-sm font-normal text-gray-500">{unit}</span>
          </span>

          {/* Star rating */}
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
  );
}

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

        {/* Grid */}
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
            : spots.length > 0
              ? spots.map((spot) => <SpotCard key={spot.id} spot={spot} />)
              : Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>

        {/* Mobile "View all" link */}
        <div className="mt-8 text-center sm:hidden">
          <Link
            href="/listings"
            className="inline-flex items-center gap-1 text-sm font-semibold text-parkga-600 hover:text-parkga-700 transition-colors"
          >
            View all &rarr;
          </Link>
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
            <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl">
              Find Parking for{" "}
              <span className="inline-block text-parkga-400">
                {typedText}
                <span className="animate-cursor ml-0.5 font-light text-parkga-400">|</span>
              </span>
            </h1>

            <p className="mt-6 text-lg leading-8 text-gray-300">
              ParkGA is the peer-to-peer marketplace that connects drivers with
              affordable parking spots hosted by locals. Skip the expensive lots
              and park smarter.
            </p>

            {/* ── Pill-Shaped Search Bar ──────────────────────────────── */}
            <div className="mt-10">
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

      {/* ── Features Section ─────────────────────────────────────────── */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Why ParkGA?
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              We make parking simple for drivers and rewarding for hosts.
            </p>
          </div>
          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-green-500 hover:shadow-lg"
                >
                  <div className="inline-flex rounded-lg bg-parkga-100 p-3">
                    <Icon className="h-6 w-6 text-parkga-600" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-gray-900">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-sm text-gray-500">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Host Spotlight Section ──────────────────────────────────────── */}
      <section className="bg-slate-900 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center gap-12 md:flex-row">
            {/* Left — Image */}
            <div className="w-full md:w-1/2">
              <div
                className="aspect-[4/3] w-full rounded-2xl bg-cover bg-center shadow-xl"
                style={{
                  backgroundImage:
                    "url('https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&q=80')",
                }}
              />
            </div>

            {/* Right — Content */}
            <div className="w-full text-center md:w-1/2 md:text-left">
              <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
                Your Driveway.
                <span className="block text-parkga-400">Their Parking Spot.</span>
              </h2>
              <p className="mt-6 text-lg leading-8 text-slate-300">
                Unlike corporate garages, ParkGA is built by locals, for locals.
                Turn your empty driveway into passive income during game days and
                local events. We handle the payments, you keep the profits.
              </p>
              <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row md:justify-start">
                <a
                  href="/host/new"
                  className="inline-flex items-center gap-2 rounded-xl bg-parkga-600 px-8 py-4 text-base font-semibold text-white shadow-lg transition-all duration-300 hover:bg-parkga-500 hover:shadow-xl active:scale-95"
                >
                  Start Earning Today
                  <span aria-hidden="true" className="text-lg">&rarr;</span>
                </a>
                <a
                  href="/listings"
                  className="inline-flex items-center gap-1 text-sm font-medium text-slate-400 transition-colors hover:text-white"
                >
                  Browse parking spots
                  <span aria-hidden="true">&rarr;</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA Section ───────────────────────────────────────────── */}
      <section className="bg-parkga-600 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Ready to Get Started?
            </h2>
            <p className="mt-4 text-lg text-parkga-100">
              Join thousands of drivers and hosts across Georgia.
            </p>
            <div className="mt-8 flex items-center justify-center gap-4">
              <a
                href="/auth/signup"
                className="rounded-lg bg-white px-6 py-3 text-base font-semibold text-parkga-600 transition-colors hover:bg-parkga-50"
              >
                Create an Account
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
