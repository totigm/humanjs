'use client';

import {
  createRng,
  type Keystroke,
  type PresetName,
  planTypeKeystrokes,
  resolvePersonality,
} from '@humanjs/core';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { IN_VIEW_MARGIN } from '../../lib/motion';
import { DemoStatusBar } from './DemoStatusBar';

/**
 * Phrase the demo types. Brand-direct, scoped to what HumanJS actually does.
 * Three short sentences keep visual rhythm with the rest of the site.
 */
const PHRASE = 'Real keystrokes. Real rhythm. Real backspace recovery.';

/**
 * Demo-only speed factor per personality. The library's per-personality
 * timing is honest about how each personality types — but at landing-page
 * scale, `distracted` (234 ms/char raw + bimodal typo hesitations) is long
 * enough to feel laggy. This multiplier smooths that one personality for
 * visualization WITHOUT touching the library's runtime values. The other
 * three personalities run at their real library pace.
 */
const DEMO_SPEED_FACTORS: Record<PresetName, number> = {
  careful: 1.0,
  precise: 1.0,
  fast: 1.0,
  distracted: 0.7, // speed the demo's `distracted` up a touch — still slowest of the four
};

/** How long to sit at the finished state before erasing and replaying. */
const LOOP_REST_MS = 2400;
/** How long to spend erasing on a loop reset. */
const LOOP_ERASE_MS = 700;

interface TypingDemoProps {
  personality: PresetName;
  className?: string;
}

/**
 * Landing-page typing demo. Drives the same `@humanjs/core` planner that
 * `@humanjs/playwright`'s `executeType` uses, so what visitors see on this
 * page is the same rhythm the library actually produces against a browser.
 *
 * The demo loops: type → settle → erase → type again. Switching personalities
 * resets the loop with a freshly-seeded plan.
 */
export function TypingDemo({ personality, className }: TypingDemoProps) {
  const shouldReduceMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inView = useInView(containerRef, { margin: IN_VIEW_MARGIN });

  const profile = useMemo(() => resolvePersonality(personality), [personality]);

  const plan = useMemo<readonly Keystroke[]>(
    () =>
      planTypeKeystrokes(PHRASE, profile.typing, createRng(`type-demo-${personality}`), {
        personalitySpeed: profile.speed,
        speedFactor: DEMO_SPEED_FACTORS[personality] ?? 1,
      }),
    [personality, profile.typing, profile.speed],
  );

  const [typed, setTyped] = useState('');
  const [stats, setStats] = useState({ typos: 0, corrections: 0, done: false });
  /**
   * Index of the typo char currently visible in `typed`, if any — used for
   * red-flash highlighting. When the next Backspace fires, this clears.
   */
  const [typoIndex, setTypoIndex] = useState<number | null>(null);

  useEffect(() => {
    if (shouldReduceMotion) {
      setTyped(PHRASE);
      setStats({ typos: 0, corrections: 0, done: true });
      setTypoIndex(null);
      return;
    }
    if (!inView) return;

    setTyped('');
    setStats({ typos: 0, corrections: 0, done: false });
    setTypoIndex(null);

    let i = 0;
    let typos = 0;
    let corrections = 0;
    let timer: number;
    let cancelled = false;

    const playNext = () => {
      if (cancelled) return;
      if (i >= plan.length) {
        setStats((s) => ({ ...s, done: true }));
        // Rest at the final state, then erase + replay.
        timer = window.setTimeout(eraseAndLoop, LOOP_REST_MS);
        return;
      }
      const step = plan[i];
      if (!step) return;
      timer = window.setTimeout(() => {
        if (cancelled) return;
        if (step.key === 'Backspace') {
          setTyped((prev) => prev.slice(0, -1));
          setTypoIndex(null);
          corrections++;
        } else {
          setTyped((prev) => {
            const next = prev + visibleChar(step.key);
            if (step.isTypo) setTypoIndex(next.length - 1);
            else setTypoIndex(null);
            return next;
          });
          if (step.isTypo) typos++;
        }
        setStats((s) => ({ ...s, typos, corrections }));
        i++;
        playNext();
      }, step.delayBeforeMs);
    };

    const eraseAndLoop = () => {
      if (cancelled) return;
      const stepDelay = Math.max(20, LOOP_ERASE_MS / Math.max(1, PHRASE.length));
      const erase = () => {
        if (cancelled) return;
        setTyped((prev) => {
          if (prev.length === 0) {
            // Reset stats + restart the plan from index 0.
            i = 0;
            typos = 0;
            corrections = 0;
            setStats({ typos: 0, corrections: 0, done: false });
            setTypoIndex(null);
            playNext();
            return prev;
          }
          timer = window.setTimeout(erase, stepDelay);
          return prev.slice(0, -1);
        });
      };
      erase();
    };

    playNext();

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [plan, inView, shouldReduceMotion]);

  return (
    <div
      ref={containerRef}
      className={`overflow-hidden rounded-card-lg border border-hairline bg-surface ${className ?? ''}`}
    >
      <DemoStatusBar
        label="human.type()"
        sublabel={
          <>
            personality: <span className="text-accent">{personality}</span>
          </>
        }
      />

      <div className="px-6 py-10 md:px-10 md:py-14" aria-hidden>
        <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
          target — <span className="text-muted-strong">{PHRASE}</span>
        </p>

        <div className="relative rounded-card border border-hairline bg-canvas px-5 py-5 md:px-6 md:py-6">
          <p className="min-h-[1.5em] font-mono text-base leading-relaxed text-accent md:text-lg">
            <TypedDisplay value={typed} typoIndex={typoIndex} />
            {!shouldReduceMotion && !stats.done && <BlinkingCaret />}
          </p>
        </div>

        <div className="mt-6 flex flex-wrap items-baseline gap-x-6 gap-y-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
          <Stat label="characters" value={`${typed.length} / ${PHRASE.length}`} />
          <Stat label="typos" value={stats.typos.toString()} />
          <Stat label="corrections" value={stats.corrections.toString()} />
          <span className="ml-auto font-mono text-[10px] text-muted/70">
            {stats.done ? '✓ done' : 'typing…'}
          </span>
        </div>
      </div>

      {/* Screen-reader description — the visual demo is decorative; this is
          the canonical description of what's happening for AT users. */}
      <span className="sr-only">
        Live demonstration of HumanJS&rsquo;s `human.type()` typing the phrase &ldquo;{PHRASE}
        &rdquo; with the {personality} personality — including occasional typos and backspace
        recovery. Switch personality with the controls above to compare rhythms.
      </span>
    </div>
  );
}

/**
 * Renders the typed string with a red flash on the typo character (if any).
 * The highlight clears once the next Backspace step removes the char.
 */
function TypedDisplay({ value, typoIndex }: { value: string; typoIndex: number | null }) {
  if (typoIndex === null) return <>{value}</>;
  return (
    <>
      {value.slice(0, typoIndex)}
      <span className="rounded-[2px] bg-red-500/20 text-red-300/90">
        {value.slice(typoIndex, typoIndex + 1)}
      </span>
      {value.slice(typoIndex + 1)}
    </>
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

function BlinkingCaret() {
  return (
    <motion.span
      aria-hidden
      animate={{ opacity: [1, 1, 0, 0] }}
      transition={{ duration: 1.05, repeat: Number.POSITIVE_INFINITY, times: [0, 0.5, 0.5, 1] }}
      className="ml-0.5 inline-block h-[1em] w-[2px] -translate-y-[2px] bg-accent align-middle"
    />
  );
}

/**
 * Maps a planned key back to a visible character for the on-screen display.
 * `Enter`/`Tab` are mapped to ' ' so the typed string doesn't grow visually
 * weird mid-phrase — they only matter for real keyboard event semantics.
 */
function visibleChar(key: string): string {
  if (key === 'Enter') return '\n';
  if (key === 'Tab') return '\t';
  if (key === 'Backspace') return '';
  return key;
}
