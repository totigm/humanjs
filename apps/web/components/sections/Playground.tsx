'use client';

import type { PresetName } from '@humanjs/core';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { cn } from '../../lib/cn';
import { Sandbox } from '../motion/Sandbox';
import { Container, ScrollReveal, Section, SectionEyebrow, SectionHeadline } from '../primitives';

const personalities: { key: PresetName; label: string; hint: string }[] = [
  { key: 'careful', label: 'careful', hint: 'curved, slow' },
  { key: 'fast', label: 'fast', hint: 'brisk, direct' },
  { key: 'distracted', label: 'distracted', hint: 'wandering' },
  { key: 'precise', label: 'precise', hint: 'surgical' },
];

export function Playground() {
  const [personality, setPersonality] = useState<PresetName>('careful');

  return (
    <Section id="playground" density="default">
      <Container width="lg">
        <ScrollReveal>
          <div className="mb-10 max-w-3xl md:mb-12">
            <SectionEyebrow>Try it</SectionEyebrow>
            <SectionHeadline data-ghost-cursor="true">
              Stop reading.{' '}
              <span className="font-display italic text-accent">Move it yourself.</span>
            </SectionHeadline>
            <p className="mt-6 max-w-xl text-balance text-base text-muted-strong md:text-lg">
              Click anywhere in the box. The cursor draws a real Bezier path to the point you picked
              — exactly the same code that drives{' '}
              <code className="font-mono text-foreground/90">human.click()</code> in tests.
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
                      layoutId="playground-personality-marker"
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
            <Sandbox personality={personality} />
          </div>
        </ScrollReveal>
      </Container>
    </Section>
  );
}
