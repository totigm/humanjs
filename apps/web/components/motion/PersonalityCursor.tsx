'use client';

import { type Point, type PresetName, resolvePersonality } from '@humanjs/core';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { IN_VIEW_MARGIN } from '../../lib/motion';
import { makeHumanizedPath, pointAt, toSvgPathD } from '../../lib/path';
import { HUMAN_CURSOR_PATH } from './HumanCursorIcon';

const WIDTH = 480;
const HEIGHT = 320;
const REST_MS = 600;
const DWELL_MS = 280;
const CLICK_MS = 220;
const START_POS: Point = { x: 32, y: 32 };

const targets = [
  { id: 'a', label: 'Run query', x: 92, y: 70 },
  { id: 'b', label: 'Open file', x: 388, y: 70 },
  { id: 'c', label: 'Commit', x: 92, y: 250 },
  { id: 'd', label: 'Deploy', x: 388, y: 250 },
] as const;

type Phase = 'travel' | 'dwell' | 'click' | 'rest';

interface CursorOverrides {
  curvature?: number;
  jitterPx?: number;
  travelMs?: number;
}

interface PersonalityCursorProps {
  personality: PresetName;
  overrides?: CursorOverrides;
  className?: string;
}

/**
 * A continuously-cycling humanized cursor that visits four targets in a loop.
 * Position and trail are mutated imperatively in the RAF loop; React only
 * re-renders on discrete phase transitions (~4 per ~3s cycle).
 */
export function PersonalityCursor({ personality, overrides, className }: PersonalityCursorProps) {
  const shouldReduceMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inView = useInView(containerRef, { margin: IN_VIEW_MARGIN });

  const [cycleIndex, setCycleIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('travel');

  const fromRef = useRef<Point>({ ...START_POS });
  const startRef = useRef<number | null>(null);
  const cursorGroupRef = useRef<SVGGElement | null>(null);
  const trailRef = useRef<SVGPathElement | null>(null);

  const reactId = useId();
  const gridId = `lab-grid-${reactId}`;
  const pathGradId = `lab-path-${reactId}`;

  const config = useMemo(() => {
    const profile = resolvePersonality(personality);
    return {
      curvature: overrides?.curvature ?? profile.mouse.curvature,
      travelMs: (overrides?.travelMs ?? profile.mouse.travelTimeMs) * 1.2,
      jitterPx: overrides?.jitterPx ?? 0.7,
    };
  }, [personality, overrides?.curvature, overrides?.jitterPx, overrides?.travelMs]);

  // Path recomputes only when the cycle advances or config changes — never per frame.
  const cycle = useMemo(() => {
    const target = targets[cycleIndex % targets.length];
    if (!target) return null;
    const seed = `personality-${personality}-${cycleIndex}-${config.curvature.toFixed(2)}`;
    const path = makeHumanizedPath(fromRef.current, { x: target.x, y: target.y }, seed, {
      curvature: config.curvature,
      steps: 42,
      jitterPx: config.jitterPx,
    });
    return { path, target };
  }, [personality, cycleIndex, config.curvature, config.jitterPx]);

  // Reset cycle on identity / tone change (refs intentionally excluded — handled inline).
  // biome-ignore lint/correctness/useExhaustiveDependencies: refs intentionally excluded
  useEffect(() => {
    setCycleIndex(0);
    setPhase('travel');
    startRef.current = null;
    fromRef.current = { ...START_POS };
  }, [personality, config.curvature, config.jitterPx]);

  // Cycle / phase driver — mutates DOM imperatively, only setState on phase transitions.
  useEffect(() => {
    if (shouldReduceMotion || !cycle || !inView) return;
    const total = config.travelMs + DWELL_MS + CLICK_MS + REST_MS;
    let raf = 0;
    let currentPhase: Phase = 'travel';
    // Sync React state to the local `currentPhase` — otherwise scrolling the
    // demo out then back in re-enters with a stale `'click'` / `'rest'` and
    // the target shows a phantom pressed/hovered visual until the next phase.
    setPhase('travel');
    startRef.current = null;

    const tick = (now: number) => {
      if (startRef.current === null) startRef.current = now;
      const elapsed = now - startRef.current;

      if (elapsed >= total) {
        startRef.current = now;
        fromRef.current = { x: cycle.target.x, y: cycle.target.y };
        setCycleIndex((i) => (i + 1) % targets.length);
        raf = window.requestAnimationFrame(tick);
        return;
      }

      const cursor = cursorGroupRef.current;
      const trail = trailRef.current;

      if (elapsed < config.travelMs) {
        const progress = elapsed / config.travelMs;
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
        // Post-travel phases — cursor sits at target, trail clears.
        if (cursor) {
          cursor.setAttribute('transform', `translate(${cycle.target.x}, ${cycle.target.y})`);
        }
        if (trail) trail.setAttribute('d', '');

        const nextPhase: Phase =
          elapsed < config.travelMs + DWELL_MS
            ? 'dwell'
            : elapsed < config.travelMs + DWELL_MS + CLICK_MS
              ? 'click'
              : 'rest';
        if (currentPhase !== nextPhase) {
          currentPhase = nextPhase;
          setPhase(nextPhase);
        }
      }

      raf = window.requestAnimationFrame(tick);
    };

    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [shouldReduceMotion, cycle, config.travelMs, inView]);

  if (!cycle) return <div ref={containerRef} className={className} />;

  const pressed = phase === 'click';
  const hovered = phase !== 'travel';

  return (
    <div ref={containerRef} className={className}>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="block h-auto w-full" aria-hidden>
        <defs>
          <pattern id={gridId} width="20" height="20" patternUnits="userSpaceOnUse">
            <path
              d="M 20 0 L 0 0 0 20"
              fill="none"
              stroke="rgba(245,230,215,0.03)"
              strokeWidth="1"
            />
          </pattern>
          <linearGradient id={pathGradId} x1="0%" y1="0%" x2="100%" y2="100%">
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
          opacity="0.65"
        />

        {targets.map((t) => {
          const isActive = t.id === cycle.target.id;
          const isPressed = isActive && pressed;
          const isHovered = isActive && hovered;
          return (
            <g key={t.id} transform={`translate(${t.x - 72}, ${t.y - 22})`}>
              <rect
                width={144}
                height={44}
                rx={10}
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
                x="72"
                y="27"
                fontSize="12"
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
            r={24}
            fill="none"
            stroke="#f5a55c"
            strokeWidth="1.5"
            opacity="0.4"
          >
            <animate attributeName="r" from="10" to="36" dur="0.5s" repeatCount="1" />
            <animate attributeName="opacity" from="0.6" to="0" dur="0.5s" repeatCount="1" />
          </circle>
        )}

        <g ref={cursorGroupRef} transform={`translate(${START_POS.x}, ${START_POS.y})`}>
          {/* SVG attribute `transform` is composed under framer-motion's CSS
              `transform`, so the static size scale (13/16) and the animated
              press scale (0.85 ↔ 1) stack without fighting each other. */}
          <motion.path
            d={HUMAN_CURSOR_PATH}
            transform={`scale(${13 / 16})`}
            fill="#f5a55c"
            stroke="#020203"
            strokeWidth={(0.6 * 16) / 13}
            strokeLinejoin="round"
            animate={pressed ? { scale: 0.85 } : { scale: 1 }}
            transition={{ duration: 0.1 }}
            style={{ transformOrigin: '0px 0px' }}
          />
        </g>
      </svg>
    </div>
  );
}
