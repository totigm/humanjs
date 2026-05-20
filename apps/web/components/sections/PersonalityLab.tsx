'use client';

import { careful, distracted, fast, type PresetName, precise } from '@humanjs/core';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { cn } from '../../lib/cn';
import { PersonalityCursor } from '../motion/PersonalityCursor';
import { Container, ScrollReveal, Section } from '../primitives';

interface PersonalityMeta {
  key: PresetName;
  tagline: string;
  description: string;
  travelMs: number;
  curvature: number;
  jitterPercent: number;
}

const presets: PersonalityMeta[] = [
  {
    key: 'careful',
    tagline: 'Reads everything twice.',
    description: 'High dwell, medium curvature. Slow, deliberate trajectories.',
    travelMs: careful.mouse.travelTimeMs,
    curvature: careful.mouse.curvature,
    jitterPercent: careful.mouse.travelTimeJitter,
  },
  {
    key: 'fast',
    tagline: 'Knows exactly where to go.',
    description: 'Brisk travel, low dwell. Confident, no second-guessing.',
    travelMs: fast.mouse.travelTimeMs,
    curvature: fast.mouse.curvature,
    jitterPercent: fast.mouse.travelTimeJitter,
  },
  {
    key: 'distracted',
    tagline: 'Multitasking. Lots of sidebars.',
    description: 'Higher curvature and jitter, variable pauses between actions.',
    travelMs: distracted.mouse.travelTimeMs,
    curvature: distracted.mouse.curvature,
    jitterPercent: distracted.mouse.travelTimeJitter,
  },
  {
    key: 'precise',
    tagline: 'Surgical.',
    description: 'Near-straight paths, minimal noise. Direct intent.',
    travelMs: precise.mouse.travelTimeMs,
    curvature: precise.mouse.curvature,
    jitterPercent: precise.mouse.travelTimeJitter,
  },
];

export function PersonalityLab() {
  const [active, setActive] = useState<PresetName>('careful');
  const activePreset = presets.find((p) => p.key === active) ?? presets[0];
  if (!activePreset) return null;

  return (
    <Section id="personalities" density="loose">
      <Container width="lg">
        <ScrollReveal>
          <div className="mb-12 max-w-3xl md:mb-16">
            <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.3em] text-muted">
              The lab
            </p>
            <h2 className="text-balance text-4xl font-medium leading-[1.05] tracking-[-0.02em] md:text-6xl">
              Four shapes of human.{' '}
              <span className="font-display italic text-accent">Pick one.</span>
            </h2>
            <p className="mt-6 max-w-xl text-balance text-base text-muted-strong md:text-lg">
              Each personality is pure data. The same library, four different rhythms — or compose
              your own with <code className="font-mono text-foreground/90">blend()</code>.
            </p>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={0.1}>
          <div className="overflow-hidden rounded-card-lg border border-hairline bg-surface/50">
            {/* Tabs */}
            <div
              role="tablist"
              aria-label="Personality picker"
              className="flex items-center gap-1 overflow-x-auto border-b border-hairline p-1.5"
            >
              {presets.map((preset) => (
                <button
                  key={preset.key}
                  type="button"
                  role="tab"
                  aria-selected={preset.key === active}
                  onClick={() => setActive(preset.key)}
                  className={cn(
                    'relative shrink-0 rounded-md px-4 py-2 font-mono text-xs uppercase tracking-[0.18em] transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-accent',
                    preset.key === active ? 'text-accent' : 'text-muted hover:text-foreground',
                  )}
                >
                  {preset.key === active && (
                    <motion.span
                      layoutId="active-personality-tab"
                      className="absolute inset-0 rounded-md bg-accent/10"
                      transition={{ type: 'spring', bounce: 0.18, duration: 0.5 }}
                    />
                  )}
                  <span className="relative">{preset.key}</span>
                </button>
              ))}
            </div>

            {/* Lab body */}
            <div className="grid grid-cols-1 lg:grid-cols-5">
              <div className="border-b border-hairline p-6 md:p-8 lg:col-span-3 lg:border-b-0 lg:border-r">
                <PersonalityCursor key={active} personality={active} />
              </div>

              <motion.div
                key={active}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-col gap-6 p-6 md:p-8 lg:col-span-2"
              >
                <div>
                  <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">
                    {activePreset.key}
                  </p>
                  <p className="mt-3 font-display text-3xl italic leading-tight tracking-tight text-foreground md:text-4xl">
                    {activePreset.tagline}
                  </p>
                  <p className="mt-3 text-sm text-muted-strong">{activePreset.description}</p>
                </div>

                <dl className="grid grid-cols-3 gap-4 border-t border-hairline pt-6">
                  <Stat label="Curvature" value={activePreset.curvature.toFixed(2)} />
                  <Stat label="Travel" value={`${activePreset.travelMs}ms`} />
                  <Stat
                    label="Jitter"
                    value={`${(activePreset.jitterPercent * 100).toFixed(0)}%`}
                  />
                </dl>

                <pre className="overflow-x-auto rounded-card border border-hairline bg-canvas p-4 font-mono text-[11px] leading-relaxed text-foreground/90">
                  <span className="text-muted">{`{ `}</span>
                  {`personality: `}
                  <span className="text-accent">{`'${activePreset.key}'`}</span>
                  <span className="text-muted">{` }`}</span>
                </pre>
              </motion.div>
            </div>
          </div>
        </ScrollReveal>
      </Container>
    </Section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted/70">{label}</dt>
      <dd className="mt-1.5 font-mono text-base text-foreground">{value}</dd>
    </div>
  );
}
