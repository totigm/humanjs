'use client';

import { careful, type Point } from '@humanjs/core';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { IN_VIEW_MARGIN } from '../../lib/motion';
import { makeHumanizedPath, pointAt, toSvgPathD } from '../../lib/path';
import { HumanCursorIcon } from './HumanCursorIcon';

const WIDTH = 360;
const HEIGHT = 260;
const START_POINT: Point = { x: 32, y: 224 };
const TRAVEL_MS = 1600;
const DWELL_MS = 320;
const CLICK_MS = 240;
const REST_MS = 700;
const TOTAL_MS = TRAVEL_MS + DWELL_MS + CLICK_MS + REST_MS;

const targets = [
  { id: 'submit', label: 'Submit', x: 84, y: 56 },
  { id: 'cancel', label: 'Cancel', x: 244, y: 56 },
  { id: 'next', label: 'Next step', x: 164, y: 196 },
] as const;

type Phase = 'travel' | 'dwell' | 'click' | 'rest';

interface MiniCursorDemoProps {
  className?: string;
}

/**
 * Compact looping demo of `human.click()` cycling through three targets.
 * Position and trail are mutated imperatively in the RAF loop; React renders
 * only on cycle advance + phase transitions (~5 re-renders per ~2.9s cycle).
 */
export function MiniCursorDemo({ className }: MiniCursorDemoProps) {
  const shouldReduceMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inView = useInView(containerRef, { margin: IN_VIEW_MARGIN });

  const [visit, setVisit] = useState(0);
  const [phase, setPhase] = useState<Phase>('travel');

  const startRef = useRef<number | null>(null);
  const cursorGroupRef = useRef<SVGGElement | null>(null);
  const trailRef = useRef<SVGPathElement | null>(null);

  const reactId = useId();
  const gridId = `mini-grid-${reactId}`;
  const pathGradId = `mini-path-${reactId}`;

  // Path only regenerates when the cycle advances (not every frame).
  const cycle = useMemo(() => {
    const target = targets[visit % targets.length];
    if (!target) return null;
    const from: Point =
      visit === 0
        ? START_POINT
        : ((): Point => {
            const prev = targets[(visit - 1) % targets.length];
            return prev ? { x: prev.x, y: prev.y } : START_POINT;
          })();
    const path = makeHumanizedPath(from, { x: target.x, y: target.y }, `mini-${visit}`, {
      curvature: careful.mouse.curvature,
      steps: 36,
      jitterPx: 0.6,
    });
    return { path, from, target };
  }, [visit]);

  // RAF driver — mutates DOM; only setState on cycle advance + phase transitions.
  useEffect(() => {
    if (shouldReduceMotion || !inView || !cycle) return;
    let raf = 0;
    let currentPhase: Phase = 'travel';
    // Sync React state to the local `currentPhase` so we don't carry over a
    // stale `'click'`/`'rest'` from before the user scrolled the demo out.
    setPhase('travel');
    startRef.current = null;

    const tick = (now: number) => {
      if (startRef.current === null) startRef.current = now;
      const elapsed = now - startRef.current;

      if (elapsed >= TOTAL_MS) {
        startRef.current = now;
        setVisit((v) => (v + 1) % targets.length);
        raf = window.requestAnimationFrame(tick);
        return;
      }

      const cursor = cursorGroupRef.current;
      const trail = trailRef.current;

      if (elapsed < TRAVEL_MS) {
        const progress = elapsed / TRAVEL_MS;
        const p = pointAt(cycle.path, progress);
        if (cursor) {
          cursor.setAttribute('transform', `translate(${p.x.toFixed(2)}, ${p.y.toFixed(2)})`);
        }
        if (trail) {
          const upTo = Math.floor(progress * cycle.path.length);
          trail.setAttribute('d', toSvgPathD(cycle.path, upTo));
        }
        if (currentPhase !== 'travel') {
          currentPhase = 'travel';
          setPhase('travel');
        }
      } else {
        if (cursor) {
          cursor.setAttribute('transform', `translate(${cycle.target.x}, ${cycle.target.y})`);
        }
        if (trail) trail.setAttribute('d', '');

        const next: Phase =
          elapsed < TRAVEL_MS + DWELL_MS
            ? 'dwell'
            : elapsed < TRAVEL_MS + DWELL_MS + CLICK_MS
              ? 'click'
              : 'rest';
        if (currentPhase !== next) {
          currentPhase = next;
          setPhase(next);
        }
      }

      raf = window.requestAnimationFrame(tick);
    };

    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [shouldReduceMotion, inView, cycle]);

  if (!cycle) return null;

  const pressed = phase === 'click';
  const hovered = phase !== 'travel';

  return (
    <div ref={containerRef} className={className}>
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
            <pattern id={gridId} width="20" height="20" patternUnits="userSpaceOnUse">
              <path
                d="M 20 0 L 0 0 0 20"
                fill="none"
                stroke="rgba(245,230,215,0.025)"
                strokeWidth="1"
              />
            </pattern>
            <linearGradient id={pathGradId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f5a55c" stopOpacity="0" />
              <stop offset="100%" stopColor="#f5a55c" stopOpacity="0.7" />
            </linearGradient>
          </defs>
          <rect width={WIDTH} height={HEIGHT} fill={`url(#${gridId})`} />

          <path
            ref={trailRef}
            d=""
            fill="none"
            stroke={`url(#${pathGradId})`}
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity="0.6"
          />

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

          {/* Initial transform is the demo's constant origin; the RAF tick
              writes a fresh transform on its first frame, so React never
              reconciles a stale `from` over the imperatively-mutated value. */}
          <g ref={cursorGroupRef} transform={`translate(${START_POINT.x}, ${START_POINT.y})`}>
            <HumanCursorIcon size={12} />
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
