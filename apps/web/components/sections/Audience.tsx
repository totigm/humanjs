import type { LucideIcon } from 'lucide-react';
import { Bot, ClapperboardIcon, FlaskConical } from 'lucide-react';
import { cn } from '../../lib/cn';
import { Container, ScrollReveal, Section } from '../primitives';

interface AudienceCardData {
  icon: LucideIcon;
  title: string;
  description: string;
  examples: string;
}

const audiences: AudienceCardData[] = [
  {
    icon: Bot,
    title: 'AI agent builders',
    description:
      'Browser Use, Stagehand, Playwright MCP — without the giveaway robotic clicks that flag your agent as a bot.',
    examples: 'Browser Use · Stagehand · MCP',
  },
  {
    icon: FlaskConical,
    title: 'QA engineers',
    description:
      'Catch race conditions that only surface at real human pace. One flag flips to instant mode for fast CI.',
    examples: 'Playwright · Vitest · CI',
  },
  {
    icon: ClapperboardIcon,
    title: 'Demo & tutorial creators',
    description:
      'Record polished walkthroughs without driving the cursor by hand. Same script, smoother output.',
    examples: 'Loom · YouTube · screencasts',
  },
];

export function Audience() {
  return (
    <Section density="default">
      <Container width="lg">
        <ScrollReveal>
          <div className="mb-12 text-center md:mb-16">
            <p className="mb-3 font-mono text-xs uppercase tracking-[0.3em] text-muted">
              Who it's for
            </p>
            <h2 className="text-balance text-3xl font-semibold tracking-[-0.02em] md:text-5xl">
              Three audiences, one library.
            </h2>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
          {audiences.map((audience, i) => (
            <ScrollReveal key={audience.title} delay={i * 0.08}>
              <AudienceCard data={audience} />
            </ScrollReveal>
          ))}
        </div>
      </Container>
    </Section>
  );
}

function AudienceCard({ data }: { data: AudienceCardData }) {
  const Icon = data.icon;
  return (
    <article
      className={cn(
        'group relative h-full overflow-hidden rounded-card-lg border border-hairline bg-surface p-6 transition-all duration-300',
        'hover:border-white/15 hover:bg-white/[0.04]',
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{
          background:
            'radial-gradient(circle at 50% 0%, rgba(245, 165, 92, 0.06), transparent 70%)',
        }}
      />
      <div className="relative">
        <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-card border border-hairline bg-canvas">
          <Icon className="h-4 w-4 text-accent" strokeWidth={1.75} />
        </div>
        <h3 className="text-lg font-semibold tracking-tight text-foreground">{data.title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted">{data.description}</p>
        <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.15em] text-muted/60">
          {data.examples}
        </p>
      </div>
    </article>
  );
}
