import type { ElementType, ReactNode } from 'react';
import { cn } from '../../lib/cn';

type Width = 'sm' | 'md' | 'lg' | 'xl' | 'full';

interface ContainerProps {
  as?: ElementType;
  width?: Width;
  className?: string;
  children: ReactNode;
}

const widthClasses: Record<Width, string> = {
  sm: 'max-w-3xl',
  md: 'max-w-5xl',
  lg: 'max-w-6xl',
  xl: 'max-w-7xl',
  full: 'max-w-none',
};

export function Container({
  as: Component = 'div',
  width = 'md',
  className,
  children,
}: ContainerProps) {
  return (
    <Component className={cn('mx-auto w-full px-6 md:px-8', widthClasses[width], className)}>
      {children}
    </Component>
  );
}
