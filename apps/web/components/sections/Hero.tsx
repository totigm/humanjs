'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { EASE_EXPO } from '../../lib/motion';
import { GithubMark } from '../icons';
import { MiniCursorDemo } from '../motion';
import { Button } from '../primitives';

const eyebrowVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE_EXPO } },
};

const lineContainerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.15 } },
};

const lineVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.85, ease: EASE_EXPO } },
};

const subVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: (delay: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, delay, ease: EASE_EXPO },
  }),
};

export function Hero() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section id="top" className="relative overflow-hidden pt-28 pb-20 md:pt-36 md:pb-28">
      {/* Editorial background grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.025]"
        style={{
          backgroundImage:
            'linear-gradient(to right, #f5ede0 1px, transparent 1px), linear-gradient(to bottom, #f5ede0 1px, transparent 1px)',
          backgroundSize: '80px 80px',
        }}
      />
      {/* Amber halo */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/4 -z-10 h-[600px] w-[600px] rounded-full opacity-50 blur-3xl"
        style={{
          background: 'radial-gradient(circle, rgba(245,165,92,0.10), transparent 60%)',
        }}
      />

      <div className="mx-auto max-w-7xl px-6 md:px-10">
        <motion.p
          variants={eyebrowVariants}
          initial={shouldReduceMotion ? undefined : 'hidden'}
          animate={shouldReduceMotion ? undefined : 'visible'}
          className="mb-8 font-mono text-[11px] uppercase tracking-[0.32em] text-muted"
        >
          <span className="text-accent">v0.9</span>
          <span aria-hidden className="mx-3 text-muted/40">
            /
          </span>
          MIT licensed
          <span aria-hidden className="mx-3 text-muted/40">
            /
          </span>
          Built on Playwright
        </motion.p>

        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-7">
            <motion.h1
              variants={shouldReduceMotion ? undefined : lineContainerVariants}
              initial={shouldReduceMotion ? undefined : 'hidden'}
              animate={shouldReduceMotion ? undefined : 'visible'}
              className="font-sans text-[clamp(2.75rem,7.5vw,7rem)] font-medium leading-[0.95] tracking-[-0.025em] text-foreground"
            >
              <motion.span
                variants={shouldReduceMotion ? undefined : lineVariants}
                className="block"
              >
                <span className="font-display italic text-accent" data-ghost-cursor="true">
                  Humanize
                </span>{' '}
                <span>the cursor.</span>
              </motion.span>
              <motion.span
                variants={shouldReduceMotion ? undefined : lineVariants}
                className="block text-muted-strong"
                style={{ color: 'var(--color-muted-strong)' }}
              >
                The typing.
              </motion.span>
              <motion.span
                variants={shouldReduceMotion ? undefined : lineVariants}
                className="block"
                style={{ color: 'var(--color-muted)' }}
              >
                The pace.
              </motion.span>
            </motion.h1>

            <motion.p
              variants={subVariants}
              initial={shouldReduceMotion ? undefined : 'hidden'}
              animate={shouldReduceMotion ? undefined : 'visible'}
              custom={0.7}
              className="mt-10 max-w-[34rem] text-pretty text-lg leading-relaxed text-muted-strong md:text-xl"
            >
              The Playwright wrapper that gives browser automation a heartbeat. Real Bezier paths,
              real typing rhythm, real pre-click dwell — driven by four personalities you can
              extend, compose, or replace.
            </motion.p>

            <motion.div
              variants={subVariants}
              initial={shouldReduceMotion ? undefined : 'hidden'}
              animate={shouldReduceMotion ? undefined : 'visible'}
              custom={0.9}
              className="mt-10 flex flex-col items-start gap-3 sm:flex-row sm:items-center"
            >
              <Button size="lg" href="#install">
                Read the install
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button size="lg" variant="secondary" href="https://github.com/totigm/humanjs">
                <GithubMark size={16} />
                <span>totigm/humanjs</span>
              </Button>
            </motion.div>

            <motion.div
              variants={subVariants}
              initial={shouldReduceMotion ? undefined : 'hidden'}
              animate={shouldReduceMotion ? undefined : 'visible'}
              custom={1.1}
              className="mt-12 flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted/70"
            >
              <span>Bezier · jitter · dwell</span>
              <span aria-hidden className="text-muted/40">
                ·
              </span>
              <span>4 personalities</span>
              <span aria-hidden className="text-muted/40">
                ·
              </span>
              <span>Deterministic by seed</span>
            </motion.div>
          </div>

          <motion.div
            variants={subVariants}
            initial={shouldReduceMotion ? undefined : 'hidden'}
            animate={shouldReduceMotion ? undefined : 'visible'}
            custom={1.0}
            className="relative lg:col-span-5 lg:pt-12"
          >
            <div className="relative">
              <div
                aria-hidden
                className="pointer-events-none absolute -inset-6 -z-10 rounded-[2rem] opacity-50 blur-2xl"
                style={{
                  background:
                    'radial-gradient(60% 50% at 50% 50%, rgba(245,165,92,0.18), transparent 70%)',
                }}
              />
              <MiniCursorDemo />
              <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.2em] text-muted/60">
                Live. Powered by <span className="text-accent">@humanjs/core</span>{' '}
                <span aria-hidden className="text-muted/40">
                  ·
                </span>{' '}
                rerolls every cycle
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
