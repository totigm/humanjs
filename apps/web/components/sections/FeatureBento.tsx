import type { LucideIcon } from 'lucide-react';
import { Activity, GitBranch, KeyboardIcon, Sparkles, TimerReset, Zap } from 'lucide-react';
import { cn } from '../../lib/cn';
import { BezierDecoration } from '../motion';
import { Container, ScrollReveal, Section, SectionEyebrow, SectionHeadline } from '../primitives';

interface FeatureCell {
  icon: LucideIcon;
  title: string;
  description: string;
  span: string;
  decoration?: 'bezier' | 'pulse' | 'none';
}

const features: FeatureCell[] = [
  {
    icon: Activity,
    title: 'Bezier mouse paths',
    description:
      'Curved trajectories with overshoot, sub-pixel jitter, and bell-curve velocity. No straight lines, no instant teleports.',
    span: 'md:col-span-4 md:row-span-2',
    decoration: 'bezier',
  },
  {
    icon: GitBranch,
    title: 'Deterministic',
    description: 'Same seed, same trajectory. Snapshot-test friendly.',
    span: 'md:col-span-2 md:row-span-1',
  },
  {
    icon: Zap,
    title: "speed: 'instant'",
    description: 'One flag bypasses all humanization. Tests stay fast in CI.',
    span: 'md:col-span-2 md:row-span-1',
    decoration: 'pulse',
  },
  {
    icon: KeyboardIcon,
    title: 'Typing rhythm',
    description: 'Per-character timing with typo + backspace recovery.',
    span: 'md:col-span-2 md:row-span-1',
  },
  {
    icon: TimerReset,
    title: 'Reading dwell',
    description: 'human.read(text) pauses based on word count.',
    span: 'md:col-span-2 md:row-span-1',
  },
  {
    icon: Sparkles,
    title: 'Plugin system',
    description: 'Extend personalities, actions, primitives. Day-one architecture.',
    span: 'md:col-span-2 md:row-span-1',
  },
];

export function FeatureBento() {
  return (
    <Section density="default">
      <Container width="lg">
        <ScrollReveal>
          <div className="mb-12 max-w-3xl md:mb-16">
            <SectionEyebrow>Under the hood</SectionEyebrow>
            <SectionHeadline data-ghost-cursor="true">
              Realism, <span className="font-display italic text-accent">all the way down.</span>
            </SectionHeadline>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-6 md:gap-5">
          {features.map((feature, i) => (
            <ScrollReveal key={feature.title} delay={i * 0.06} className={cn(feature.span)}>
              <FeatureCard feature={feature} />
            </ScrollReveal>
          ))}
        </div>
      </Container>
    </Section>
  );
}

function FeatureCard({ feature }: { feature: FeatureCell }) {
  const Icon = feature.icon;
  return (
    <article
      className={cn(
        'group relative flex h-full flex-col overflow-hidden rounded-card-lg border border-hairline bg-surface p-6 transition-all duration-300',
        'hover:border-hairline-strong hover:bg-surface-elevated',
        feature.decoration === 'bezier' && 'min-h-[360px] md:p-8',
      )}
    >
      {feature.decoration === 'bezier' && <BezierDecoration />}
      {feature.decoration === 'pulse' && <PulseDecoration />}

      <div className="relative z-10">
        <div className="mb-5 flex h-9 w-9 items-center justify-center rounded-md border border-hairline bg-canvas">
          <Icon className="h-4 w-4 text-accent" strokeWidth={1.75} />
        </div>
        <h3 className="text-base font-medium tracking-tight text-foreground">{feature.title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-strong">{feature.description}</p>
      </div>
    </article>
  );
}

function PulseDecoration() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full opacity-50"
      style={{ background: 'radial-gradient(circle, rgba(245, 165, 92, 0.18), transparent 70%)' }}
    />
  );
}
