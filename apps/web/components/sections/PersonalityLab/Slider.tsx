'use client';

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (value: number) => void;
}

export function Slider({ label, value, min, max, step, format, onChange }: SliderProps) {
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
        className="range-slider"
      />
    </label>
  );
}
