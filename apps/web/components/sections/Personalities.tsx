import { careful, distracted, fast, type Personality, precise } from '@humanjs/core';
import { cn } from '../../lib/cn';
import { TrajectoryCanvas } from '../motion/TrajectoryCanvas';
import { Container, ScrollReveal, Section } from '../primitives';

interface PersonalityCardData {
  preset: Personality;
  key: 'careful' | 'fast' | 'distracted' | 'precise';
  tagline: string;
  description: string;
}

const presets: PersonalityCardData[] = [
  {
    preset: careful,
    key: 'careful',
    tagline: 'Reads everything twice.',
    description: 'High dwell, low jitter. Slow trajectories, mid curvature.',
  },
  {
    preset: fast,
    key: 'fast',
    tagline: 'Knows exactly where to go.',
    description: 'Low dwell, brisk travel. Confident, no second-guessing.',
  },
  {
    preset: distracted,
    key: 'distracted',
    tagline: 'Multitasking. Likes a sidebar.',
    description: 'Higher curvature and jitter. Variable pauses between actions.',
  },
  {
    preset: precise,
    key: 'precise',
    tagline: 'Surgical.',
    description: 'Near-straight paths, minimal noise. Direct intent.',
  },
];

export function Personalities() {
  return (
    <Section id="personalities" density="default">
      <Container width="lg">
        <ScrollReveal>
          <div className="mb-12 text-center md:mb-16">
            <p className="mb-3 font-mono text-xs uppercase tracking-[0.3em] text-muted">
              Personalities
            </p>
            <h2 className="text-balance text-3xl font-semibold tracking-[-0.02em] md:text-5xl">
              Four shapes of human, <span className="text-accent">extendable</span> in code.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-balance text-base text-muted md:text-lg">
              Built-in presets are pure data. Override fields, blend two presets, or ship your own
              as <code className="font-mono text-foreground/80">@yourname/personality-*</code>.
            </p>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-5 lg:grid-cols-4">
          {presets.map((p, i) => (
            <ScrollReveal key={p.key} delay={i * 0.08}>
              <PersonalityCard data={p} />
            </ScrollReveal>
          ))}
        </div>
      </Container>
    </Section>
  );
}

function PersonalityCard({ data }: { data: PersonalityCardData }) {
  return (
    <article
      className={cn(
        'group relative flex h-full flex-col overflow-hidden rounded-card-lg border border-hairline bg-surface transition-all duration-300',
        'hover:border-white/15 hover:bg-white/[0.04]',
      )}
    >
      <div className="border-b border-hairline px-5 pt-5 pb-3">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
          {data.preset.name}
        </p>
        <p className="mt-2 text-lg font-semibold tracking-tight text-foreground">{data.tagline}</p>
      </div>

      <div className="px-5 py-5">
        <TrajectoryCanvas personality={data.key} />
      </div>

      <div className="mt-auto border-t border-hairline px-5 py-4">
        <p className="text-xs text-muted">{data.description}</p>
        <dl className="mt-3 grid grid-cols-3 gap-3 font-mono text-[10px] uppercase tracking-[0.1em]">
          <div>
            <dt className="text-muted/60">Curve</dt>
            <dd className="mt-0.5 text-foreground">{data.preset.mouse.curvature.toFixed(2)}</dd>
          </div>
          <div>
            <dt className="text-muted/60">Travel</dt>
            <dd className="mt-0.5 text-foreground">{data.preset.mouse.travelTimeMs}ms</dd>
          </div>
          <div>
            <dt className="text-muted/60">Jitter</dt>
            <dd className="mt-0.5 text-foreground">
              {(data.preset.mouse.travelTimeJitter * 100).toFixed(0)}%
            </dd>
          </div>
        </dl>
      </div>
    </article>
  );
}
