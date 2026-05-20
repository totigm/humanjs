import type { LucideIcon } from 'lucide-react';
import { Layers, Shield, Workflow } from 'lucide-react';
import { cn } from '../../lib/cn';
import { Container, ScrollReveal, Section } from '../primitives';

interface LimitData {
  icon: LucideIcon;
  title: string;
  description: string;
}

const limits: LimitData[] = [
  {
    icon: Shield,
    title: "Won't defeat sophisticated bot detection",
    description:
      "Cursor humanization is one signal among many. Fingerprinting, TLS, and request patterns aren't in scope — and we won't pretend otherwise.",
  },
  {
    icon: Layers,
    title: "Wraps Playwright — doesn't replace it",
    description:
      'Same selectors, same launch, same locator. HumanJS adds humanization on top. If you know Playwright, you know 90% of HumanJS.',
  },
  {
    icon: Workflow,
    title: 'Playwright-first for now',
    description:
      'Puppeteer adapter is on the v3 roadmap. Selenium support is a maybe. Playwright is where the work and the love is in v1.',
  },
];

export function HonestLimits() {
  return (
    <Section density="default">
      <Container width="md">
        <ScrollReveal>
          <div className="mb-12 max-w-2xl md:mb-14">
            <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.3em] text-muted">
              Honest limits
            </p>
            <h2 className="text-balance text-3xl font-medium leading-[1.1] tracking-[-0.02em] md:text-5xl">
              What HumanJS <span className="font-display italic text-accent">won't</span> do.
            </h2>
            <p className="mt-4 max-w-xl text-base text-muted">
              Trust is earned by being clear about boundaries.
            </p>
          </div>
        </ScrollReveal>

        <div className="space-y-3">
          {limits.map((limit, i) => (
            <ScrollReveal key={limit.title} delay={i * 0.08}>
              <LimitRow data={limit} />
            </ScrollReveal>
          ))}
        </div>
      </Container>
    </Section>
  );
}

function LimitRow({ data }: { data: LimitData }) {
  const Icon = data.icon;
  return (
    <article
      className={cn(
        'flex gap-5 rounded-card-lg border border-hairline bg-surface p-5 md:p-6',
        'transition-colors duration-300 hover:border-hairline-strong',
      )}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-hairline bg-canvas">
        <Icon className="h-4 w-4 text-muted" strokeWidth={1.75} />
      </div>
      <div className="min-w-0">
        <h3 className="text-base font-medium tracking-tight text-foreground">{data.title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-strong">{data.description}</p>
      </div>
    </article>
  );
}
