'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, BookOpen } from 'lucide-react';
import { AmbientBlobs, VideoFrame } from '../media';
import { Button, Container } from '../primitives';

const headlineWords = ['Humanize', 'your'];
const headlineAccentWords = ['browser', 'automation.'];

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.04, delayChildren: 0.05 },
  },
};

const wordVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] as const },
  },
};

const fadeUpVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: (delay: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] as const },
  }),
};

export function Hero() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section id="top" className="relative overflow-hidden pb-24 pt-32 md:pb-32 md:pt-40">
      <AmbientBlobs />

      <Container width="lg" className="relative">
        <div className="text-center">
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="mb-6 font-mono text-xs uppercase tracking-[0.3em] text-muted"
          >
            v0.2 · MIT licensed · Built on Playwright
          </motion.p>

          <motion.h1
            variants={shouldReduceMotion ? undefined : containerVariants}
            initial={shouldReduceMotion ? undefined : 'hidden'}
            animate={shouldReduceMotion ? undefined : 'visible'}
            className="text-balance text-5xl font-semibold leading-[1.02] tracking-[-0.025em] md:text-7xl lg:text-[5.5rem]"
          >
            {headlineWords.map((word) => (
              <motion.span
                key={word}
                variants={shouldReduceMotion ? undefined : wordVariants}
                className="mr-[0.25em] inline-block"
              >
                {word}
              </motion.span>
            ))}
            <br className="hidden md:inline" />
            {headlineAccentWords.map((word, i) => (
              <motion.span
                key={word}
                variants={shouldReduceMotion ? undefined : wordVariants}
                className="mr-[0.25em] inline-block text-accent"
              >
                {word}
                {i === headlineAccentWords.length - 1 ? '' : ''}
              </motion.span>
            ))}
          </motion.h1>

          <motion.p
            variants={fadeUpVariants}
            initial={shouldReduceMotion ? undefined : 'hidden'}
            animate={shouldReduceMotion ? undefined : 'visible'}
            custom={0.5}
            className="mx-auto mt-8 max-w-2xl text-balance text-lg text-muted md:text-xl"
          >
            Realistic mouse paths, typing rhythm, reading dwell, and four personalities.
            <br className="hidden md:inline" /> The library that makes AI agents and demos feel
            human.
          </motion.p>

          <motion.div
            variants={fadeUpVariants}
            initial={shouldReduceMotion ? undefined : 'hidden'}
            animate={shouldReduceMotion ? undefined : 'visible'}
            custom={0.7}
            className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <Button size="lg" href="#install">
              Get started
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button size="lg" variant="secondary" href="#features">
              <BookOpen className="h-4 w-4" />
              See it work
            </Button>
          </motion.div>
        </div>

        <motion.div
          variants={fadeUpVariants}
          initial={shouldReduceMotion ? undefined : 'hidden'}
          animate={shouldReduceMotion ? undefined : 'visible'}
          custom={0.9}
          className="relative mx-auto mt-16 max-w-4xl md:mt-20"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-x-8 -inset-y-4 -z-10 rounded-[2rem] opacity-50 blur-2xl"
            style={{
              background:
                'radial-gradient(60% 50% at 50% 50%, rgba(245, 165, 92, 0.15), transparent 70%)',
            }}
          />
          <VideoFrame />
        </motion.div>
      </Container>
    </section>
  );
}
