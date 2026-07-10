"use client";

import { useRef, useState } from "react";
import { motion, useScroll, useMotionValueEvent } from "framer-motion";

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
    "absolute top-[15%] right-0 -translate-y-1/2 z-20 mr-0 md:mr-[40%]",
    "absolute top-[50%] left-0 -translate-y-1/2 z-20 ml-0 md:ml-[35%]",
    "absolute top-[85%] right-0 -translate-y-1/2 z-20 mr-0 md:mr-[40%]",
  ][index];

  return (
    <motion.div
      className={`${positionClasses} flex items-center gap-2 rounded-xl border border-gray-100 bg-white p-2 shadow-xl sm:gap-4 sm:p-4 lg:gap-6 lg:p-6 lg:rounded-2xl overflow-hidden`}
      style={{
        width: "clamp(140px, 55vw, 450px)",
      }}
      animate={{
        opacity: isActive ? 1 : 0.35,
        scale: isActive ? 1 : 0.92,
      }}
      transition={{ type: "spring", bounce: 0.3, duration: 0.6 }}
    >
      {/* 3D Image — full responsive scale from mobile to desktop */}
      <motion.img
        src={step.image}
        alt={step.title}
        className="h-10 w-10 shrink-0 object-contain drop-shadow-lg sm:h-12 sm:w-12 md:h-16 md:w-16 lg:h-24 lg:w-24 xl:h-28 xl:w-28"
        variants={IMAGE_VARIANTS}
        animate={isActive ? "active" : "inactive"}
      />

      {/* Text content — line-clamp prevents overflow on tiny screens */}
      <div className="min-w-0 flex-1">
        <h3 className="text-xs font-bold text-gray-900 sm:text-sm md:text-base lg:text-lg xl:text-xl">
          {step.title}
        </h3>
        <p className="mt-0.5 text-[9px] leading-tight text-gray-500 line-clamp-2 sm:text-[11px] sm:leading-relaxed sm:line-clamp-3 md:text-sm lg:line-clamp-none xl:text-base">
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

  return (
    <section ref={containerRef} className="relative h-[300vh]">
      {/* ── Sticky container — flex-col so canvas flex-1 fills remaining space ── */}
      <div className="sticky top-0 relative flex flex-col h-screen w-full bg-white">
        {/* Dot-pattern background */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              "radial-gradient(circle, #16a34a 0.75px, transparent 0.75px)",
            backgroundSize: "24px 24px",
          }}
        />

        {/* Title — fixed at top, highest z-index to stay above cards */}
        <div className="relative z-30 text-center pt-6 sm:pt-8 pb-2 sm:pb-4">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl md:text-4xl">
            How It Works
          </h2>
          <p className="mt-1 text-xs text-gray-500 sm:text-sm">
            Scroll to follow the journey
          </p>
        </div>

        {/* Canvas — padding creates a gutter zone around the SVG where cards sit safely */}
        <div className="relative w-full max-w-5xl mx-auto overflow-hidden flex-1 min-h-[500px] px-4 sm:px-6 md:px-0">
          {/* SVG — inset from edges so cards in the gutter don't overlap the path */}
          <svg
            className="absolute inset-x-4 sm:inset-x-6 md:inset-x-0 inset-y-0 h-full"
            viewBox="0 0 100 200"
            preserveAspectRatio="xMidYMid meet"
            style={{ pointerEvents: "none" }}
          >
            {/* Grey background path */}
            <path
              d={SVG_PATH}
              stroke="#e5e7eb"
              strokeWidth={1.5}
              fill="none"
              strokeLinecap="round"
            />

            {/* Animated green path */}
            <motion.path
              d={SVG_PATH}
              stroke="#16a34a"
              strokeWidth={2}
              fill="none"
              strokeLinecap="round"
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
      </div>
    </section>
  );
}
