import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

interface BaseProps {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
}

type ButtonAsButton = BaseProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof BaseProps> & {
    href?: undefined;
  };

type ButtonAsAnchor = BaseProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof BaseProps> & {
    href: string;
  };

type ButtonProps = ButtonAsButton | ButtonAsAnchor;

const base =
  'inline-flex items-center justify-center gap-2 font-medium tracking-tight rounded-card transition-[transform,background-color,box-shadow,color,border-color] duration-200 ease-out outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:opacity-50 disabled:pointer-events-none';

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-accent text-ink shadow-[0_0_0_var(--color-accent-glow)] hover:scale-[1.02] hover:shadow-[0_0_32px_var(--color-accent-glow)] active:scale-[0.98]',
  secondary:
    'bg-surface text-foreground border border-hairline hover:border-white/20 hover:bg-white/[0.06]',
  ghost: 'text-muted hover:text-foreground',
};

const sizeClasses: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-11 px-5 text-base',
  lg: 'h-12 px-7 text-lg',
};

export function Button(props: ButtonProps) {
  const { variant = 'primary', size = 'md', className, children, ...rest } = props;
  const classes = cn(base, variantClasses[variant], sizeClasses[size], className);

  if ('href' in rest && rest.href !== undefined) {
    const anchorProps = rest as AnchorHTMLAttributes<HTMLAnchorElement>;
    const isExternal = anchorProps.href?.startsWith('http');
    // Spread caller props first, then layer the external-link guards on top
    // so a stray `target='_self'` on an external href can't drop our `rel`.
    return (
      <a
        className={classes}
        {...anchorProps}
        {...(isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      >
        {children}
      </a>
    );
  }

  const buttonProps = rest as ButtonHTMLAttributes<HTMLButtonElement>;
  return (
    <button type={buttonProps.type ?? 'button'} className={classes} {...buttonProps}>
      {children}
    </button>
  );
}
