'use client';

import { bezierPath, createRng, humanizePath, type Point } from '@humanjs/core';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '../../lib/cn';

const CONTAINER_W = 320;
const CONTAINER_H = 200;
const CURSOR_START: Point = { x: 28, y: 32 };
const BUTTON_W = 96;
const BUTTON_H = 36;
const BUTTON_TOP_LEFT: Point = {
  x: CONTAINER_W - BUTTON_W - 28,
  y: CONTAINER_H - BUTTON_H - 32,
};
const BUTTON_CENTER: Point = {
  x: BUTTON_TOP_LEFT.x + BUTTON_W / 2,
  y: BUTTON_TOP_LEFT.y + BUTTON_H / 2,
};

// Synced cycle — robot clicks instantly at t=0, human takes its time
const ROBOT_CLICK_MS = 240; // robot ripple duration
const HUMAN_TRAVEL_MS = 1500;
const HUMAN_DWELL_MS = 240;
const HUMAN_CLICK_MS = 240;
const REST_MS = 1100;
const CYCLE_MS = HUMAN_TRAVEL_MS + HUMAN_DWELL_MS + HUMAN_CLICK_MS + REST_MS;

interface CycleState {
  position: Point;
  pressed: boolean;
  hoverTarget: boolean;
  done: boolean;
}

function getPointOnPath(path: readonly Point[], progress: number): Point {
  if (path.length === 0) return CURSOR_START;
  const clamped = Math.min(1, Math.max(0, progress));
  const index = clamped * (path.length - 1);
  const lower = Math.floor(index);
  const upper = Math.min(path.length - 1, lower + 1);
  const local = index - lower;
  const a = path[lower];
  const b = path[upper];
  if (!a || !b) return path[0] ?? CURSOR_START;
  return { x: a.x + (b.x - a.x) * local, y: a.y + (b.y - a.y) * local };
}

function computeHumanState(elapsed: number, path: readonly Point[]): CycleState {
  if (elapsed < HUMAN_TRAVEL_MS) {
    return {
      position: getPointOnPath(path, elapsed / HUMAN_TRAVEL_MS),
      pressed: false,
      hoverTarget: false,
      done: false,
    };
  }
  if (elapsed < HUMAN_TRAVEL_MS + HUMAN_DWELL_MS) {
    return { position: BUTTON_CENTER, pressed: false, hoverTarget: true, done: false };
  }
  if (elapsed < HUMAN_TRAVEL_MS + HUMAN_DWELL_MS + HUMAN_CLICK_MS) {
    return { position: BUTTON_CENTER, pressed: true, hoverTarget: true, done: false };
  }
  return { position: BUTTON_CENTER, pressed: false, hoverTarget: true, done: true };
}

function computeRoboticState(elapsed: number): CycleState {
  // Teleports + clicks immediately, then sits visibly DONE while the human cursor travels.
  if (elapsed < ROBOT_CLICK_MS) {
    return { position: BUTTON_CENTER, pressed: true, hoverTarget: true, done: false };
  }
  return { position: BUTTON_CENTER, pressed: false, hoverTarget: true, done: true };
}

interface ComparisonDemoProps {
  className?: string;
}

export function ComparisonDemo({ className }: ComparisonDemoProps) {
  const shouldReduceMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inView = useInView(containerRef, { margin: '0px 0px -10% 0px' });
  const [, force] = useState(0);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  const humanizedPath = useMemo(() => {
    const rng = createRng('humanjs-landing-demo');
    const raw = bezierPath(CURSOR_START, BUTTON_CENTER, rng, { curvature: 0.4, steps: 40 });
    return humanizePath(raw, rng, { velocityProfile: 1, jitterPx: 0.6 });
  }, []);

  useEffect(() => {
    if (shouldReduceMotion || !inView) return;
    const loop = (timestamp: number) => {
      if (startRef.current === null) startRef.current = timestamp;
      const elapsed = (timestamp - startRef.current) % CYCLE_MS;
      force(elapsed);
      rafRef.current = window.requestAnimationFrame(loop);
    };
    rafRef.current = window.requestAnimationFrame(loop);
    return () => {
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
      startRef.current = null;
    };
  }, [shouldReduceMotion, inView]);

  const elapsed = shouldReduceMotion
    ? 0
    : startRef.current !== null
      ? (performance.now() - startRef.current) % CYCLE_MS
      : 0;

  const human = shouldReduceMotion
    ? { position: BUTTON_CENTER, pressed: false, hoverTarget: true, done: true }
    : computeHumanState(elapsed, humanizedPath);
  const robot = shouldReduceMotion
    ? { position: BUTTON_CENTER, pressed: false, hoverTarget: true, done: true }
    : computeRoboticState(elapsed);

  return (
    <div
      ref={containerRef}
      className={cn('grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6', className)}
    >
      <BrowserMock
        label="Playwright"
        sublabel="page.click(selector)"
        accent="cool"
        state={robot}
        elapsed={elapsed}
        instant
      />
      <BrowserMock
        label="HumanJS"
        sublabel="human.click(selector)"
        accent="warm"
        state={human}
        elapsed={elapsed}
        trail={{
          path: humanizedPath,
          progress: Math.min(1, elapsed / HUMAN_TRAVEL_MS),
        }}
      />
    </div>
  );
}

interface BrowserMockProps {
  label: string;
  sublabel: string;
  accent: 'cool' | 'warm';
  state: CycleState;
  elapsed: number;
  instant?: boolean;
  trail?: { path: readonly Point[]; progress: number };
}

function BrowserMock({
  label,
  sublabel,
  accent,
  state,
  elapsed,
  instant,
  trail,
}: BrowserMockProps) {
  const accentRing = accent === 'warm' ? 'ring-accent/15' : 'ring-accent-cool/15';
  const accentText = accent === 'warm' ? 'text-accent' : 'text-accent-cool';
  const accentDot = accent === 'warm' ? 'bg-accent' : 'bg-accent-cool';
  const cursorColor = accent === 'warm' ? '#f5a55c' : '#5b7cc9';
  const timer = (elapsed / 1000).toFixed(1);

  return (
    <div
      className={cn(
        'overflow-hidden rounded-card-lg border border-hairline bg-surface ring-1',
        accentRing,
      )}
    >
      <div className="flex items-center justify-between border-b border-hairline px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className={cn('h-1.5 w-1.5 rounded-full', accentDot)} />
          <span className={cn('font-mono text-[11px] uppercase tracking-[0.18em]', accentText)}>
            {label}
          </span>
        </div>
        <span className="font-mono text-[10px] text-muted/70">{sublabel}</span>
      </div>

      <div
        className="relative mx-auto"
        style={{
          width: CONTAINER_W,
          maxWidth: '100%',
          aspectRatio: `${CONTAINER_W} / ${CONTAINER_H}`,
        }}
      >
        <svg
          viewBox={`0 0 ${CONTAINER_W} ${CONTAINER_H}`}
          preserveAspectRatio="xMidYMid meet"
          className="block h-auto w-full"
          aria-hidden
        >
          <defs>
            <pattern id={`grid-${accent}`} width="16" height="16" patternUnits="userSpaceOnUse">
              <path
                d="M 16 0 L 0 0 0 16"
                fill="none"
                stroke="rgba(245,230,215,0.025)"
                strokeWidth="1"
              />
            </pattern>
          </defs>
          <rect width={CONTAINER_W} height={CONTAINER_H} fill={`url(#grid-${accent})`} />

          {trail &&
            trail.progress > 0 &&
            trail.progress < 1 &&
            (() => {
              const upTo = Math.max(2, Math.floor(trail.progress * trail.path.length));
              const d = trail.path
                .slice(0, upTo)
                .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
                .join(' ');
              return (
                <path
                  d={d}
                  fill="none"
                  stroke={cursorColor}
                  strokeWidth="1.5"
                  strokeOpacity="0.55"
                  strokeLinecap="round"
                />
              );
            })()}

          <g transform={`translate(${BUTTON_TOP_LEFT.x}, ${BUTTON_TOP_LEFT.y})`}>
            <rect
              width={BUTTON_W}
              height={BUTTON_H}
              rx="8"
              fill={
                state.pressed
                  ? cursorColor
                  : state.hoverTarget
                    ? `${cursorColor}22`
                    : 'rgba(255,255,255,0.04)'
              }
              stroke={state.hoverTarget ? cursorColor : 'rgba(255,255,255,0.12)'}
              strokeWidth="1"
              style={{ transition: instant ? 'none' : 'fill 200ms, stroke 200ms' }}
            />
            <text
              x={BUTTON_W / 2}
              y={BUTTON_H / 2 + 4}
              fontSize="11"
              fontFamily="ui-monospace, monospace"
              fontWeight="500"
              fill={state.pressed ? '#0a0a0c' : 'currentColor'}
              textAnchor="middle"
              className="text-foreground"
            >
              Submit
            </text>
          </g>

          {state.pressed && (
            <circle
              cx={BUTTON_CENTER.x}
              cy={BUTTON_CENTER.y}
              r="24"
              fill="none"
              stroke={cursorColor}
              strokeWidth="1.5"
              opacity="0.4"
            >
              <animate attributeName="r" from="6" to="28" dur="0.4s" repeatCount="1" />
              <animate attributeName="opacity" from="0.6" to="0" dur="0.4s" repeatCount="1" />
            </circle>
          )}

          <g style={{ transform: `translate(${state.position.x}px, ${state.position.y}px)` }}>
            <path
              d="M 0 0 L 12 4 L 5 7 L 3 14 Z"
              fill={cursorColor}
              stroke="#020203"
              strokeWidth="0.5"
              strokeLinejoin="round"
            />
          </g>
        </svg>

        <div className="pointer-events-none absolute bottom-2 left-3 right-3 flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.15em] text-muted/60">
          <span>{instant ? 'instant jump' : 'bezier · jitter · dwell'}</span>
          <span className="flex items-center gap-1.5">
            {state.done && (
              <motion.span
                key={`done-${instant ? 'r' : 'h'}-${Math.floor(elapsed / CYCLE_MS)}`}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2 }}
                className={accentText}
              >
                ✓ done
              </motion.span>
            )}
            <span className="tabular-nums text-muted/40">{timer}s</span>
          </span>
        </div>
      </div>
    </div>
  );
}
