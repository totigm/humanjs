/**
 * Canonical HumanJS cursor pointer path, drawn at a 16-unit reference size.
 * Single source of truth — every cursor demo imports this so tweaks land in one place.
 */
export const HUMAN_CURSOR_PATH = 'M 0 0 L 16 6 L 8 9.5 L 5 19 Z';

interface HumanCursorIconProps {
  /** Visual width in the parent SVG's coordinate units. Defaults to 16 (no scale). */
  size?: number;
  fill?: string;
  stroke?: string;
  /** Visual stroke width. Stays constant under `size` thanks to `vector-effect`. */
  strokeWidth?: number;
}

export function HumanCursorIcon({
  size = 16,
  fill = '#f5a55c',
  stroke = '#020203',
  strokeWidth = 0.6,
}: HumanCursorIconProps) {
  const scale = size / 16;
  return (
    <path
      d={HUMAN_CURSOR_PATH}
      transform={scale === 1 ? undefined : `scale(${scale})`}
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinejoin="round"
      vectorEffect="non-scaling-stroke"
    />
  );
}
