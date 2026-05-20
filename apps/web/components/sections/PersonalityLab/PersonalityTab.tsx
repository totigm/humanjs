'use client';

import { motion } from 'framer-motion';
import type { Ref } from 'react';
import { cn } from '../../../lib/cn';
import type { PersonalityMeta } from './presets';
import { TrajectoryThumbnail } from './TrajectoryThumbnail';

interface PersonalityTabProps {
  preset: PersonalityMeta;
  active: boolean;
  tabIndex: 0 | -1;
  buttonRef: Ref<HTMLButtonElement>;
  onSelect: () => void;
}

export function PersonalityTab({
  preset,
  active,
  tabIndex,
  buttonRef,
  onSelect,
}: PersonalityTabProps) {
  return (
    <button
      ref={buttonRef}
      type="button"
      role="tab"
      aria-selected={active}
      tabIndex={tabIndex}
      onClick={onSelect}
      className={cn(
        'group relative flex flex-col items-start gap-2 border-r border-hairline px-4 py-4 text-left transition-colors duration-200 last:border-r-0 outline-none focus-visible:bg-surface-elevated focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent',
        active ? 'bg-surface-elevated' : 'hover:bg-surface-elevated/50',
      )}
    >
      {active && (
        <motion.span
          layoutId="active-personality-marker"
          className="absolute inset-x-0 top-0 h-px bg-accent"
          transition={{ type: 'spring', bounce: 0.18, duration: 0.45 }}
        />
      )}
      <TrajectoryThumbnail personality={preset.key} active={active} />
      <span
        className={cn(
          'font-mono text-[11px] uppercase tracking-[0.18em] transition-colors',
          active ? 'text-accent' : 'text-muted group-hover:text-foreground',
        )}
      >
        {preset.key}
      </span>
    </button>
  );
}
