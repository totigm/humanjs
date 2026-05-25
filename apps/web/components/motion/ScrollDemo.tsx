'use client';

import {
  createRng,
  type PresetName,
  planScroll,
  resolvePersonality,
  type ScrollSegment,
} from '@humanjs/core';
import { useInView, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { cn } from '../../lib/cn';
import { IN_VIEW_MARGIN } from '../../lib/motion';
import { DemoStatusBar } from './DemoStatusBar';

/**
 * Mock changelog-style feed the demo scrolls through. Reads like a real
 * product timeline — categorical tags (SHIPPED / NOTE / DESIGN), dates,
 * brand-relevant titles — rather than meta copy about the demo itself.
 */
const FEED = [
  {
    tag: 'SHIPPED',
    date: 'May 21',
    title: 'The cursor takes a real path.',
    body: 'Bezier paths, micro-jitter, hover-before-click. The third pillar lands today.',
    glow: 'rgba(245, 165, 92, 0.10)',
  },
  {
    tag: 'NOTE',
    date: 'May 18',
    title: 'Personality, not preference.',
    body: 'careful, fast, distracted, precise — four presets that re-shape every primitive at once, not one knob at a time.',
    glow: 'rgba(91, 124, 201, 0.10)',
  },
  {
    tag: 'DESIGN',
    date: 'May 15',
    title: 'Bell curve, not linear.',
    body: 'A real wheel scroll accelerates, peaks, decelerates. The same pure function paints it in tests and in production.',
    glow: 'rgba(122, 191, 133, 0.10)',
  },
  {
    tag: 'NOTE',
    date: 'May 12',
    title: 'Mid-scroll pauses.',
    body: 'Humans pause while scrolling. Briefly. Often without realizing. The page notices, even if you don’t.',
    glow: 'rgba(215, 127, 163, 0.10)',
  },
  {
    tag: 'SHIPPED',
    date: 'May 08',
    title: 'Overshoot + correction.',
    body: 'distracted scrolls past the target and corrects back. precise never overshoots. Same code path; profile dictates behavior.',
    glow: 'rgba(201, 163, 91, 0.10)',
  },
  {
    tag: 'DESIGN',
    date: 'May 03',
    title: 'Determinism by seed.',
    body: 'Same seed, same segments, every run. Snapshot test it. CI loves it.',
    glow: 'rgba(245, 165, 92, 0.10)',
  },
];

/** How long to dwell on each section after scrolling to it — the "reading"
 *  beat between section-to-section scrolls. */
const READ_DWELL_MS = 950;
/** How long to sit at the last section before scrolling back to the top. */
const REST_AT_END_MS = 1400;
/** How long to sit at the top before starting the next loop. */
const REST_AT_TOP_MS = 1000;

interface ScrollDemoProps {
  personality: PresetName;
  className?: string;
}

/**
 * Landing-page scroll demo. Drives `@humanjs/core`'s `planScroll` directly —
 * the same planner the Playwright adapter walks against `page.mouse.wheel` —
 * but applies the segments to a React-controlled `scrollTop` on a bounded
 * container.
 *
 * Loop: scroll to bottom → rest → scroll to top → rest → restart. Each
 * direction is its own `planScroll` call seeded with the personality + a
 * step counter so consecutive runs aren't identical.
 */
export function ScrollDemo({ personality, className }: ScrollDemoProps) {
  const shouldReduceMotion = useReducedMotion();
  const cardRef = useRef<HTMLDivElement | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const sectionRefs = useRef<(HTMLElement | null)[]>([]);
  const inView = useInView(cardRef, { margin: IN_VIEW_MARGIN });

  const [activeSection, setActiveSection] = useState(0);
  const [stats, setStats] = useState({ segments: 0, pauses: 0, overshoots: 0 });
  const [direction, setDirection] = useState<'down' | 'up' | 'idle'>('idle');

  useEffect(() => {
    if (shouldReduceMotion) {
      setActiveSection(0);
      setDirection('idle');
      return;
    }
    if (!inView) return;
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const profile = resolvePersonality(personality);
    let cancelled = false;
    let timer: number;
    let loopId = 0;

    let segments = 0;
    let pauses = 0;
    let overshoots = 0;
    let rafId = 0;
    setStats({ segments: 0, pauses: 0, overshoots: 0 });

    /**
     * Walks a plan by sampling the cumulative position-over-time curve at
     * each animation frame. setTimeout-driven walks quantize at ~14ms
     * regardless of the display, producing visible step-jumps; rAF
     * sampling smooths the same plan at the display's native refresh.
     * The bell-curve velocity shape is preserved because the cumulative
     * curve still encodes accel → peak → decel.
     */
    const walk = (plan: readonly ScrollSegment[], onDone: () => void) => {
      // Build cumulative time + position arrays from the plan.
      const cumTimes: number[] = [0];
      const cumPositions: number[] = [scroller.scrollTop];
      let segCount = 0;
      let pauseCount = 0;
      for (const seg of plan) {
        const prevTime = cumTimes[cumTimes.length - 1] ?? 0;
        const prevPos = cumPositions[cumPositions.length - 1] ?? scroller.scrollTop;
        cumTimes.push(prevTime + seg.delayBeforeMs);
        cumPositions.push(prevPos + seg.delta);
        if (seg.delta !== 0) segCount++;
        else pauseCount++;
      }
      segments += segCount;
      pauses += pauseCount;

      const totalTime = cumTimes[cumTimes.length - 1] ?? 0;
      const finalPos = cumPositions[cumPositions.length - 1] ?? scroller.scrollTop;

      if (totalTime <= 0 || plan.length === 0) {
        setStats({ segments, pauses, overshoots });
        onDone();
        return;
      }

      const startTime = performance.now();
      const tick = (now: number) => {
        if (cancelled) return;
        const t = now - startTime;
        if (t >= totalTime) {
          scroller.scrollTop = finalPos;
          setStats({ segments, pauses, overshoots });
          onDone();
          return;
        }
        // Find which segment we're currently inside.
        let i = 0;
        while (i < cumTimes.length - 1 && (cumTimes[i + 1] ?? 0) <= t) i++;
        const segStart = cumTimes[i] ?? 0;
        const segEnd = cumTimes[i + 1] ?? segStart;
        const segLen = segEnd - segStart;
        const f = segLen > 0 ? (t - segStart) / segLen : 0;
        const posA = cumPositions[i] ?? 0;
        const posB = cumPositions[i + 1] ?? posA;
        scroller.scrollTop = posA + (posB - posA) * f;
        rafId = window.requestAnimationFrame(tick);
      };

      rafId = window.requestAnimationFrame(tick);
    };

    /**
     * Scrolls to a specific section index using `planScroll` — same code
     * path `human.scroll('#sectionN')` follows in the real adapter. The
     * personality's natural `overshootProbability` decides whether each
     * jump overshoots, so distracted will hit a few per loop and precise
     * will hit none — same statistics a real session sees.
     */
    const scrollToSection = (index: number, onDone: () => void) => {
      if (cancelled) return;
      const section = sectionRefs.current[index];
      if (!section) {
        onDone();
        return;
      }
      const target = section.offsetTop;
      const rng = createRng(`scroll-showcase-${personality}-${loopId}-s${index}`);
      const from = scroller.scrollTop;
      const plan = planScroll(from, target, profile.scroll, rng, {
        personalitySpeed: profile.speed,
        speedFactor: 1,
      });
      // Overshoot signature: a plan contains segments moving opposite to
      // the overall scroll direction (the correction phase). Ordinary
      // mid-scroll micro-pauses are `delta === 0` and don't trip this,
      // unlike a "any zero-delta segment" heuristic which over-counts.
      const direction = target >= from ? 1 : -1;
      const hasOvershoot = plan.some((s) => s.delta * direction < 0);
      if (hasOvershoot) overshoots++;
      setActiveSection(index);
      walk(plan, onDone);
    };

    /** Reading dwell between section-to-section scrolls. */
    const dwell = (ms: number, next: () => void) => {
      if (cancelled) return;
      timer = window.setTimeout(next, ms);
    };

    /** Walks down through every section, dwelling on each. */
    const walkDown = (nextIndex: number) => {
      if (cancelled) return;
      if (nextIndex >= FEED.length) {
        setDirection('idle');
        dwell(REST_AT_END_MS, scrollHome);
        return;
      }
      setDirection('down');
      scrollToSection(nextIndex, () => {
        dwell(READ_DWELL_MS, () => walkDown(nextIndex + 1));
      });
    };

    /** One smooth return scroll all the way back to the top. */
    const scrollHome = () => {
      if (cancelled) return;
      setDirection('up');
      const rng = createRng(`scroll-showcase-${personality}-${loopId}-home`);
      const plan = planScroll(scroller.scrollTop, 0, profile.scroll, rng, {
        personalitySpeed: profile.speed,
        speedFactor: 1,
      });
      walk(plan, () => {
        setActiveSection(0);
        dwell(REST_AT_TOP_MS, () => {
          loopId++;
          segments = 0;
          pauses = 0;
          overshoots = 0;
          setStats({ segments: 0, pauses: 0, overshoots: 0 });
          walkDown(1);
        });
      });
    };

    scroller.scrollTop = 0;
    setActiveSection(0);
    // Brief beat to register the starting position before motion begins.
    timer = window.setTimeout(() => walkDown(1), 500);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.cancelAnimationFrame(rafId);
      setDirection('idle');
    };
  }, [inView, personality, shouldReduceMotion]);

  return (
    <div
      ref={cardRef}
      className={cn('overflow-hidden rounded-card-lg border border-hairline bg-surface', className)}
    >
      <DemoStatusBar
        label="human.scroll()"
        sublabel={
          <>
            personality: <span className="text-accent">{personality}</span>
            {direction !== 'idle' && (
              <span className="ml-3 text-muted/60">
                {direction === 'down' ? '↓ scrolling' : '↑ returning'}
              </span>
            )}
          </>
        }
      />

      <div className="relative px-6 py-8 md:px-10 md:py-10" aria-hidden>
        <div
          ref={scrollerRef}
          // `relative` makes the scroller the offsetParent of its sections,
          // so `section.offsetTop` reads as the section's position inside
          // the scroller's scroll axis — which is what `scrollTop` expects.
          // Without this, offsetTop bubbles up to the outer card's padded
          // edge, and every section-to-section scroll lands ~padding past
          // its target.
          className="relative h-[560px] overflow-y-scroll rounded-card border border-hairline bg-canvas md:h-[640px]"
          style={{ scrollBehavior: 'auto' }}
        >
          {FEED.map((item, i) => (
            <section
              key={item.title}
              ref={(el) => {
                sectionRefs.current[i] = el;
              }}
              className={cn(
                // h-full resolves to the scroller's height — each section
                // becomes one full container-viewport tall, so section-to-
                // section scrolls cover exactly the visible area.
                'flex h-full min-h-full shrink-0 flex-col justify-center px-8 py-10 md:px-12',
                i < FEED.length - 1 && 'border-b border-hairline/60',
              )}
              style={{
                background: `radial-gradient(circle at 30% 20%, ${item.glow}, transparent 60%)`,
              }}
            >
              <div className="mb-4 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted/70">
                <span className="rounded-sm border border-hairline px-1.5 py-0.5 text-accent/90">
                  {item.tag}
                </span>
                <span>{item.date}</span>
              </div>
              <h3 className="text-balance font-display text-3xl leading-tight text-foreground md:text-4xl">
                {item.title}
              </h3>
              <p className="mt-4 max-w-prose text-base leading-relaxed text-muted-strong md:text-lg">
                {item.body}
              </p>
              <div className="mt-6 font-mono text-[10px] uppercase tracking-[0.22em] text-muted/40">
                {String(i + 1).padStart(2, '0')} / {String(FEED.length).padStart(2, '0')}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap items-baseline gap-x-6 gap-y-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
          <Stat label="segments" value={stats.segments.toString()} />
          <Stat label="pauses" value={stats.pauses.toString()} />
          <Stat label="overshoot" value={stats.overshoots > 0 ? 'yes' : '—'} />
          <Stat label="section" value={`${activeSection + 1} / ${FEED.length}`} />
          <span className="ml-auto font-mono text-[10px] text-muted/70">
            {direction === 'down' && 'rolling…'}
            {direction === 'up' && 'returning…'}
            {direction === 'idle' && '✓ ready'}
          </span>
        </div>
      </div>

      <span className="sr-only">
        Live demonstration of HumanJS&rsquo;s `human.scroll()` driving the same `planScroll` planner
        the Playwright adapter walks against `page.mouse.wheel`. The bounded list scrolls from top
        to bottom with a bell-curve velocity profile, mid-scroll pauses, and (on the distracted
        personality) an overshoot-and-correct phase, then returns to the top and repeats. Switch
        personality with the controls above to compare scroll rhythms.
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
