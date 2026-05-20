'use client';

import {
  bezierPath,
  createRng,
  humanizePath,
  type PresetName,
  resolvePersonality,
} from '@humanjs/core';
import { motion, useReducedMotion } from 'framer-motion';
import { useMemo } from 'react';

interface TrajectoryCanvasProps {
  personality: PresetName;
  width?: number;
  height?: number;
  accent?: string;
}

export function TrajectoryCanvas({
  personality,
  width = 240,
  height = 100,
  accent = '#f5a55c',
}: TrajectoryCanvasProps) {
  const shouldReduceMotion = useReducedMotion();

  const { d, totalLength } = useMemo(() => {
    const resolved = resolvePersonality(personality);
    const rng = createRng(`landing-trajectory-${personality}`);
    const raw = bezierPath({ x: 16, y: height - 16 }, { x: width - 16, y: 16 }, rng, {
      curvature: resolved.mouse.curvature,
      steps: 50,
    });
    const humanized = humanizePath(raw, rng, { velocityProfile: 1, jitterPx: 0.6 });
    const dStr = humanized
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
      .join(' ');

    // Approximate path length: sum of segment lengths.
    let length = 0;
    for (let i = 1; i < humanized.length; i++) {
      const a = humanized[i - 1];
      const b = humanized[i];
      if (!a || !b) continue;
      length += Math.hypot(b.x - a.x, b.y - a.y);
    }

    return { d: dStr, totalLength: length };
  }, [personality, width, height]);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height="100%"
      aria-hidden
      className="overflow-visible"
    >
      <defs>
        <linearGradient id={`traj-${personality}`} x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={accent} stopOpacity="0.15" />
          <stop offset="100%" stopColor={accent} stopOpacity="0.95" />
        </linearGradient>
      </defs>

      {/* Faint baseline reference (straight line) */}
      <line
        x1={16}
        y1={height - 16}
        x2={width - 16}
        y2={16}
        stroke="rgba(255,255,255,0.08)"
        strokeDasharray="2 4"
        strokeWidth="1"
      />

      {/* Endpoints */}
      <circle cx={16} cy={height - 16} r="3" fill={accent} fillOpacity="0.35" />
      <circle cx={width - 16} cy={16} r="3" fill={accent} />
      <circle
        cx={width - 16}
        cy={16}
        r="7"
        fill="none"
        stroke={accent}
        strokeOpacity="0.4"
        strokeWidth="1"
      />

      {/* Animated trajectory */}
      {shouldReduceMotion ? (
        <path
          d={d}
          fill="none"
          stroke={`url(#traj-${personality})`}
          strokeWidth="1.75"
          strokeLinecap="round"
        />
      ) : (
        <motion.path
          d={d}
          fill="none"
          stroke={`url(#traj-${personality})`}
          strokeWidth="1.75"
          strokeLinecap="round"
          initial={{ strokeDasharray: totalLength, strokeDashoffset: totalLength }}
          whileInView={{ strokeDashoffset: 0 }}
          viewport={{ once: true, margin: '0px 0px -10% 0px' }}
          transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
        />
      )}
    </svg>
  );
}
