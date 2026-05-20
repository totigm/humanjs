'use client';

import { motion } from 'framer-motion';
import { MousePointer2 } from 'lucide-react';
import { cn } from '../../lib/cn';
import { EASE_EXPO } from '../../lib/motion';
import { useHumanCursor } from './HumanCursorProvider';

export function CursorToggle() {
  const { enabled, toggle, supported } = useHumanCursor();

  if (!supported) return null;

  return (
    <motion.button
      type="button"
      onClick={toggle}
      aria-pressed={enabled}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 1.6, ease: EASE_EXPO }}
      className={cn(
        'group fixed bottom-5 right-5 z-[70] flex items-center gap-2.5 rounded-full border bg-canvas/85 px-3.5 py-2 text-xs font-medium tracking-tight backdrop-blur-md transition-all duration-300',
        'shadow-[0_8px_24px_-12px_rgba(0,0,0,0.6)]',
        'outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
        enabled
          ? 'border-accent/40 text-accent shadow-[0_0_24px_-8px_rgba(245,165,92,0.6)]'
          : 'border-hairline text-muted hover:border-white/15 hover:text-foreground',
      )}
    >
      <span className="relative flex h-2 w-2 items-center justify-center">
        <span
          className={cn(
            'absolute inline-flex h-2 w-2 rounded-full transition-colors duration-300',
            enabled ? 'bg-accent' : 'bg-muted/50',
          )}
        />
        {enabled && (
          <motion.span
            className="absolute inline-flex h-2 w-2 rounded-full bg-accent"
            initial={{ scale: 1, opacity: 0 }}
            animate={{
              // Start AND end at opacity 0 so the loop boundary has no visible
              // discontinuity. A single-pair animate value would snap from
              // opacity 0 back to the initial value on every iteration — that
              // snap reads as a flash.
              scale: [1, 1.2, 2.4],
              opacity: [0, 0.55, 0],
            }}
            transition={{
              duration: 1.6,
              repeat: Number.POSITIVE_INFINITY,
              ease: 'easeOut',
              times: [0, 0.2, 1],
            }}
          />
        )}
      </span>
      <MousePointer2 className="h-3.5 w-3.5" strokeWidth={2} />
      <span className="font-mono uppercase tracking-[0.15em]">
        {enabled ? 'cursor humanized' : 'humanize cursor'}
      </span>
    </motion.button>
  );
}
