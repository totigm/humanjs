'use client';

import {
  bezierPath,
  createRng,
  humanizePath,
  type PresetName,
  resolvePersonality,
} from '@humanjs/core';
import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';

const WIDTH = 480;
const HEIGHT = 320;

const targets = [
  { id: 'a', label: 'Run query', x: 92, y: 70 },
  { id: 'b', label: 'Open file', x: 388, y: 70 },
  { id: 'c', label: 'Commit', x: 92, y: 250 },
  { id: 'd', label: 'Deploy', x: 388, y: 250 },
];

const REST_MS = 600;
const DWELL_MS = 280;
const CLICK_MS = 220;

interface PersonalityCursorProps {
  personality: PresetName;
  className?: string;
}

export function PersonalityCursor({ personality, className }: PersonalityCursorProps) {
  const shouldReduceMotion = useReducedMotion();
  const [, force] = useState(0);
  const cycleRef = useRef(0);
  const startRef = useRef<number | null>(null);
  const fromRef = useRef({ x: 32, y: 32 });

  const config = useMemo(() => {
    const profile = resolvePersonality(personality);
    return {
      curvature: profile.mouse.curvature,
      travelMs: profile.mouse.travelTimeMs * 1.2,
      jitterPercent: profile.mouse.travelTimeJitter,
    };
  }, [personality]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: refs intentionally excluded; we want to recompute path on the listed dependencies
  const cycle = useMemo(() => {
    const target = targets[cycleRef.current % targets.length];
    if (!target) return null;
    const rng = createRng(`personality-${personality}-${cycleRef.current}`);
    const raw = bezierPath(fromRef.current, { x: target.x, y: target.y }, rng, {
      curvature: config.curvature,
      steps: 42,
    });
    const path = humanizePath(raw, rng, { velocityProfile: 1, jitterPx: 0.7 });
    return { path, target };
  }, [personality, config.curvature]);

  // Reset cycle when personality changes
  useEffect(() => {
    cycleRef.current = 0;
    startRef.current = null;
    fromRef.current = { x: 32, y: 32 };
    force((v) => v + 1);
  }, []);

  useEffect(() => {
    if (shouldReduceMotion || !cycle) return;
    let raf = 0;
    const total = config.travelMs + DWELL_MS + CLICK_MS + REST_MS;
    const loop = (now: number) => {
      if (startRef.current === null) startRef.current = now;
      const elapsed = now - startRef.current;
      if (elapsed >= total) {
        startRef.current = now;
        fromRef.current = { x: cycle.target.x, y: cycle.target.y };
        cycleRef.current = (cycleRef.current + 1) % targets.length;
      }
      force((v) => v + 1);
      raf = window.requestAnimationFrame(loop);
    };
    raf = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(raf);
  }, [shouldReduceMotion, cycle, config.travelMs]);

  if (!cycle) return null;

  const elapsed = startRef.current !== null ? performance.now() - startRef.current : 0;

  let cursorX = cycle.target.x;
  let cursorY = cycle.target.y;
  let pressed = false;
  let hovered = false;

  if (!shouldReduceMotion) {
    if (elapsed < config.travelMs) {
      const progress = elapsed / config.travelMs;
      const idx = Math.min(cycle.path.length - 1, Math.floor(progress * (cycle.path.length - 1)));
      const next = Math.min(cycle.path.length - 1, idx + 1);
      const a = cycle.path[idx];
      const b = cycle.path[next];
      const local = progress * (cycle.path.length - 1) - idx;
      if (a && b) {
        cursorX = a.x + (b.x - a.x) * local;
        cursorY = a.y + (b.y - a.y) * local;
      }
    } else if (elapsed < config.travelMs + DWELL_MS) {
      hovered = true;
    } else if (elapsed < config.travelMs + DWELL_MS + CLICK_MS) {
      hovered = true;
      pressed = true;
    } else {
      hovered = true;
    }
  }

  // Path so far
  const pathSoFar = (() => {
    if (shouldReduceMotion || elapsed >= config.travelMs) return null;
    const upTo = Math.max(2, Math.floor((elapsed / config.travelMs) * cycle.path.length));
    return cycle.path
      .slice(0, upTo)
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
      .join(' ');
  })();

  return (
    <div className={className}>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="block h-auto w-full" aria-hidden>
        <defs>
          <pattern id="lab-grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path
              d="M 20 0 L 0 0 0 20"
              fill="none"
              stroke="rgba(245,230,215,0.03)"
              strokeWidth="1"
            />
          </pattern>
          <linearGradient id="lab-path" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f5a55c" stopOpacity="0" />
            <stop offset="100%" stopColor="#f5a55c" stopOpacity="0.7" />
          </linearGradient>
        </defs>
        <rect width={WIDTH} height={HEIGHT} fill="url(#lab-grid)" />

        {pathSoFar && (
          <path
            d={pathSoFar}
            fill="none"
            stroke="url(#lab-path)"
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity="0.65"
          />
        )}

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

        <g style={{ transform: `translate(${cursorX}px, ${cursorY}px)` }}>
          <motion.path
            d="M 0 0 L 13 4 L 6 7.5 L 4 15 Z"
            fill="#f5a55c"
            stroke="#020203"
            strokeWidth="0.6"
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
