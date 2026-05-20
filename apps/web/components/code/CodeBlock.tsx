'use client';

import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { cn } from '../../lib/cn';

interface CodeBlockProps {
  code: string;
  language?: string;
  label?: string;
  accent?: 'warm' | 'cool' | 'neutral';
  showCopy?: boolean;
  className?: string;
}

const accentClasses = {
  warm: 'border-accent/20 shadow-[0_0_40px_-12px_rgba(245,165,92,0.25)]',
  cool: 'border-accent-cool/20',
  neutral: 'border-hairline',
};

const labelAccentClasses = {
  warm: 'text-accent',
  cool: 'text-accent-cool',
  neutral: 'text-muted',
};

export function CodeBlock({
  code,
  language = 'ts',
  label,
  accent = 'neutral',
  showCopy = true,
  className,
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable; silently ignore
    }
  };

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-card-lg border bg-surface',
        accentClasses[accent],
        className,
      )}
    >
      {label && (
        <div className="flex items-center justify-between border-b border-hairline px-4 py-2.5">
          <span
            className={cn(
              'font-mono text-[11px] uppercase tracking-[0.18em]',
              labelAccentClasses[accent],
            )}
          >
            {label}
          </span>
          <span className="font-mono text-[10px] text-muted/60">{language}</span>
        </div>
      )}
      <pre className="overflow-x-auto p-5 text-sm">
        <code className="font-mono text-foreground/90 leading-relaxed">{code}</code>
      </pre>
      {showCopy && (
        <button
          type="button"
          onClick={handleCopy}
          aria-label={copied ? 'Copied' : 'Copy code'}
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-md border border-hairline bg-canvas/80 text-muted opacity-0 backdrop-blur transition-opacity duration-200 hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-accent" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </button>
      )}
    </div>
  );
}
