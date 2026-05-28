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
        <div className="flex items-center justify-between gap-3 border-b border-hairline px-4 py-2.5">
          <span
            className={cn(
              'font-mono text-[11px] uppercase tracking-[0.18em]',
              labelAccentClasses[accent],
            )}
          >
            {label}
          </span>
          <div className="flex items-center gap-3">
            <span className="font-mono text-[10px] text-muted/60">{language}</span>
            {showCopy && <CopyButton copied={copied} onCopy={handleCopy} />}
          </div>
        </div>
      )}
      <pre className="overflow-x-auto p-5 text-sm">
        {/* Reset inherited sans stylistic sets (ss01/cv11) so monospace code
            renders character-exact — otherwise spacing around tokens like
            " -- " can look collapsed. */}
        <code className="font-mono text-foreground/90 leading-relaxed [font-feature-settings:normal]">
          {code}
        </code>
      </pre>
      {!label && showCopy && (
        <div className="absolute right-3 top-3 opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-within:opacity-100">
          <CopyButton copied={copied} onCopy={handleCopy} />
        </div>
      )}
    </div>
  );
}

interface CopyButtonProps {
  copied: boolean;
  onCopy: () => void;
}

function CopyButton({ copied, onCopy }: CopyButtonProps) {
  return (
    <button
      type="button"
      onClick={onCopy}
      aria-label={copied ? 'Copied' : 'Copy code'}
      className="flex h-6 w-6 items-center justify-center rounded text-muted/70 transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-accent" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}
