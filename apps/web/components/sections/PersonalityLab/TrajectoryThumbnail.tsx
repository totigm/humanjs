'use client';

import type { PresetName } from '@humanjs/core';
import { useMemo } from 'react';
import { makeHumanizedPath, toSvgPathD } from '../../../lib/path';
import { personalityPresets } from './presets';

interface TrajectoryThumbnailProps {
  personality: PresetName;
  active: boolean;
}

export function TrajectoryThumbnail({ personality, active }: TrajectoryThumbnailProps) {
  const d = useMemo(() => {
    const preset = personalityPresets.find((p) => p.key === personality);
    if (!preset) return '';
    const path = makeHumanizedPath({ x: 6, y: 26 }, { x: 74, y: 6 }, `thumb-${personality}`, {
      curvature: preset.curvature,
      steps: 24,
      jitterPx: 0.4,
    });
    return toSvgPathD(path);
  }, [personality]);

  return (
    <svg width="80" height="32" viewBox="0 0 80 32" aria-hidden>
      <line x1="6" y1="26" x2="74" y2="6" stroke="rgba(245,230,215,0.08)" strokeDasharray="2 3" />
      <path
        d={d}
        fill="none"
        stroke={active ? '#f5a55c' : 'rgba(138, 133, 124, 0.6)'}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="6" cy="26" r="1.5" fill={active ? '#f5a55c' : 'rgba(138, 133, 124, 0.6)'} />
      <circle cx="74" cy="6" r="2" fill={active ? '#f5a55c' : 'rgba(138, 133, 124, 0.8)'} />
    </svg>
  );
}
