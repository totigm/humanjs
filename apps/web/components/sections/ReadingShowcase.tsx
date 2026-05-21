'use client';

import type { PresetName } from '@humanjs/core';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { cn } from '../../lib/cn';
import { ReadingDemo } from '../motion/ReadingDemo';
import { Container, ScrollReveal, Section, SectionEyebrow, SectionHeadline } from '../primitives';

const personalities: { key: PresetName; label: string; hint: string }[] = [
  { key: 'careful', label: 'careful', hint: 'thorough' },
  { key: 'fast', label: 'fast', hint: 'skims' },
  { key: 'distracted', label: 'distracted', hint: 'pauses' },
  { key: 'precise', label: 'precise', hint: 'parses each word' },
];

export function ReadingShowcase() {
  const [personality, setPersonality] = useState<PresetName>('careful');

  return (
    <Section id="reading" density="default">
      <Container width="lg">
        <ScrollReveal>
          <div className="mb-10 max-w-3xl md:mb-12">
            <SectionEyebrow>And the pace</SectionEyebrow>
            <SectionHeadline data-ghost-cursor="true">
              The space between clicks.{' '}
              <span className="font-display italic text-accent">Worth modeling.</span>
            </SectionHeadline>
            <p className="mt-6 max-w-xl text-balance text-base text-muted-strong md:text-lg">
              Real users pause to read before they click. HumanJS models that pause from word count
              and the personality&rsquo;s reading speed — code reads slower than prose, scan mode
              skims, and `&lt;pre&gt;` tags auto-detect when you don&rsquo;t specify.
            </p>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={0.08}>
          <div className="mx-auto max-w-4xl">
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
                      layoutId="reading-personality-marker"
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
            <ReadingDemo personality={personality} />
          </div>
        </ScrollReveal>
      </Container>
    </Section>
  );
}
