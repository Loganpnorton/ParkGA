"use client";

import { useRef, useState } from "react";
import { motion, useScroll, useMotionValueEvent, useTransform } from "framer-motion";

/* ── Step Data ──────────────────────────────────────────────────────────── */
const STEPS = [
  {
    title: "Find a Spot",
    description:
      "Browse hundreds of verified parking spots near stadiums, airports, and event venues across Georgia. Filter by price, location, and date.",
    image: "/3d-pin.png",
  },
  {
    title: "Book & Pay",
    description:
      "Reserve instantly with secure checkout. No hidden fees, no hassle. Your booking is protected from the moment you pay.",
    image: "/3d-card.png",
  },
  {
    title: "Park & Go",
    description:
      "Get digital access instructions and park with confidence. We handle the verification so you can focus on the game, event, or wherever life takes you.",
    image: "/3d-ticket.png",
  },
] as const;

/* ── SVG Winding Bezier Curve (viewBox 0 0 100 100) ─────────────────────── */
const SVG_PATH = "M 12,10 C 40,5 68,18 80,38 C 88,54 62,76 18,86";

/* ── Card Positions (% on the Relative Canvas) ──────────────────────────── */
const CARD_POSITIONS: {
  top: string;
  left?: string;
  right?: string;
}[] = [
  { top: "8%", left: "0%" },   // Step 1 — top-left, alongside curve start
  { top: "40%", right: "0%" },  // Step 2 — middle-right, alongside curve apex
  { top: "76%", left: "0%" },   // Step 3 — bottom-left, alongside curve end
];

/* ── Spring Image Variants ──────────────────────────────────────────────── */
const IMAGE_VARIANTS = {
  active: {
    x: 0,
    scale: 1,
    opacity: 1,
    rotate: 0,
    transition: { type: "spring" as const, bounce: 0.6, duration: 0.8 },
  },
  inactive: {
    x: -60,
    scale: 0.5,
    opacity: 0,
    rotate: -15,
    transition: { type: "spring" as const, bounce: 0 },
  },
};

/* ── Step Card ──────────────────────────────────────────────────────────── */
function StepCard({
  step,
  index,
  isActive,
}: {
  step: (typeof STEPS)[number];
  index: number;
  isActive: boolean;
}) {
  const pos = CARD_POSITIONS[index];

  return (
    <motion.div
      className="absolute flex items-center gap-5 rounded-2xl border border-gray-100 bg-white/80 p-5 shadow-xl backdrop-blur-md sm:gap-6 sm:p-6"
      style={{
        top: pos.top,
        left: (pos.left as string | undefined) ?? "auto",
        right: (pos.right as string | undefined) ?? "auto",
        width: "clamp(220px, 38vw, 340px)",
      }}
      animate={{
        opacity: isActive ? 1 : 0.45,
        scale: isActive ? 1 : 0.95,
      }}
      transition={{ type: "spring", bounce: 0.3, duration: 0.6 }}
    >
      {/* 3D Image — springs out when active, sucks back when inactive */}
      <motion.img
        src={step.image}
        alt={step.title}
        className="h-14 w-14 shrink-0 object-contain drop-shadow-2xl sm:h-16 sm:w-16"
        variants={IMAGE_VARIANTS}
        animate={isActive ? "active" : "inactive"}
      />

      {/* Text content */}
      <div className="min-w-0 flex-1">
        <h3 className="text-base font-bold text-gray-900 sm:text-lg">
          {step.title}
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-gray-500 sm:text-sm">
          {step.description}
        </p>
      </div>
    </motion.div>
  );
}

/* ── How It Works Section ───────────────────────────────────────────────── */
export default function HowItWorks() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  /* Derive active step index (0, 1, 2) from scroll progress */
  useMotionValueEvent(scrollYProgress, "change", (p: number) => {
    if (p < 0.33) setActiveIndex(0);
    else if (p < 0.66) setActiveIndex(1);
    else setActiveIndex(2);
  });

  /* Scroll hint fades out as user progresses */
  const scrollHintOpacity = useTransform(
    scrollYProgress,
    [0, 0.12, 0.25],
    [1, 0.5, 0],
  );

  return (
    <section ref={containerRef} className="relative h-[300vh]">
      {/* ── Sticky container ──────────────────────────────────────────── */}
      <div className="sticky top-0 flex h-screen w-full items-center justify-center overflow-hidden bg-white">
        {/* Dot-pattern background */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
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

        {/* ── Relative Canvas ──────────────────────────────────────────── */}
        <div className="relative w-full max-w-5xl aspect-[3/4] md:aspect-video">
          {/* SVG Winding Line */}
          <svg
            className="absolute inset-0 h-full w-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            style={{ pointerEvents: "none" }}
          >
            <defs>
              <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="1.5" result="blur" />
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
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
            />

            {/* Animated green path (draws itself on scroll) */}
            <motion.path
              d={SVG_PATH}
              stroke="#16a34a"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              filter="url(#glow)"
              style={{ pathLength: scrollYProgress }}
            />
          </svg>

          {/* Step Cards */}
          {STEPS.map((step, i) => (
            <StepCard
              key={step.title}
              step={step}
              index={i}
              isActive={activeIndex === i}
            />
          ))}
        </div>

        {/* ── Scroll Hint ─────────────────────────────────────────────── */}
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
