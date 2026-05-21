import { Check, ExternalLink } from 'lucide-react';
import { GithubMark } from '../icons';
import { Container, ScrollReveal, Section } from '../primitives';

interface Signal {
  label: string;
  value: string;
  href?: string;
  iconKind: 'check' | 'github' | 'external';
}

const signals: Signal[] = [
  {
    label: 'Latest',
    value: '@humanjs/core@0.2.0',
    href: 'https://www.npmjs.com/package/@humanjs/core',
    iconKind: 'external',
  },
  {
    label: 'Built on',
    value: 'Playwright 1.40+',
    href: 'https://playwright.dev',
    iconKind: 'external',
  },
  {
    label: 'Signed',
    value: 'npm provenance',
    href: 'https://docs.npmjs.com/generating-provenance-statements',
    iconKind: 'check',
  },
  {
    label: 'Source',
    value: 'totigm/humanjs',
    href: 'https://github.com/totigm/humanjs',
    iconKind: 'github',
  },
];

export function TrustStrip() {
  return (
    <Section density="tight" className="border-y border-hairline bg-surface/30">
      <Container width="lg">
        <ScrollReveal>
          <div className="grid grid-cols-2 gap-y-6 sm:grid-cols-4">
            {signals.map((signal) => (
              <SignalCell key={signal.label} signal={signal} />
            ))}
          </div>
        </ScrollReveal>
      </Container>
    </Section>
  );
}

function SignalCell({ signal }: { signal: Signal }) {
  const Icon =
    signal.iconKind === 'github' ? (
      <GithubMark size={12} />
    ) : signal.iconKind === 'check' ? (
      <Check className="h-3 w-3" />
    ) : (
      <ExternalLink className="h-3 w-3" />
    );

  const inner = (
    <>
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted/70">
        {signal.label}
      </p>
      <p className="mt-2 flex items-center gap-1.5 font-mono text-sm text-foreground">
        <span className="text-accent">{Icon}</span>
        <span className="truncate">{signal.value}</span>
      </p>
    </>
  );

  if (!signal.href) {
    return <div>{inner}</div>;
  }

  return (
    <a
      href={signal.href}
      target="_blank"
      rel="noopener noreferrer"
      className="group block rounded-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent"
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted/70 transition-colors group-hover:text-muted">
        {signal.label}
      </p>
      <p className="mt-2 flex items-center gap-1.5 font-mono text-sm text-foreground transition-colors group-hover:text-accent">
        <span className="text-accent">{Icon}</span>
        <span className="truncate">{signal.value}</span>
      </p>
    </a>
  );
}
