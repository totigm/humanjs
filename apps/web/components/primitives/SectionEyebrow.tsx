import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface SectionEyebrowProps {
  children: ReactNode;
  className?: string;
}

/**
 * Small uppercase mono label that sits above each section's headline.
 * Pass inline JSX (e.g. an accent dot, a number) as children for variants.
 */
export function SectionEyebrow({ children, className }: SectionEyebrowProps) {
  return (
    <p
      className={cn('mb-4 font-mono text-[11px] uppercase tracking-[0.3em] text-muted', className)}
    >
      {children}
    </p>
  );
}
