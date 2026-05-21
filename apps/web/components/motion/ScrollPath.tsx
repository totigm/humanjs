'use client';

import { motion, useReducedMotion, useScroll, useSpring, useTransform } from 'framer-motion';
import { useId } from 'react';

/**
 * A continuous bezier line that runs down the right edge of the page,
 * drawing in proportion to scroll progress. Mirrors what a HumanJS
 * trajectory looks like — soft curves, not a straight line.
 */
export function ScrollPath() {
  const shouldReduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const smoothed = useSpring(scrollYProgress, { stiffness: 80, damping: 30, mass: 0.5 });
  const dashOffset = useTransform(smoothed, [0, 1], [1200, 0]);
  const endpointOpacity = useTransform(smoothed, [0.95, 1], [0, 1]);
  const reactId = useId();
  const gradId = `scroll-path-${reactId}`;

  if (shouldReduceMotion) return null;

  return (
    <svg
      aria-hidden
      className="pointer-events-none fixed right-4 top-0 z-[5] hidden h-screen w-12 md:block lg:right-6 lg:w-16"
      viewBox="0 0 64 1200"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#f5a55c" stopOpacity="0" />
          <stop offset="10%" stopColor="#f5a55c" stopOpacity="0.6" />
          <stop offset="50%" stopColor="#f5a55c" stopOpacity="0.85" />
          <stop offset="90%" stopColor="#f5a55c" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#f5a55c" stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.path
        d="M 32 0 C 12 200, 56 380, 28 560 S 8 920, 32 1200"
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeDasharray="1200"
        style={{ strokeDashoffset: dashOffset }}
      />
      {/* Endpoint dots */}
      <circle cx="32" cy="0" r="2" fill="#f5a55c" opacity="0.4" />
      <motion.circle cx="32" cy="1200" r="3" fill="#f5a55c" style={{ opacity: endpointOpacity }} />
    </svg>
  );
}
