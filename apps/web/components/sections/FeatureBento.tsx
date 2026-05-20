import type { LucideIcon } from 'lucide-react';
import { Activity, GitBranch, KeyboardIcon, Sparkles, TimerReset, Zap } from 'lucide-react';
import { cn } from '../../lib/cn';
import { Container, ScrollReveal, Section } from '../primitives';

interface FeatureCell {
  icon: LucideIcon;
  title: string;
  description: string;
  span: string;
  span2?: string;
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
          <div className="mb-12 text-center md:mb-16">
            <p className="mb-3 font-mono text-xs uppercase tracking-[0.3em] text-muted">
              Under the hood
            </p>
            <h2 className="text-balance text-3xl font-semibold tracking-[-0.02em] md:text-5xl">
              Realism, all the way down.
            </h2>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-6 md:gap-6">
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
        'hover:border-white/15 hover:bg-white/[0.04]',
        feature.decoration === 'bezier' && 'min-h-[360px] md:p-8',
      )}
    >
      {feature.decoration === 'bezier' && <BezierDecoration />}
      {feature.decoration === 'pulse' && <PulseDecoration />}

      <div className="relative z-10">
        <div className="mb-5 flex h-9 w-9 items-center justify-center rounded-md border border-hairline bg-canvas">
          <Icon className="h-4 w-4 text-accent" strokeWidth={1.75} />
        </div>
        <h3 className="text-base font-semibold tracking-tight text-foreground">{feature.title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted">{feature.description}</p>
      </div>
    </article>
  );
}

function BezierDecoration() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 400 360"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden
    >
      <defs>
        <linearGradient id="bezier-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f5a55c" stopOpacity="0" />
          <stop offset="50%" stopColor="#f5a55c" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#f5a55c" stopOpacity="0.05" />
        </linearGradient>
        <linearGradient id="bezier-gradient-2" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#5b7cc9" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#5b7cc9" stopOpacity="0.05" />
        </linearGradient>
      </defs>
      <path
        d="M 50 320 C 120 280, 220 340, 280 240 S 360 100, 380 60"
        fill="none"
        stroke="url(#bezier-gradient)"
        strokeWidth="1.5"
      />
      <path
        d="M 30 340 C 90 260, 180 320, 250 220 S 320 80, 350 40"
        fill="none"
        stroke="url(#bezier-gradient-2)"
        strokeWidth="1"
      />
      <circle cx="380" cy="60" r="3" fill="#f5a55c" />
      <circle cx="380" cy="60" r="8" fill="none" stroke="#f5a55c" strokeOpacity="0.3" />
      <circle cx="50" cy="320" r="2" fill="#f5a55c" opacity="0.4" />
    </svg>
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
