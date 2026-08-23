"use client";

import { useRef, useState } from "react";
import { motion, useScroll, useMotionValueEvent, useInView } from "framer-motion";

/* -- Step Data ------------------------------------------------------------ */
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

/* -- Wide Sweeping S-Curve (viewBox 0 0 100 200) ----------------------- */
const SVG_PATH = "M 15 5 C 15 60, 85 40, 85 100 C 85 160, 15 140, 15 195";

/* -- Spring Image Variants ------------------------------------------------ */
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

/* -- Horizontal align classes: Card 1 & 3 right, Card 2 left ------------ */
const ALIGN_CLASSES = [
  "self-end justify-self-end mr-0 lg:mr-[40%]",
  "self-start justify-self-start ml-0 lg:ml-[35%]",
  "self-end justify-self-end mr-0 lg:mr-[40%]",
];

/* -- Step Card ------------------------------------------------------------ */
function StepCard({
  step,
  index,
  isActive,
}: {
  step: (typeof STEPS)[number];
  index: number;
  isActive: boolean;
}) {
  return (
    <motion.div
      className={`${ALIGN_CLASSES[index]} relative z-10 flex items-center gap-1 rounded-xl border border-gray-100 bg-white p-1.5 shadow-xl overflow-hidden max-w-[95vw] sm:gap-3 sm:p-3 lg:gap-4 lg:p-4 lg:rounded-2xl sm:max-w-[450px]`}
      animate={{
        opacity: isActive ? 1 : 0.35,
        scale: isActive ? 1 : 0.92,
      }}
      transition={{ type: "spring", bounce: 0.3, duration: 0.6 }}
    >
      {/* 3D Image */}
      <motion.img
        src={step.image}
        alt={step.title}
        className="h-6 w-6 shrink-0 object-contain drop-shadow-lg sm:h-10 sm:w-10 md:h-12 md:w-12 lg:h-16 lg:w-16 xl:h-20 xl:w-20"
        variants={IMAGE_VARIANTS}
        animate={isActive ? "active" : "inactive"}
      />

      {/* Text content */}
      <div className="min-w-0 flex-1">
        <h3 className="text-[10px] font-bold text-slate-900 sm:text-xs md:text-sm lg:text-base xl:text-lg">
          {step.title}
        </h3>
        <p className="mt-0.5 text-[8px] leading-tight text-slate-500 line-clamp-2 sm:text-[10px] sm:leading-relaxed sm:line-clamp-3 md:text-xs lg:text-sm lg:line-clamp-none xl:text-base">
          {step.description}
        </p>
      </div>
    </motion.div>
  );
}

/* -- Mobile Step Card (simpler, with spring-in animation) --------------- */
function MobileStepCard({
  step,
  index,
}: {
  step: (typeof STEPS)[number];
  index: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <motion.div
      ref={ref}
      className="relative flex flex-col md:flex-row items-start md:items-center gap-4 pl-8 pb-12 last:pb-0"
      initial={{ opacity: 0, x: -30 }}
      animate={isInView ? { opacity: 1, x: 0 } : {}}
      transition={{ type: "spring", bounce: 0.5, duration: 0.8, delay: index * 0.15 }}
    >
      {/* 3D Image */}
      <motion.img
        src={step.image}
        alt={step.title}
        className="relative z-10 flex-shrink-0 w-16 h-16 md:w-32 md:h-32 mb-4 md:mb-0 object-contain drop-shadow-lg"
        initial={{ scale: 0, rotate: -20 }}
        animate={isInView ? { scale: 1, rotate: 0 } : {}}
        transition={{ type: "spring", bounce: 0.6, duration: 0.8, delay: index * 0.15 + 0.2 }}
      />

      {/* Text content */}
      <div className="min-w-0 flex-1 rounded-xl border border-gray-100 bg-white p-4 shadow-lg">
        <h3 className="text-sm font-bold text-slate-900">
          {step.title}
        </h3>
        <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
          {step.description}
        </p>
      </div>
    </motion.div>
  );
}

/* -- Desktop How It Works Section (scroll-driven SVG S-curve) ----------- */
function DesktopHowItWorks() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(-1);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  /* Derive active step index -1/0/1/2 from scroll progress */
  useMotionValueEvent(scrollYProgress, "change", (p: number) => {
    if (p < 0.05) setActiveIndex(-1);
    else if (p < 0.33) setActiveIndex(0);
    else if (p < 0.66) setActiveIndex(1);
    else setActiveIndex(2);
  });

  return (
    <section ref={containerRef} className="relative h-[300vh]">
      {/* -- Sticky container ----------------------------------------------- */}
      <div className="sticky top-0 relative flex flex-col h-screen w-full bg-white">
        {/* Dot-pattern background */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              "radial-gradient(circle, #00B370 0.75px, transparent 0.75px)",
            backgroundSize: "24px 24px",
          }}
        />

        {/* Title */}
        <div className="relative z-30 text-center pt-6 sm:pt-8 pb-2 sm:pb-4">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl md:text-4xl">
            How It Works
          </h2>
          <p className="mt-1 text-xs text-slate-500 sm:text-sm">
            Scroll to follow the journey
          </p>
        </div>

        {/* -- Canvas: flex-col justify-between distributes cards naturally -- */}
        <div className="relative flex flex-col justify-between flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-0 overflow-hidden pb-4">
          {/* SVG - absolute behind the cards */}
          <svg
            className="absolute inset-x-4 sm:inset-x-6 lg:inset-x-0 inset-y-0 h-full z-0"
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

            {/* Animated brand path */}
            <motion.path
              d={SVG_PATH}
              stroke="#00B370"
              strokeWidth={2}
              fill="none"
              strokeLinecap="round"
              style={{ pathLength: scrollYProgress }}
            />
          </svg>

          {/* Step Cards - flex children distributed via justify-between */}
          {STEPS.map((step, i) => (
            <StepCard
              key={step.title}
              step={step}
              index={i}
              isActive={i <= activeIndex}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

/* -- Mobile How It Works Section (no S-curve, stacked cards, green line) - */
function MobileHowItWorks() {
  return (
    <section className="bg-white py-16 px-4">
      {/* Title */}
      <div className="text-center mb-10">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">
          How It Works
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Three easy steps to park smarter
        </p>
      </div>

      {/* Dot-pattern background */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            "radial-gradient(circle, #00B370 0.75px, transparent 0.75px)",
          backgroundSize: "24px 24px",
        }}
      />

      {/* Vertical cards with green line */}
      <div className="relative mx-auto max-w-md">
        {/* Straight vertical green line */}
        <div className="absolute left-[19px] top-1 bottom-6 w-0.5 bg-green-200" />
        <div className="absolute left-[19px] top-1 w-0.5 bg-green-500 animate-mobile-line-grow" />

        {STEPS.map((step, i) => (
          <MobileStepCard key={step.title} step={step} index={i} />
        ))}
      </div>

    </section>
  );
}

/* -- How It Works Section ------------------------------------------------- */
export default function HowItWorks() {
  return (
    <>
      {/* Desktop version with S-curve SVG */}
      <div className="hidden md:block">
        <DesktopHowItWorks />
      </div>

      {/* Mobile version: stacked cards with straight green line */}
      <div className="block md:hidden">
        <MobileHowItWorks />
      </div>
    </>
  );
}
