'use client';

import type { Point } from '@humanjs/core';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { cn } from '../../lib/cn';
import { IN_VIEW_MARGIN } from '../../lib/motion';
import { makeHumanizedPath, pointAt, toSvgPathD } from '../../lib/path';
import { DemoStatusBar } from './DemoStatusBar';
import { HumanCursorIcon } from './HumanCursorIcon';

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

// Synced cycle — robot clicks instantly at t=0, human takes its time.
const ROBOT_CLICK_MS = 240;
const HUMAN_TRAVEL_MS = 1500;
const HUMAN_DWELL_MS = 240;
const HUMAN_CLICK_MS = 240;
const REST_MS = 1100;
const CYCLE_MS = HUMAN_TRAVEL_MS + HUMAN_DWELL_MS + HUMAN_CLICK_MS + REST_MS;

type RobotPhase = 'pressing' | 'done';
type HumanPhase = 'travel' | 'dwell' | 'click' | 'done';

interface ComparisonDemoProps {
  className?: string;
}

/**
 * Side-by-side click animation comparing instant Playwright clicks to
 * humanized HumanJS clicks. Cursor positions, timer text, and the human
 * trail are mutated imperatively in the RAF loop. React only re-renders
 * on discrete phase transitions (~6 per ~3.2s cycle).
 */
export function ComparisonDemo({ className }: ComparisonDemoProps) {
  const shouldReduceMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inView = useInView(containerRef, { margin: IN_VIEW_MARGIN });

  const [robotPhase, setRobotPhase] = useState<RobotPhase>('pressing');
  const [humanPhase, setHumanPhase] = useState<HumanPhase>('travel');

  const robotCursorRef = useRef<SVGGElement | null>(null);
  const humanCursorRef = useRef<SVGGElement | null>(null);
  const humanTrailRef = useRef<SVGPathElement | null>(null);
  const robotTimerRef = useRef<HTMLSpanElement | null>(null);
  const humanTimerRef = useRef<HTMLSpanElement | null>(null);

  const humanizedPath = useMemo(
    () =>
      makeHumanizedPath(CURSOR_START, BUTTON_CENTER, 'humanjs-landing-demo', {
        curvature: 0.4,
        steps: 40,
        jitterPx: 0.6,
      }),
    [],
  );

  useEffect(() => {
    if (shouldReduceMotion || !inView) return;
    let raf = 0;
    let startTime: number | null = null;
    let lastRobotPhase: RobotPhase = 'pressing';
    let lastHumanPhase: HumanPhase = 'travel';

    const tick = (now: number) => {
      if (startTime === null) startTime = now;
      const elapsed = (now - startTime) % CYCLE_MS;
      const timerText = `${(elapsed / 1000).toFixed(1)}s`;

      if (robotTimerRef.current) robotTimerRef.current.textContent = timerText;
      if (humanTimerRef.current) humanTimerRef.current.textContent = timerText;

      // Human cursor & trail — interpolate along path during travel, snap to button after.
      const humanCursor = humanCursorRef.current;
      const humanTrail = humanTrailRef.current;
      if (elapsed < HUMAN_TRAVEL_MS) {
        const progress = elapsed / HUMAN_TRAVEL_MS;
        const p = pointAt(humanizedPath, progress);
        if (humanCursor) {
          humanCursor.setAttribute('transform', `translate(${p.x.toFixed(2)}, ${p.y.toFixed(2)})`);
        }
        if (humanTrail) {
          const upTo = Math.floor(progress * humanizedPath.length);
          humanTrail.setAttribute('d', toSvgPathD(humanizedPath, upTo));
        }
      } else {
        if (humanCursor) {
          humanCursor.setAttribute(
            'transform',
            `translate(${BUTTON_CENTER.x}, ${BUTTON_CENTER.y})`,
          );
        }
        if (humanTrail) humanTrail.setAttribute('d', '');
      }

      // Robot cursor — already at the button (set on mount); nothing to mutate per frame.

      // Discrete phase transitions.
      const nextRobotPhase: RobotPhase = elapsed < ROBOT_CLICK_MS ? 'pressing' : 'done';
      if (nextRobotPhase !== lastRobotPhase) {
        lastRobotPhase = nextRobotPhase;
        setRobotPhase(nextRobotPhase);
      }

      let nextHumanPhase: HumanPhase;
      if (elapsed < HUMAN_TRAVEL_MS) nextHumanPhase = 'travel';
      else if (elapsed < HUMAN_TRAVEL_MS + HUMAN_DWELL_MS) nextHumanPhase = 'dwell';
      else if (elapsed < HUMAN_TRAVEL_MS + HUMAN_DWELL_MS + HUMAN_CLICK_MS)
        nextHumanPhase = 'click';
      else nextHumanPhase = 'done';
      if (nextHumanPhase !== lastHumanPhase) {
        lastHumanPhase = nextHumanPhase;
        setHumanPhase(nextHumanPhase);
      }

      raf = window.requestAnimationFrame(tick);
    };

    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [shouldReduceMotion, inView, humanizedPath]);

  // Resolve display state for the two sides (reduced-motion users see the end state).
  const robot = shouldReduceMotion
    ? { pressed: false, hoverTarget: true, done: true }
    : {
        pressed: robotPhase === 'pressing',
        hoverTarget: true,
        done: robotPhase === 'done',
      };

  const human = shouldReduceMotion
    ? { pressed: false, hoverTarget: true, done: true }
    : {
        pressed: humanPhase === 'click',
        hoverTarget: humanPhase !== 'travel',
        done: humanPhase === 'done',
      };

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
        cursorRef={robotCursorRef}
        timerRef={robotTimerRef}
        instant
      />
      <BrowserMock
        label="HumanJS"
        sublabel="human.click(selector)"
        accent="warm"
        state={human}
        cursorRef={humanCursorRef}
        timerRef={humanTimerRef}
        trailRef={humanTrailRef}
      />
    </div>
  );
}

interface SideState {
  pressed: boolean;
  hoverTarget: boolean;
  done: boolean;
}

interface BrowserMockProps {
  label: string;
  sublabel: string;
  accent: 'cool' | 'warm';
  state: SideState;
  cursorRef: React.Ref<SVGGElement>;
  timerRef: React.Ref<HTMLSpanElement>;
  trailRef?: React.Ref<SVGPathElement>;
  instant?: boolean;
}

function BrowserMock({
  label,
  sublabel,
  accent,
  state,
  cursorRef,
  timerRef,
  trailRef,
  instant,
}: BrowserMockProps) {
  const accentRing = accent === 'warm' ? 'ring-accent/15' : 'ring-accent-cool/15';
  const accentText = accent === 'warm' ? 'text-accent' : 'text-accent-cool';
  const accentDot = accent === 'warm' ? 'bg-accent' : 'bg-accent-cool';
  const cursorColor = accent === 'warm' ? '#f5a55c' : '#5b7cc9';
  // Initial cursor position: robot starts at the button, human starts at the corner.
  const initialCursor = instant ? BUTTON_CENTER : CURSOR_START;

  const reactId = useId();
  const gridId = `cmp-grid-${reactId}`;

  return (
    <div
      className={cn(
        'overflow-hidden rounded-card-lg border border-hairline bg-surface ring-1',
        accentRing,
      )}
    >
      <DemoStatusBar
        label={label}
        sublabel={sublabel}
        dotClassName={accentDot}
        labelClassName={accentText}
      />

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
            <pattern id={gridId} width="16" height="16" patternUnits="userSpaceOnUse">
              <path
                d="M 16 0 L 0 0 0 16"
                fill="none"
                stroke="rgba(245,230,215,0.025)"
                strokeWidth="1"
              />
            </pattern>
          </defs>
          <rect width={CONTAINER_W} height={CONTAINER_H} fill={`url(#${gridId})`} />

          {trailRef && (
            <path
              ref={trailRef}
              d=""
              fill="none"
              stroke={cursorColor}
              strokeWidth="1.5"
              strokeOpacity="0.55"
              strokeLinecap="round"
            />
          )}

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

          <g ref={cursorRef} transform={`translate(${initialCursor.x}, ${initialCursor.y})`}>
            <HumanCursorIcon size={12} fill={cursorColor} strokeWidth={0.5} />
          </g>
        </svg>

        <div className="pointer-events-none absolute bottom-2 left-3 right-3 flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.15em] text-muted/60">
          <span>{instant ? 'instant jump' : 'bezier · jitter · dwell'}</span>
          <span className="flex items-center gap-1.5">
            {state.done && (
              <motion.span
                key={`done-${instant ? 'r' : 'h'}`}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2 }}
                className={accentText}
              >
                ✓ done
              </motion.span>
            )}
            <span ref={timerRef} className="tabular-nums text-muted/70">
              0.0s
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
