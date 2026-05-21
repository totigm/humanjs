'use client';

import { useEffect } from 'react';
import { Button } from '../components/primitives';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-[80vh] items-center justify-center px-6">
      <div className="max-w-md text-center">
        <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.3em] text-muted">
          Something broke
        </p>
        <h1 className="text-balance text-3xl font-medium leading-tight tracking-[-0.02em] md:text-4xl">
          We hit a snag rendering this page.{' '}
          <span className="font-display italic text-accent">Try again.</span>
        </h1>
        {error.digest && (
          <p className="mt-4 font-mono text-xs text-muted/70">ref: {error.digest}</p>
        )}
        <div className="mt-8 flex items-center justify-center gap-3">
          <Button onClick={reset}>Try again</Button>
          <Button variant="ghost" href="/">
            Go home
          </Button>
        </div>
      </div>
    </main>
  );
}
