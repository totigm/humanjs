'use client';

import {
  computeReadingDwellMs,
  createRng,
  type PresetName,
  resolvePersonality,
} from '@humanjs/core';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { cn } from '../../lib/cn';
import { IN_VIEW_MARGIN } from '../../lib/motion';
import { DemoStatusBar } from './DemoStatusBar';
import { HumanCursorIcon } from './HumanCursorIcon';

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
 * Landing-page reading demo. Drives `@humanjs/core`'s `computeReadingDwellMs`
 * to time word-by-word focus the same way the library paces a real
 * `human.read()` dwell against a Page.
 *
 * Story: word X lights up amber → the cursor glides to sit just under word
 * X → word X+1 takes over → cursor catches up. The amber word surfaces the
 * *pace*; the trailing cursor surfaces the *motion* — the third pillar
 * made visible alongside the cursor itself.
 */
export function ReadingDemo({ personality, className }: ReadingDemoProps) {
  const shouldReduceMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const passageRef = useRef<HTMLParagraphElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  /** One span ref per word — populated by the inline callback ref in render. */
  const wordRefs = useRef<(HTMLSpanElement | null)[]>([]);
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

  /**
   * Cursor target — `<p>`-relative pixel coords for where the HumanJS
   * cursor's tip should sit. Anchored just below the active word so the
   * cursor "underlines" each word as the reader's attention moves through.
   */
  const [cursorTarget, setCursorTarget] = useState<{ x: number; y: number } | null>(null);

  /**
   * Recompute the cursor target from the currently active word. Hoisted so
   * a ResizeObserver can call it on layout shifts without re-creating the
   * observer when activeIndex changes.
   */
  const updateCursorTarget = useCallback(() => {
    if (activeIndex < 0) return;
    const wordEl = wordRefs.current[activeIndex];
    const overlayEl = overlayRef.current;
    if (!wordEl || !overlayEl) return;
    const wordRect = wordEl.getBoundingClientRect();
    const overlayRect = overlayEl.getBoundingClientRect();
    if (wordRect.width === 0 || wordRect.height === 0) return;
    // Cursor's tip is at the SVG's (0,0). We want the tip just below the
    // word's baseline, slightly left of center so the body of the cursor
    // hangs naturally to the right.
    setCursorTarget({
      x: wordRect.left - overlayRect.left + wordRect.width / 2 - 4,
      y: wordRect.bottom - overlayRect.top + 2,
    });
  }, [activeIndex]);

  // useLayoutEffect so the cursor target updates synchronously after layout
  // — avoids a one-frame lag between "word turns amber" and "cursor moves."
  useLayoutEffect(() => {
    updateCursorTarget();
  }, [updateCursorTarget]);

  // Re-measure on container resize and after fonts load. The display font
  // shifts line breaks once it settles, which moves every word's rect.
  useEffect(() => {
    const overlayEl = overlayRef.current;
    if (!overlayEl || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(updateCursorTarget);
    ro.observe(overlayEl);
    if (document.fonts?.ready) {
      document.fonts.ready.then(updateCursorTarget).catch(() => {});
    }
    return () => ro.disconnect();
  }, [updateCursorTarget]);

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
        <div ref={overlayRef} className="relative">
          <p
            ref={passageRef}
            className="text-balance font-display text-2xl leading-relaxed md:text-3xl"
          >
            {words.map((word, i) => (
              <span
                ref={(el) => {
                  wordRefs.current[i] = el;
                }}
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

          {!shouldReduceMotion && cursorTarget && <FollowingCursor target={cursorTarget} />}
        </div>

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

/**
 * HumanJS cursor that smoothly tracks the currently-active word. Spring
 * physics give it the hand-like settle of a real cursor catching up — fast
 * enough to feel attentive, soft enough to feel human, not robotic.
 */
function FollowingCursor({ target }: { target: { x: number; y: number } }) {
  return (
    <motion.div
      className="pointer-events-none absolute left-0 top-0"
      initial={{ x: target.x, y: target.y, opacity: 0 }}
      animate={{ x: target.x, y: target.y, opacity: 1 }}
      transition={{
        x: { type: 'spring', stiffness: 240, damping: 26, mass: 0.55 },
        y: { type: 'spring', stiffness: 240, damping: 26, mass: 0.55 },
        opacity: { duration: 0.4 },
      }}
    >
      <svg width="24" height="26" viewBox="0 0 24 26" style={{ overflow: 'visible' }} aria-hidden>
        {/* Faint halo so the cursor reads against any background tone. */}
        <circle cx="0" cy="0" r="12" fill="#f5a55c" opacity="0.16" />
        <circle cx="0" cy="0" r="5" fill="#f5a55c" opacity="0.3" />
        <HumanCursorIcon size={22} />
      </svg>
    </motion.div>
  );
}
