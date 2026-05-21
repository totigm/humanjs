import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface DemoStatusBarProps {
  label: ReactNode;
  sublabel?: ReactNode;
  /** Tailwind bg class for the indicator dot. Defaults to amber. */
  dotClassName?: string;
  /** Tailwind text-color class for the label. Defaults to amber. */
  labelClassName?: string;
}

/**
 * The thin top strip shared by every cursor demo: a colored dot + uppercase
 * mono label on the left, optional meta on the right. Harmonizes the small
 * drift each demo had picked up (text-[10px]/[11px], muted/60/70).
 */
export function DemoStatusBar({
  label,
  sublabel,
  dotClassName = 'bg-accent',
  labelClassName = 'text-accent',
}: DemoStatusBarProps) {
  return (
    <div className="flex items-center justify-between border-b border-hairline px-4 py-2.5">
      <div className="flex items-center gap-2">
        <span className={cn('h-1.5 w-1.5 rounded-full', dotClassName)} />
        <span className={cn('font-mono text-[10px] uppercase tracking-[0.18em]', labelClassName)}>
          {label}
        </span>
      </div>
      {sublabel !== undefined && (
        <span className="font-mono text-[10px] text-muted/70">{sublabel}</span>
      )}
    </div>
  );
}
