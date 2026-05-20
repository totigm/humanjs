'use client';

import { bezierPath, careful, createRng, humanizePath, type Point } from '@humanjs/core';
import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';

const WIDTH = 360;
const HEIGHT = 260;

const targets: { id: string; label: string; x: number; y: number }[] = [
  { id: 'submit', label: 'Submit', x: 84, y: 56 },
  { id: 'cancel', label: 'Cancel', x: 244, y: 56 },
  { id: 'next', label: 'Next step', x: 164, y: 196 },
];

const START_POINT: Point = { x: 32, y: 224 };
const TRAVEL_MS = 1600;
const DWELL_MS = 320;
const CLICK_MS = 240;
const REST_MS = 700;
const TOTAL_MS = TRAVEL_MS + DWELL_MS + CLICK_MS + REST_MS;

interface MiniCursorDemoProps {
  className?: string;
}

export function MiniCursorDemo({ className }: MiniCursorDemoProps) {
  const shouldReduceMotion = useReducedMotion();
  const [tick, setTick] = useState(0);
  const startRef = useRef<number | null>(null);
  const visitRef = useRef(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: tick changes drive visitRef advancement; refs intentionally excluded
  const cycle = useMemo(() => {
    const seed = `mini-${visitRef.current}`;
    const rng = createRng(seed);
    const target = targets[visitRef.current % targets.length] ?? targets[0];
    if (!target) return null;
    const from: Point =
      visitRef.current === 0
        ? START_POINT
        : (() => {
            const prev = targets[(visitRef.current - 1) % targets.length];
            return prev ? { x: prev.x, y: prev.y } : START_POINT;
          })();
    const raw = bezierPath(from, { x: target.x, y: target.y }, rng, {
      curvature: careful.mouse.curvature,
      steps: 36,
    });
    const path = humanizePath(raw, rng, { velocityProfile: 1, jitterPx: 0.6 });
    return { path, from, target };
  }, [tick]);

  useEffect(() => {
    if (shouldReduceMotion) return;
    let raf = 0;
    const loop = (now: number) => {
      if (startRef.current === null) startRef.current = now;
      const elapsed = now - startRef.current;
      if (elapsed >= TOTAL_MS) {
        startRef.current = now;
        visitRef.current = (visitRef.current + 1) % targets.length;
        setTick((v) => v + 1);
      } else {
        setTick((v) => v + 1);
      }
      raf = window.requestAnimationFrame(loop);
    };
    raf = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(raf);
  }, [shouldReduceMotion]);

  if (!cycle) return null;

  const elapsed =
    startRef.current !== null ? Math.min(TOTAL_MS, performance.now() - startRef.current) : 0;

  let cursorPos: Point;
  let pressed = false;
  let hovered = false;

  if (elapsed < TRAVEL_MS) {
    const progress = elapsed / TRAVEL_MS;
    const i = Math.min(cycle.path.length - 1, Math.floor(progress * (cycle.path.length - 1)));
    const j = Math.min(cycle.path.length - 1, i + 1);
    const a = cycle.path[i];
    const b = cycle.path[j];
    const local = progress * (cycle.path.length - 1) - i;
    cursorPos =
      a && b ? { x: a.x + (b.x - a.x) * local, y: a.y + (b.y - a.y) * local } : cycle.from;
  } else if (elapsed < TRAVEL_MS + DWELL_MS) {
    cursorPos = { x: cycle.target.x, y: cycle.target.y };
    hovered = true;
  } else if (elapsed < TRAVEL_MS + DWELL_MS + CLICK_MS) {
    cursorPos = { x: cycle.target.x, y: cycle.target.y };
    hovered = true;
    pressed = true;
  } else {
    cursorPos = { x: cycle.target.x, y: cycle.target.y };
    hovered = true;
  }

  if (shouldReduceMotion) {
    cursorPos = { x: cycle.target.x, y: cycle.target.y };
    hovered = true;
  }

  return (
    <div className={className}>
      <div className="relative overflow-hidden rounded-card-lg border border-hairline bg-surface/70 backdrop-blur-sm">
        <div className="flex items-center justify-between border-b border-hairline px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">
              human.click()
            </span>
          </div>
          <span className="font-mono text-[10px] text-muted/60">{cycle.target.id}</span>
        </div>

        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="block h-auto w-full" aria-hidden>
          <defs>
            <pattern id="mini-grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path
                d="M 20 0 L 0 0 0 20"
                fill="none"
                stroke="rgba(245,230,215,0.025)"
                strokeWidth="1"
              />
            </pattern>
            <linearGradient id="mini-path-grad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f5a55c" stopOpacity="0" />
              <stop offset="100%" stopColor="#f5a55c" stopOpacity="0.7" />
            </linearGradient>
          </defs>
          <rect width={WIDTH} height={HEIGHT} fill="url(#mini-grid)" />

          {/* Render the traced path so far */}
          {elapsed < TRAVEL_MS && !shouldReduceMotion && (
            <path
              d={(() => {
                const upTo = Math.floor((elapsed / TRAVEL_MS) * cycle.path.length);
                const points = cycle.path.slice(0, Math.max(2, upTo));
                return points
                  .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
                  .join(' ');
              })()}
              fill="none"
              stroke="url(#mini-path-grad)"
              strokeWidth="1.5"
              strokeLinecap="round"
              opacity="0.6"
            />
          )}

          {/* Targets */}
          {targets.map((t) => {
            const isActive = t.id === cycle.target.id;
            const isPressed = isActive && pressed;
            const isHovered = isActive && hovered;
            return (
              <g key={t.id} transform={`translate(${t.x - 56}, ${t.y - 18})`}>
                <rect
                  width={112}
                  height={36}
                  rx={8}
                  fill={
                    isPressed
                      ? '#f5a55c'
                      : isHovered
                        ? 'rgba(245,165,92,0.12)'
                        : 'rgba(255,255,255,0.03)'
                  }
                  stroke={isHovered ? '#f5a55c' : 'rgba(245,230,215,0.1)'}
                  strokeWidth="1"
                />
                <text
                  x="56"
                  y="22"
                  fontSize="11"
                  fontFamily="var(--font-mono)"
                  fontWeight="500"
                  fill={isPressed ? '#0a0a0c' : '#f0ece5'}
                  textAnchor="middle"
                >
                  {t.label}
                </text>
              </g>
            );
          })}

          {/* Click ripple */}
          {pressed && (
            <circle
              cx={cycle.target.x}
              cy={cycle.target.y}
              r={20}
              fill="none"
              stroke="#f5a55c"
              strokeWidth="1.5"
              opacity="0.4"
            >
              <animate attributeName="r" from="8" to="28" dur="0.4s" repeatCount="1" />
              <animate attributeName="opacity" from="0.6" to="0" dur="0.4s" repeatCount="1" />
            </circle>
          )}

          {/* Cursor */}
          <g style={{ transform: `translate(${cursorPos.x}px, ${cursorPos.y}px)` }}>
            <path
              d="M 0 0 L 12 4 L 5 7 L 3 14 Z"
              fill="#f5a55c"
              stroke="#020203"
              strokeWidth="0.6"
              strokeLinejoin="round"
            />
          </g>
        </svg>

        <div className="border-t border-hairline px-4 py-2.5">
          <div className="flex items-center justify-between font-mono text-[10px]">
            <code className="text-foreground/80">
              <motion.span
                key={cycle.target.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="text-muted"
              >
                await human.click(
              </motion.span>
              <motion.span
                key={`q-${cycle.target.id}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="text-accent"
              >
                {`'#${cycle.target.id}'`}
              </motion.span>
              <span className="text-muted">);</span>
            </code>
            <span className="font-mono text-[10px] text-muted/60">
              {hovered ? 'click' : 'travel'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
