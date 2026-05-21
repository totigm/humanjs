'use client';

import type { PresetName } from '@humanjs/core';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { cn } from '../../lib/cn';
import { TypingDemo } from '../motion/TypingDemo';
import { Container, ScrollReveal, Section, SectionEyebrow, SectionHeadline } from '../primitives';

const personalities: { key: PresetName; label: string; hint: string }[] = [
  { key: 'careful', label: 'careful', hint: 'measured' },
  { key: 'fast', label: 'fast', hint: 'brisk' },
  { key: 'distracted', label: 'distracted', hint: 'more typos' },
  { key: 'precise', label: 'precise', hint: 'almost no errors' },
];

export function TypingShowcase() {
  const [personality, setPersonality] = useState<PresetName>('careful');

  return (
    <Section id="typing" density="default">
      <Container width="lg">
        <ScrollReveal>
          <div className="mb-10 max-w-3xl md:mb-12">
            <SectionEyebrow>Now the keyboard</SectionEyebrow>
            <SectionHeadline data-ghost-cursor="true">
              Real rhythm. <span className="font-display italic text-accent">Real typos.</span>
            </SectionHeadline>
            <p className="mt-6 max-w-xl text-balance text-base text-muted-strong md:text-lg">
              The cursor isn&rsquo;t the only thing that gives an automation away. HumanJS types at
              the personality&rsquo;s natural pace — with optional typos and the backspace recovery
              a real user would do without thinking.
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
                      layoutId="typing-personality-marker"
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
            <TypingDemo personality={personality} />
          </div>
        </ScrollReveal>
      </Container>
    </Section>
  );
}
