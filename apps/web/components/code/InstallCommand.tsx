'use client';

import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { cn } from '../../lib/cn';

const managers = ['pnpm', 'npm', 'yarn', 'bun'] as const;
type Manager = (typeof managers)[number];

const commandFor = (manager: Manager, pkg: string): string => {
  switch (manager) {
    case 'pnpm':
      return `pnpm add ${pkg}`;
    case 'npm':
      return `npm install ${pkg}`;
    case 'yarn':
      return `yarn add ${pkg}`;
    case 'bun':
      return `bun add ${pkg}`;
  }
};

interface InstallCommandProps {
  pkg?: string;
  className?: string;
}

export function InstallCommand({ pkg = '@humanjs/playwright', className }: InstallCommandProps) {
  const [manager, setManager] = useState<Manager>('pnpm');
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(commandFor(manager, pkg));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable
    }
  };

  return (
    <div
      className={cn('overflow-hidden rounded-card-lg border border-hairline bg-surface', className)}
    >
      <div className="flex items-center justify-between border-b border-hairline px-1 py-1">
        <div className="flex gap-0.5">
          {managers.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setManager(m)}
              className={cn(
                'rounded-md px-3 py-1.5 font-mono text-xs transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-accent',
                manager === m ? 'bg-canvas text-foreground' : 'text-muted hover:text-foreground',
              )}
            >
              {m}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={handleCopy}
          aria-label={copied ? 'Copied' : 'Copy command'}
          className="mr-2 flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-accent" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
      <pre className="overflow-x-auto px-5 py-4 font-mono text-sm text-foreground/90">
        <span className="select-none text-muted">$ </span>
        {commandFor(manager, pkg)}
      </pre>
    </div>
  );
}
