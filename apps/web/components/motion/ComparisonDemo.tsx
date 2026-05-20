'use client';

import { bezierPath, createRng, humanizePath, type Point } from '@humanjs/core';
import { motion, useReducedMotion } from 'framer-motion';
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

const HUMAN_TRAVEL_MS = 1500;
const PRE_CLICK_DWELL_MS = 250;
const CLICK_DURATION_MS = 220;
const REST_MS = 1200;
const CYCLE_MS = HUMAN_TRAVEL_MS + PRE_CLICK_DWELL_MS + CLICK_DURATION_MS + REST_MS;

type Phase = 'travel' | 'dwell' | 'click' | 'rest';

interface CycleState {
  position: Point;
  pressed: boolean;
  hoverTarget: boolean;
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

function phaseFor(elapsed: number): Phase {
  if (elapsed < HUMAN_TRAVEL_MS) return 'travel';
  if (elapsed < HUMAN_TRAVEL_MS + PRE_CLICK_DWELL_MS) return 'dwell';
  if (elapsed < HUMAN_TRAVEL_MS + PRE_CLICK_DWELL_MS + CLICK_DURATION_MS) return 'click';
  return 'rest';
}

function computeHumanState(elapsed: number, path: readonly Point[]): CycleState {
  const phase = phaseFor(elapsed);
  if (phase === 'travel') {
    const progress = elapsed / HUMAN_TRAVEL_MS;
    return { position: getPointOnPath(path, progress), pressed: false, hoverTarget: false };
  }
  if (phase === 'dwell') {
    return { position: BUTTON_CENTER, pressed: false, hoverTarget: true };
  }
  if (phase === 'click') {
    return { position: BUTTON_CENTER, pressed: true, hoverTarget: true };
  }
  return { position: CURSOR_START, pressed: false, hoverTarget: false };
}

function computeRoboticState(elapsed: number): CycleState {
  // Robot: instant teleport at t=200ms, immediate click, then rest.
  // Designed so the user can SEE the difference: it's already on the button
  // while the human cursor is still mid-flight.
  if (elapsed < 200) {
    return { position: CURSOR_START, pressed: false, hoverTarget: false };
  }
  const phase = phaseFor(elapsed);
  if (phase === 'rest') {
    return { position: CURSOR_START, pressed: false, hoverTarget: false };
  }
  if (phase === 'click') {
    return { position: BUTTON_CENTER, pressed: true, hoverTarget: true };
  }
  return { position: BUTTON_CENTER, pressed: false, hoverTarget: true };
}

interface ComparisonDemoProps {
  className?: string;
}

export function ComparisonDemo({ className }: ComparisonDemoProps) {
  const shouldReduceMotion = useReducedMotion();
  const [, force] = useState(0);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  // Pre-compute the humanized path once (deterministic via seeded RNG).
  const humanizedPath = useMemo(() => {
    const rng = createRng('humanjs-landing-demo');
    const raw = bezierPath(CURSOR_START, BUTTON_CENTER, rng, { curvature: 0.4, steps: 40 });
    return humanizePath(raw, rng, { velocityProfile: 1, jitterPx: 0.6 });
  }, []);

  useEffect(() => {
    if (shouldReduceMotion) return;
    const loop = (timestamp: number) => {
      if (startRef.current === null) startRef.current = timestamp;
      const elapsed = (timestamp - startRef.current) % CYCLE_MS;
      // Bump state so React re-renders. Pass elapsed via a sentinel.
      force(elapsed);
      rafRef.current = window.requestAnimationFrame(loop);
    };
    rafRef.current = window.requestAnimationFrame(loop);
    return () => {
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
      startRef.current = null;
    };
  }, [shouldReduceMotion]);

  const elapsed = shouldReduceMotion
    ? 0
    : startRef.current !== null
      ? (performance.now() - startRef.current) % CYCLE_MS
      : 0;

  const human = shouldReduceMotion
    ? { position: BUTTON_CENTER, pressed: false, hoverTarget: true }
    : computeHumanState(elapsed, humanizedPath);
  const robot = shouldReduceMotion
    ? { position: BUTTON_CENTER, pressed: false, hoverTarget: true }
    : computeRoboticState(elapsed);

  return (
    <div className={cn('grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6', className)}>
      <BrowserMock
        label="Playwright"
        sublabel="page.click(selector)"
        accent="cool"
        state={robot}
        instant
      />
      <BrowserMock label="HumanJS" sublabel="human.click(selector)" accent="warm" state={human} />
    </div>
  );
}

interface BrowserMockProps {
  label: string;
  sublabel: string;
  accent: 'cool' | 'warm';
  state: CycleState;
  instant?: boolean;
}

function BrowserMock({ label, sublabel, accent, state, instant }: BrowserMockProps) {
  const accentRing = accent === 'warm' ? 'ring-accent/15' : 'ring-accent-cool/15';
  const accentText = accent === 'warm' ? 'text-accent' : 'text-accent-cool';
  const accentDot = accent === 'warm' ? 'bg-accent' : 'bg-accent-cool';
  const cursorColor = accent === 'warm' ? '#f5a55c' : '#5b7cc9';

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
                stroke="rgba(255,255,255,0.025)"
                strokeWidth="1"
              />
            </pattern>
          </defs>
          <rect width={CONTAINER_W} height={CONTAINER_H} fill={`url(#grid-${accent})`} />

          {/* Target button */}
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
              style={{ transition: instant ? 'none' : 'fill 200ms' }}
            >
              Submit
            </text>
          </g>

          {/* Click ripple */}
          {state.pressed && (
            <circle
              cx={BUTTON_CENTER.x}
              cy={BUTTON_CENTER.y}
              r={instant ? 24 : 28}
              fill="none"
              stroke={cursorColor}
              strokeWidth="1.5"
              opacity="0.4"
              style={{ transformOrigin: `${BUTTON_CENTER.x}px ${BUTTON_CENTER.y}px` }}
            >
              <animate attributeName="r" from="6" to="28" dur="0.4s" repeatCount="1" />
              <animate attributeName="opacity" from="0.6" to="0" dur="0.4s" repeatCount="1" />
            </circle>
          )}

          {/* Cursor */}
          <g
            style={{
              transform: `translate(${state.position.x}px, ${state.position.y}px)`,
              transition: instant ? 'none' : undefined,
            }}
          >
            <path
              d="M 0 0 L 12 4 L 5 7 L 3 14 Z"
              fill={cursorColor}
              stroke="#020203"
              strokeWidth="0.5"
              strokeLinejoin="round"
            />
          </g>
        </svg>

        {/* Phase indicator */}
        <div className="pointer-events-none absolute bottom-2 left-3 right-3 flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.15em] text-muted/60">
          <span>{instant ? 'instant jump' : 'bezier · jitter · dwell'}</span>
          {state.pressed && (
            <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={accentText}>
              click
            </motion.span>
          )}
        </div>
      </div>
    </div>
  );
}
