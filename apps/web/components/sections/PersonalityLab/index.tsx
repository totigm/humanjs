'use client';

import type { PresetName } from '@humanjs/core';
import { motion } from 'framer-motion';
import { RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { EASE_EXPO } from '../../../lib/motion';
import { PersonalityCursor } from '../../motion/PersonalityCursor';
import { Container, ScrollReveal, Section } from '../../primitives';
import { ConfigSnippet } from './ConfigSnippet';
import { PersonalityTab } from './PersonalityTab';
import { PresetStats } from './PresetStats';
import { personalityPresets } from './presets';
import { Slider } from './Slider';

interface Overrides {
  curvature?: number;
  jitterPx?: number;
}

export function PersonalityLab() {
  const [active, setActive] = useState<PresetName>('careful');
  const [overrides, setOverrides] = useState<Overrides>({});

  const preset = personalityPresets.find((p) => p.key === active) ?? personalityPresets[0];
  if (!preset) return null;

  const effectiveCurvature = overrides.curvature ?? preset.curvature;
  const effectiveJitter = overrides.jitterPx ?? 0.7;
  const dirty = overrides.curvature !== undefined || overrides.jitterPx !== undefined;

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
              <span className="font-display italic text-accent">Mess with them.</span>
            </h2>
            <p className="mt-6 max-w-xl text-balance text-base text-muted-strong md:text-lg">
              Personalities are pure data. Pick one, drag the sliders, watch the cursor change live.
              Then ship that config as a preset of your own.
            </p>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={0.1}>
          <div className="overflow-hidden rounded-card-lg border border-hairline bg-surface/50">
            <div
              role="tablist"
              aria-label="Personality picker"
              className="grid grid-cols-2 gap-0 border-b border-hairline sm:grid-cols-4"
            >
              {personalityPresets.map((p) => (
                <PersonalityTab
                  key={p.key}
                  preset={p}
                  active={p.key === active}
                  onSelect={() => {
                    setActive(p.key);
                    setOverrides({});
                  }}
                />
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5">
              <div className="border-b border-hairline p-5 md:p-6 lg:col-span-3 lg:border-b-0 lg:border-r">
                <PersonalityCursor
                  personality={active}
                  overrides={{ curvature: effectiveCurvature, jitterPx: effectiveJitter }}
                />
              </div>

              <motion.div
                key={active}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: EASE_EXPO }}
                className="flex flex-col gap-6 p-5 md:p-6 lg:col-span-2"
              >
                <div>
                  <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">
                    {preset.key}
                  </p>
                  <p className="mt-3 font-display text-2xl italic leading-tight tracking-tight text-foreground md:text-3xl">
                    {preset.tagline}
                  </p>
                  <p className="mt-3 text-sm text-muted-strong">{preset.description}</p>
                </div>

                <div className="space-y-2">
                  <PresetStats preset={preset} />
                  <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted/50">
                    live from <span className="text-muted">@humanjs/core</span>
                  </p>
                </div>

                <div className="space-y-4 border-t border-hairline pt-5">
                  <div className="flex items-center justify-between">
                    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted/70">
                      Live overrides
                    </p>
                    {dirty && (
                      <button
                        type="button"
                        onClick={() => setOverrides({})}
                        className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.15em] text-muted transition-colors hover:text-foreground"
                      >
                        <RotateCcw className="h-3 w-3" />
                        reset
                      </button>
                    )}
                  </div>

                  <Slider
                    label="Curvature"
                    value={effectiveCurvature}
                    min={0}
                    max={1}
                    step={0.05}
                    format={(v) => v.toFixed(2)}
                    onChange={(v) => setOverrides((o) => ({ ...o, curvature: v }))}
                  />

                  <Slider
                    label="Jitter (px)"
                    value={effectiveJitter}
                    min={0}
                    max={2}
                    step={0.1}
                    format={(v) => v.toFixed(1)}
                    onChange={(v) => setOverrides((o) => ({ ...o, jitterPx: v }))}
                  />
                </div>

                <ConfigSnippet
                  personality={preset.key}
                  curvature={effectiveCurvature}
                  jitterPx={effectiveJitter}
                  dirty={dirty}
                />
              </motion.div>
            </div>
          </div>
        </ScrollReveal>
      </Container>
    </Section>
  );
}
