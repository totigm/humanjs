import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

type Density = 'tight' | 'default' | 'loose';

interface SectionProps {
  id?: string;
  density?: Density;
  className?: string;
  children: ReactNode;
}

const densityClasses: Record<Density, string> = {
  tight: 'py-16 md:py-20',
  default: 'py-24 md:py-32',
  loose: 'py-32 md:py-40',
};

export function Section({ id, density = 'default', className, children }: SectionProps) {
  return (
    <section id={id} className={cn(densityClasses[density], className)}>
      {children}
    </section>
  );
}
