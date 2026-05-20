'use client';

import { motion, useInView, useReducedMotion } from 'framer-motion';
import { useRef } from 'react';

const PATH_A = 'M 50 320 C 120 280, 220 340, 280 240 S 360 100, 380 60';
const PATH_B = 'M 30 340 C 90 260, 180 320, 250 220 S 320 80, 350 40';

export function BezierDecoration() {
  const shouldReduceMotion = useReducedMotion();
  const ref = useRef<SVGSVGElement | null>(null);
  const inView = useInView(ref, { margin: '0px 0px -10% 0px', once: true });

  return (
    <svg
      ref={ref}
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 400 360"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden
    >
      <defs>
        <linearGradient id="bezier-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f5a55c" stopOpacity="0" />
          <stop offset="50%" stopColor="#f5a55c" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#f5a55c" stopOpacity="0.1" />
        </linearGradient>
        <linearGradient id="bezier-gradient-2" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#5b7cc9" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#5b7cc9" stopOpacity="0.05" />
        </linearGradient>
      </defs>

      <motion.path
        d={PATH_A}
        fill="none"
        stroke="url(#bezier-gradient)"
        strokeWidth="1.75"
        strokeLinecap="round"
        initial={shouldReduceMotion ? { pathLength: 1 } : { pathLength: 0, opacity: 0 }}
        animate={inView ? { pathLength: 1, opacity: 1 } : undefined}
        transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
      />
      <motion.path
        d={PATH_B}
        fill="none"
        stroke="url(#bezier-gradient-2)"
        strokeWidth="1.25"
        strokeLinecap="round"
        initial={shouldReduceMotion ? { pathLength: 1 } : { pathLength: 0, opacity: 0 }}
        animate={inView ? { pathLength: 1, opacity: 1 } : undefined}
        transition={{ duration: 1.8, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
      />

      <motion.g
        initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
        animate={inView ? { opacity: 1 } : undefined}
        transition={{ delay: 1.5, duration: 0.5 }}
      >
        <circle cx="380" cy="60" r="3" fill="#f5a55c" />
        <circle cx="380" cy="60" r="8" fill="none" stroke="#f5a55c" strokeOpacity="0.4" />
      </motion.g>

      <motion.circle
        cx="50"
        cy="320"
        r="2.5"
        fill="#f5a55c"
        opacity="0.6"
        initial={shouldReduceMotion ? { opacity: 0.6 } : { opacity: 0 }}
        animate={inView ? { opacity: 0.6 } : undefined}
        transition={{ delay: 0, duration: 0.3 }}
      />
    </svg>
  );
}
