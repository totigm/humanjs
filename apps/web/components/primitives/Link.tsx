import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/cn';

type Variant = 'default' | 'subtle';

interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'children'> {
  href: string;
  variant?: Variant;
  children: ReactNode;
}

const variantClasses: Record<Variant, string> = {
  default:
    'text-foreground underline decoration-muted/40 underline-offset-4 transition-colors duration-200 hover:decoration-accent hover:text-accent',
  subtle: 'text-muted transition-colors duration-200 hover:text-foreground',
};

export function Link({ href, variant = 'default', className, children, ...rest }: LinkProps) {
  const isExternal = href.startsWith('http');
  return (
    <a
      href={href}
      className={cn(
        'outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas rounded-sm',
        variantClasses[variant],
        className,
      )}
      {...(isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      {...rest}
    >
      {children}
    </a>
  );
}
