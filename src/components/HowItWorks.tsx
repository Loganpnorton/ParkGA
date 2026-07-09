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

/* ── Wide Sweeping S-Curve (viewBox 0 0 100 200) ─────────────────────── */
const SVG_PATH = "M 15 5 C 15 60, 85 40, 85 100 C 85 160, 15 140, 15 195";

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
  const positionClasses = [
    "absolute top-[10%] left-[40%] md:left-[35%] -translate-y-1/2 z-20",
    "absolute top-[50%] right-[40%] md:right-[35%] -translate-y-1/2 z-20",
    "absolute top-[90%] left-[40%] md:left-[35%] -translate-y-1/2 z-20",
  ][index];

  return (
    <motion.div
      className={`${positionClasses} flex items-center gap-5 rounded-2xl border border-gray-100 bg-white/80 p-5 shadow-xl backdrop-blur-md sm:gap-6 sm:p-6`}
      style={{
        width: "clamp(300px, 36vw, 450px)",
      }}
      animate={{
        opacity: isActive ? 1 : 0.35,
        scale: isActive ? 1 : 0.92,
      }}
      transition={{ type: "spring", bounce: 0.3, duration: 0.6 }}
    >
      {/* 3D Image — springs out when active, sucks back when inactive */}
      <motion.img
        src={step.image}
        alt={step.title}
        className="h-24 w-24 shrink-0 object-contain drop-shadow-2xl md:h-32 md:w-32"
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

        {/* ── Tall Relative Canvas ─────────────────────────────────────── */}
        <div className="flex flex-col items-center w-full max-w-5xl mx-auto">
          {/* Title — OUTSIDE canvas with mb-12 breathing room */}
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              How It Works
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              Scroll to follow the journey
            </p>
          </div>

          {/* Canvas */}
          <div className="relative w-full h-[800px] md:h-[1200px]">
          {/* SVG Elongated S-Curve */}
          <svg
            className="absolute inset-0 h-full w-full"
            viewBox="0 0 100 200"
            preserveAspectRatio="none"
            style={{ pointerEvents: "none" }}
          >
            <defs>
              <filter
                id="glow"
                x="-20%"
                y="-20%"
                width="140%"
                height="140%"
              >
                <feGaussianBlur stdDeviation="1" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Grey background path — thin, elegant */}
            <path
              d={SVG_PATH}
              stroke="#e5e7eb"
              strokeWidth={1}
              fill="none"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />

            {/* Animated green path — sleek laser */}
            <motion.path
              d={SVG_PATH}
              stroke="#16a34a"
              strokeWidth={2}
              fill="none"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              filter="url(#glow)"
              style={{ pathLength: scrollYProgress }}
            />
          </svg>

          {/* Step Cards — anchored with translate-y to sit centered beside the curve */}
          {STEPS.map((step, i) => (
            <StepCard
              key={step.title}
              step={step}
              index={i}
              isActive={activeIndex === i}
            />
          ))}
          </div>
        </div>

        {/* ── Scroll Hint ─────────────────────────────────────────────── */}
        <motion.div
          className="absolute bottom-6 left-1/2 z-30 -translate-x-1/2"
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
