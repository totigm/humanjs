'use client';

import type { PresetName } from '@humanjs/core';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { cn } from '../../lib/cn';
import { RecorderDemo } from '../motion/RecorderDemo';
import { Container, ScrollReveal, Section, SectionEyebrow, SectionHeadline } from '../primitives';

const personalities: { key: PresetName; label: string; hint: string }[] = [
  { key: 'careful', label: 'careful', hint: 'deliberate' },
  { key: 'fast', label: 'fast', hint: 'brisk' },
  { key: 'distracted', label: 'distracted', hint: 'with typos' },
  { key: 'precise', label: 'precise', hint: 'clean' },
];

export function RecorderShowcase() {
  const [personality, setPersonality] = useState<PresetName>('careful');

  return (
    <Section id="recorder" density="default">
      <Container width="lg">
        <ScrollReveal>
          <div className="mb-10 max-w-3xl md:mb-12">
            <SectionEyebrow>Bottled motion</SectionEyebrow>
            <SectionHeadline data-ghost-cursor="true">
              Every session, captured.{' '}
              <span className="font-display italic text-accent">Every action, observable.</span>
            </SectionHeadline>
            <p className="mt-6 max-w-xl text-balance text-base text-muted-strong md:text-lg">
              `human.record()` wraps any session — `toVideo()` writes an mp4 of what the user
              actually saw, `toTimeline()` writes the structured action log AI agents and tests can
              replay. Drag the scrubber to step through a captured session, or switch personalities
              to see how each shapes the recording.
            </p>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={0.08}>
          <div className="mx-auto max-w-5xl">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="mr-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted/70">
                Personality
              </span>
              {personalities.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  aria-pressed={personality === p.key}
                  onClick={() => setPersonality(p.key)}
                  className={cn(
                    'relative rounded-full border px-3 py-1 font-mono text-[11px] uppercase tracking-[0.15em] transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-accent',
                    personality === p.key
                      ? 'border-accent/50 bg-accent/10 text-accent'
                      : 'border-hairline text-muted hover:border-hairline-strong hover:text-foreground',
                  )}
                >
                  {personality === p.key && (
                    <motion.span
                      layoutId="recorder-personality-marker"
                      className="absolute inset-0 rounded-full border border-accent/30"
                      transition={{ type: 'spring', bounce: 0.18, duration: 0.45 }}
                    />
                  )}
                  <span className="relative">
                    {p.label}
                    <span className="ml-1.5 text-muted/60">· {p.hint}</span>
                  </span>
                </button>
              ))}
            </div>
            <RecorderDemo personality={personality} />
          </div>
        </ScrollReveal>
      </Container>
    </Section>
  );
}
