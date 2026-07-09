"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, Calendar, MapPin, Shield, DollarSign } from "lucide-react";

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
          // Still typing
          if (text.length < currentWord.length) {
            setText(currentWord.slice(0, text.length + 1));
            return;
          }
          // Finished typing → pause, then delete
          const pause = setTimeout(() => setIsDeleting(true), pauseTime);
          return () => clearTimeout(pause);
        }

        // Deleting
        if (text.length > 0) {
          setText(currentWord.slice(0, text.length - 1));
          return;
        }
        // Finished deleting → move to next word
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
        {/* Dark overlay for readability */}
        <div className="absolute inset-0 bg-black/60" />

        {/* Content */}
        <div className="relative z-10 mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:py-32">
          <div className="mx-auto max-w-3xl text-center">
            {/* Headline with typing effect */}
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
                {/* Location */}
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

                {/* Divider */}
                <div className="hidden h-8 w-px bg-gray-200 sm:block" />

                {/* Date picker placeholder */}
                <div className="hidden flex-1 items-center gap-2 px-4 py-2 sm:flex">
                  <Calendar className="h-5 w-5 shrink-0 text-gray-400" />
                  <span className="whitespace-nowrap text-sm text-gray-400">
                    Add dates
                  </span>
                </div>

                {/* Divider */}
                <div className="hidden h-8 w-px bg-gray-200 sm:block" />

                {/* Search CTA */}
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

        {/* Subtle bottom fade to blend into next section */}
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white to-transparent" />
      </section>

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
                  className="rounded-xl border border-gray-200 p-6 transition-shadow hover:shadow-md"
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

      {/* ── CTA Section ──────────────────────────────────────────────── */}
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
