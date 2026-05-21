'use client';

import {
  computeReadingDwellMs,
  createRng,
  type PresetName,
  resolvePersonality,
} from '@humanjs/core';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '../../lib/cn';
import { IN_VIEW_MARGIN } from '../../lib/motion';
import { DemoStatusBar } from './DemoStatusBar';

/**
 * Phrase the demo "reads." Brand-direct passage that ties the three pillars
 * together — picked so the demo reads as a self-contained statement.
 */
const PASSAGE =
  "The cursor doesn't have to lie. It can take a real path, type at a real rhythm, and dwell where a person would dwell.";

/**
 * Demo-only speed factor per personality. Same idea as the typing demo:
 * keep the library's per-personality WPM honest, but smooth visualization
 * for the slowest one so visitors don't wait too long.
 */
const DEMO_SPEED_FACTORS: Record<PresetName, number> = {
  careful: 1.0,
  precise: 1.0,
  fast: 1.0,
  distracted: 0.7,
};

/** How long to sit on the final word before restarting the loop. */
const LOOP_REST_MS = 2200;

interface ReadingDemoProps {
  personality: PresetName;
  className?: string;
}

/**
 * Landing-page reading demo. Drives the same `computeReadingDwellMs` from
 * `@humanjs/core` the library uses, then distributes the total dwell across
 * the passage's words proportional to character length — longer words get
 * more "focus time." Each word lights up amber as the reader's attention
 * moves through.
 *
 * Word-by-word focus is the landing-page substitute for the v1.1 in-library
 * `withMotion` cursor scan, which moves a real cursor through the bounding
 * box. The visual story is the same: "a real person paces through the text."
 */
export function ReadingDemo({ personality, className }: ReadingDemoProps) {
  const shouldReduceMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inView = useInView(containerRef, { margin: IN_VIEW_MARGIN });

  const profile = useMemo(() => resolvePersonality(personality), [personality]);
  const words = useMemo(() => PASSAGE.split(/\s+/), []);

  const totalDwellMs = useMemo(
    () =>
      computeReadingDwellMs(words.length, profile.reading, createRng(`read-demo-${personality}`), {
        kind: 'prose',
        personalitySpeed: profile.speed,
        speedFactor: DEMO_SPEED_FACTORS[personality] ?? 1,
      }),
    [personality, profile.reading, profile.speed, words.length],
  );

  // Distribute the total dwell across words proportional to character length —
  // longer words take longer to read, same as your eye does in real life.
  const perWordMs = useMemo(() => {
    const totalChars = words.reduce((sum, w) => sum + Math.max(1, w.length), 0);
    return words.map((w) => (Math.max(1, w.length) / totalChars) * totalDwellMs);
  }, [words, totalDwellMs]);

  const [activeIndex, setActiveIndex] = useState(-1);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (shouldReduceMotion) {
      setActiveIndex(words.length - 1);
      setDone(true);
      return;
    }
    if (!inView) return;

    setActiveIndex(-1);
    setDone(false);

    let i = 0;
    let timer: number;
    let cancelled = false;

    const advance = () => {
      if (cancelled) return;
      if (i >= words.length) {
        setDone(true);
        timer = window.setTimeout(restart, LOOP_REST_MS);
        return;
      }
      setActiveIndex(i);
      const wait = perWordMs[i] ?? 0;
      i++;
      timer = window.setTimeout(advance, wait);
    };

    const restart = () => {
      i = 0;
      setActiveIndex(-1);
      setDone(false);
      advance();
    };

    advance();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [inView, shouldReduceMotion, words.length, perWordMs]);

  // Progress fraction for the bottom progress bar (sums per-word delays).
  const elapsedMs =
    activeIndex >= 0 ? perWordMs.slice(0, activeIndex + 1).reduce((sum, ms) => sum + ms, 0) : 0;
  const progress = totalDwellMs > 0 ? elapsedMs / totalDwellMs : 0;

  return (
    <div
      ref={containerRef}
      className={cn('overflow-hidden rounded-card-lg border border-hairline bg-surface', className)}
    >
      <DemoStatusBar
        label="human.read()"
        sublabel={
          <>
            personality: <span className="text-accent">{personality}</span>
          </>
        }
      />

      <div className="px-6 py-10 md:px-10 md:py-14" aria-hidden>
        <p className="text-balance font-display text-2xl leading-relaxed md:text-3xl">
          {words.map((word, i) => (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: stable index in a fixed-length passage
              key={`${word}-${i}`}
              className={cn(
                'transition-colors duration-150',
                i === activeIndex ? 'text-accent' : 'text-muted-strong',
              )}
            >
              {word}
              {i < words.length - 1 ? ' ' : ''}
            </span>
          ))}
        </p>

        <div className="mt-8 h-px overflow-hidden rounded-full bg-hairline">
          <motion.div
            className="h-full bg-accent"
            animate={{ width: `${progress * 100}%` }}
            transition={{ duration: 0.12, ease: 'linear' }}
          />
        </div>

        <div className="mt-5 flex flex-wrap items-baseline gap-x-6 gap-y-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
          <Stat label="words" value={`${Math.max(0, activeIndex + 1)} / ${words.length}`} />
          <Stat label="wpm" value={Math.round(profile.reading.wpm).toString()} />
          <Stat label="kind" value="prose" />
          <span className="ml-auto font-mono text-[10px] text-muted/70">
            {done ? '✓ done' : 'reading…'}
          </span>
        </div>
      </div>

      <span className="sr-only">
        Live demonstration of HumanJS&rsquo;s `human.read()` modeling the dwell time a real person
        would take to read a passage with the {personality}
        personality. Each word lights up as the reader&rsquo;s attention moves through, paced by
        `personality.reading.wpm` scaled by personality and speed-mode factors. Switch personality
        with the controls above to compare reading rhythms.
      </span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-baseline gap-2">
      <span>{label}</span>
      <span className="font-mono text-base tabular-nums text-foreground md:text-lg">{value}</span>
    </span>
  );
}
