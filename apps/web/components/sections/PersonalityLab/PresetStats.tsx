'use client';

import type { PersonalityMeta } from './presets';

interface PresetStatsProps {
  preset: PersonalityMeta;
}

/**
 * Three live values from the active `@humanjs/core` preset.
 * Values come from `careful`/`fast`/`distracted`/`precise` in the library —
 * if those change, this row reflects it without a code edit here.
 */
export function PresetStats({ preset }: PresetStatsProps) {
  return (
    <dl className="grid grid-cols-3 gap-2">
      <Stat label="travel" value={`${preset.travelMs}ms`} sub="per 1000px" />
      <Stat label="curvature" value={preset.curvature.toFixed(2)} sub="0 – 1" />
      <Stat label="jitter" value={`±${Math.round(preset.travelJitter * 100)}%`} sub="of travel" />
    </dl>
  );
}

interface StatProps {
  label: string;
  value: string;
  sub: string;
}

function Stat({ label, value, sub }: StatProps) {
  return (
    <div className="rounded-card border border-hairline bg-canvas/40 px-3 py-2.5">
      <dt className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted">{label}</dt>
      <dd className="mt-1 font-mono text-sm tabular-nums text-foreground">{value}</dd>
      <dd className="font-mono text-[9px] text-muted/80">{sub}</dd>
    </div>
  );
}
