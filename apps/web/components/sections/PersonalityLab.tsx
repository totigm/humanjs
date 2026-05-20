'use client';

import {
  bezierPath,
  careful,
  createRng,
  distracted,
  fast,
  humanizePath,
  type PresetName,
  precise,
} from '@humanjs/core';
import { AnimatePresence, motion } from 'framer-motion';
import { RotateCcw } from 'lucide-react';
import { useMemo, useState } from 'react';
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

interface Overrides {
  curvature?: number;
  jitterPx?: number;
}

export function PersonalityLab() {
  const [active, setActive] = useState<PresetName>('careful');
  const [overrides, setOverrides] = useState<Overrides>({});

  const preset = presets.find((p) => p.key === active) ?? presets[0];
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
              {presets.map((p) => (
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
                  key={`${active}-${effectiveCurvature}-${effectiveJitter}`}
                  personality={active}
                  overrides={{ curvature: effectiveCurvature, jitterPx: effectiveJitter }}
                />
              </div>

              <motion.div
                key={active}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
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

                <pre className="overflow-x-auto rounded-card border border-hairline bg-canvas p-4 font-mono text-[11px] leading-relaxed text-foreground/90">
                  <span className="text-muted">{`{ `}</span>
                  <span className="block pl-2">
                    {`personality: `}
                    <span className="text-accent">{`'${preset.key}'`}</span>
                    {','}
                  </span>
                  <AnimatePresence initial={false}>
                    {dirty && (
                      <motion.span
                        key="mouse-override"
                        initial={{ opacity: 0, height: 0, y: -4 }}
                        animate={{ opacity: 1, height: 'auto', y: 0 }}
                        exit={{ opacity: 0, height: 0, y: -4 }}
                        transition={{
                          duration: 0.32,
                          ease: [0.16, 1, 0.3, 1],
                          opacity: { duration: 0.24 },
                        }}
                        className="block overflow-hidden pl-2"
                      >
                        {`mouse: { `}
                        <motion.span
                          key={`curv-${effectiveCurvature.toFixed(2)}`}
                          initial={{ opacity: 0.4 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.18 }}
                          className="text-accent"
                        >
                          {`curvature: ${effectiveCurvature.toFixed(2)}`}
                        </motion.span>
                        {`, `}
                        <motion.span
                          key={`jit-${effectiveJitter.toFixed(1)}`}
                          initial={{ opacity: 0.4 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.18 }}
                          className="text-accent"
                        >
                          {`jitterPx: ${effectiveJitter.toFixed(1)}`}
                        </motion.span>
                        {` },`}
                      </motion.span>
                    )}
                  </AnimatePresence>
                  <span className="text-muted">{`}`}</span>
                </pre>
              </motion.div>
            </div>
          </div>
        </ScrollReveal>
      </Container>
    </Section>
  );
}

interface PersonalityTabProps {
  preset: PersonalityMeta;
  active: boolean;
  onSelect: () => void;
}

function PersonalityTab({ preset, active, onSelect }: PersonalityTabProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onSelect}
      className={cn(
        'group relative flex flex-col items-start gap-2 border-r border-hairline px-4 py-4 text-left transition-colors duration-200 last:border-r-0 outline-none focus-visible:bg-surface-elevated focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent',
        active ? 'bg-surface-elevated' : 'hover:bg-surface-elevated/50',
      )}
    >
      {active && (
        <motion.span
          layoutId="active-personality-marker"
          className="absolute inset-x-0 top-0 h-px bg-accent"
          transition={{ type: 'spring', bounce: 0.18, duration: 0.45 }}
        />
      )}
      <TrajectoryThumbnail personality={preset.key} active={active} />
      <span
        className={cn(
          'font-mono text-[11px] uppercase tracking-[0.18em] transition-colors',
          active ? 'text-accent' : 'text-muted group-hover:text-foreground',
        )}
      >
        {preset.key}
      </span>
    </button>
  );
}

function TrajectoryThumbnail({
  personality,
  active,
}: {
  personality: PresetName;
  active: boolean;
}) {
  const d = useMemo(() => {
    const rng = createRng(`thumb-${personality}`);
    const preset = presets.find((p) => p.key === personality);
    if (!preset) return '';
    const raw = bezierPath({ x: 6, y: 26 }, { x: 74, y: 6 }, rng, {
      curvature: preset.curvature,
      steps: 24,
    });
    const path = humanizePath(raw, rng, { velocityProfile: 1, jitterPx: 0.4 });
    return path
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
      .join(' ');
  }, [personality]);

  return (
    <svg width="80" height="32" viewBox="0 0 80 32" aria-hidden>
      <line x1="6" y1="26" x2="74" y2="6" stroke="rgba(245,230,215,0.08)" strokeDasharray="2 3" />
      <path
        d={d}
        fill="none"
        stroke={active ? '#f5a55c' : 'rgba(138, 133, 124, 0.6)'}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="6" cy="26" r="1.5" fill={active ? '#f5a55c' : 'rgba(138, 133, 124, 0.6)'} />
      <circle cx="74" cy="6" r="2" fill={active ? '#f5a55c' : 'rgba(138, 133, 124, 0.8)'} />
    </svg>
  );
}

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (value: number) => void;
}

function Slider({ label, value, min, max, step, format, onChange }: SliderProps) {
  return (
    <label className="block">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">
          {label}
        </span>
        <span className="font-mono text-xs tabular-nums text-foreground">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="block w-full appearance-none bg-transparent outline-none [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-accent [&::-moz-range-thumb]:shadow-[0_0_0_3px_rgba(245,165,92,0.18)] [&::-moz-range-track]:h-1 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-hairline-strong [&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-hairline-strong [&::-webkit-slider-thumb]:mt-[-6px] [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:shadow-[0_0_0_3px_rgba(245,165,92,0.18)] focus-visible:[&::-webkit-slider-thumb]:ring-2 focus-visible:[&::-webkit-slider-thumb]:ring-accent"
      />
    </label>
  );
}
