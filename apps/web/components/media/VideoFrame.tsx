'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { Play } from 'lucide-react';
import { cn } from '../../lib/cn';

interface VideoFrameProps {
  className?: string;
  caption?: string;
}

export function VideoFrame({
  className,
  caption = 'Robotic Playwright vs HumanJS',
}: VideoFrameProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div
      className={cn(
        'relative aspect-video w-full overflow-hidden rounded-card-lg border border-hairline bg-surface',
        className,
      )}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center">
          <motion.div
            className="flex h-16 w-16 items-center justify-center rounded-full border border-hairline bg-canvas/80 backdrop-blur"
            initial={shouldReduceMotion ? undefined : { scale: 0.9 }}
            animate={shouldReduceMotion ? undefined : { scale: [0.95, 1, 0.95] }}
            transition={{ duration: 3, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
          >
            <Play className="h-6 w-6 fill-accent text-accent" />
          </motion.div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">{caption}</p>
          <p className="text-xs text-muted">30-second hero video · coming soon</p>
        </div>
      </div>

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(135deg, rgba(245, 165, 92, 0.04) 0%, transparent 50%, rgba(91, 124, 201, 0.04) 100%)',
        }}
      />

      <div className="absolute left-4 top-4 flex gap-1.5">
        <div className="h-2.5 w-2.5 rounded-full bg-white/10" />
        <div className="h-2.5 w-2.5 rounded-full bg-white/10" />
        <div className="h-2.5 w-2.5 rounded-full bg-white/10" />
      </div>
    </div>
  );
}
