/**
 * Canonical HumanJS cursor pointer path, drawn at a 16-unit reference size.
 * Single source of truth — every cursor demo imports this so tweaks land in one place.
 */
export const HUMAN_CURSOR_PATH = 'M 0 0 L 16 6 L 8 9.5 L 5 19 Z';

/**
 * The same cursor as a `cursor:` CSS value. Useful when an interactive area
 * wants the OS pointer to *be* the HumanJS cursor instead of an arrow.
 * The hotspot offset (`2 2`) puts the click point at the tip.
 */
export const HUMAN_CURSOR_CSS = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='22' height='24' viewBox='0 0 22 24'><path d='${HUMAN_CURSOR_PATH}' fill='%23f5a55c' stroke='%23020203' stroke-width='0.7' stroke-linejoin='round'/></svg>") 2 2, crosshair`;

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
