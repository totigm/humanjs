import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface SectionHeadlineProps extends Omit<HTMLAttributes<HTMLHeadingElement>, 'children'> {
  children: ReactNode;
}

/**
 * Canonical section h2. One section (`HonestLimits`) intentionally diverges
 * with `leading-[1.02] md:text-5xl lg:text-6xl` for a slightly less shouty
 * rhythm; that one stays inline rather than turning this into a variant prop
 * for a single caller.
 */
export function SectionHeadline({ children, className, ...rest }: SectionHeadlineProps) {
  return (
    <h2
      className={cn(
        'text-balance text-4xl font-medium leading-[1.05] tracking-[-0.02em] md:text-6xl',
        className,
      )}
      {...rest}
    >
      {children}
    </h2>
  );
}
