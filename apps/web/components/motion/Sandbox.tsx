'use client';

import {
  bezierPath,
  createRng,
  humanizePath,
  type Point,
  type PresetName,
  resolvePersonality,
} from '@humanjs/core';
import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '../../lib/cn';

const VIEW_W = 720;
const VIEW_H = 400;
const RIPPLE_MS = 500;

// Inline HumanJS cursor used as a custom CSS cursor over the playground.
const CURSOR_DATA_URI =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='22' height='24' viewBox='0 0 22 24'><path d='M 0 0 L 16 6 L 8 9.5 L 5 19 Z' fill='%23f5a55c' stroke='%23020203' stroke-width='0.7' stroke-linejoin='round'/></svg>\") 2 2, crosshair";

interface ClickEvent {
  id: number;
  target: Point;
  path: Point[];
  startedAt: number;
  travelMs: number;
}

interface SandboxProps {
  personality?: PresetName;
  className?: string;
}

export function Sandbox({ personality = 'careful', className }: SandboxProps) {
  const shouldReduceMotion = useReducedMotion();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [cursor, setCursor] = useState<Point>({ x: VIEW_W * 0.5, y: VIEW_H * 0.5 });
  const cursorRef = useRef<Point>({ x: VIEW_W * 0.5, y: VIEW_H * 0.5 });
  const [event, setEvent] = useState<ClickEvent | null>(null);
  const [ripple, setRipple] = useState<{ id: number; pos: Point } | null>(null);
  const [interacted, setInteracted] = useState(false);
  const idRef = useRef(0);
  const [trail, setTrail] = useState<{ path: Point[]; progress: number } | null>(null);

  const config = useMemo(() => {
    const profile = resolvePersonality(personality);
    return {
      curvature: profile.mouse.curvature,
      // Scale roughly to viewport distance — clamp so the demo still feels live
      travelMs: Math.min(1700, Math.max(700, profile.mouse.travelTimeMs * 0.6)),
      jitterPercent: profile.mouse.travelTimeJitter,
    };
  }, [personality]);

  useEffect(() => {
    if (!event) return;
    let raf = 0;
    const tick = (now: number) => {
      const elapsed = now - event.startedAt;
      if (elapsed >= event.travelMs) {
        cursorRef.current = event.target;
        setCursor(event.target);
        setRipple({ id: event.id, pos: event.target });
        setTrail(null);
        window.setTimeout(() => setRipple((r) => (r?.id === event.id ? null : r)), RIPPLE_MS);
        setEvent(null);
        return;
      }
      const progress = elapsed / event.travelMs;
      const path = event.path;
      const idx = Math.min(path.length - 1, Math.floor(progress * (path.length - 1)));
      const next = Math.min(path.length - 1, idx + 1);
      const a = path[idx];
      const b = path[next];
      const local = progress * (path.length - 1) - idx;
      if (a && b) {
        const pos = { x: a.x + (b.x - a.x) * local, y: a.y + (b.y - a.y) * local };
        cursorRef.current = pos;
        setCursor(pos);
      }
      setTrail({ path, progress });
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [event]);

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * VIEW_W;
    const y = ((e.clientY - rect.top) / rect.height) * VIEW_H;

    if (shouldReduceMotion) {
      cursorRef.current = { x, y };
      setCursor({ x, y });
      const newRipple = { id: idRef.current++, pos: { x, y } };
      setRipple(newRipple);
      window.setTimeout(() => setRipple((r) => (r?.id === newRipple.id ? null : r)), RIPPLE_MS);
      setInteracted(true);
      return;
    }

    const id = idRef.current++;
    const rng = createRng(`sandbox-${personality}-${id}-${x.toFixed(0)}-${y.toFixed(0)}`);
    const from = { ...cursorRef.current };
    const target = { x, y };
    const raw = bezierPath(from, target, rng, {
      curvature: config.curvature,
      steps: 36,
    });
    const path = humanizePath(raw, rng, { velocityProfile: 1, jitterPx: 0.7 });
    setEvent({ id, target, path, startedAt: performance.now(), travelMs: config.travelMs });
    setInteracted(true);
  };

  const trailPath =
    trail && trail.progress > 0 && trail.progress < 1
      ? (() => {
          const upTo = Math.max(2, Math.floor(trail.progress * trail.path.length));
          return trail.path
            .slice(0, upTo)
            .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
            .join(' ');
        })()
      : null;

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-card-lg border border-hairline bg-surface',
        className,
      )}
    >
      <div className="flex items-center justify-between border-b border-hairline px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">
            playground
          </span>
        </div>
        <span className="font-mono text-[10px] text-muted/70">
          personality: <span className="text-accent">{personality}</span>
        </span>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="block h-auto w-full"
        style={{ cursor: CURSOR_DATA_URI }}
        onClick={handleClick}
        aria-hidden
      >
        <defs>
          <pattern id="sandbox-grid" width="24" height="24" patternUnits="userSpaceOnUse">
            <path
              d="M 24 0 L 0 0 0 24"
              fill="none"
              stroke="rgba(245,230,215,0.04)"
              strokeWidth="1"
            />
          </pattern>
          <radialGradient id="sandbox-vignette">
            <stop offset="0%" stopColor="rgba(245,165,92,0.06)" />
            <stop offset="100%" stopColor="rgba(245,165,92,0)" />
          </radialGradient>
          <linearGradient id="sandbox-trail" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f5a55c" stopOpacity="0" />
            <stop offset="100%" stopColor="#f5a55c" stopOpacity="0.8" />
          </linearGradient>
        </defs>
        <rect width={VIEW_W} height={VIEW_H} fill="url(#sandbox-grid)" />
        <rect width={VIEW_W} height={VIEW_H} fill="url(#sandbox-vignette)" />

        {!interacted && (
          <>
            <HintTarget x={VIEW_W * 0.18} y={VIEW_H * 0.25} label="try here" />
            <HintTarget x={VIEW_W * 0.82} y={VIEW_H * 0.7} label="or here" />
            <HintTarget x={VIEW_W * 0.5} y={VIEW_H * 0.5} label="anywhere" />
          </>
        )}

        {/* Trail behind the cursor */}
        {trailPath && (
          <path
            d={trailPath}
            fill="none"
            stroke="url(#sandbox-trail)"
            strokeWidth="1.75"
            strokeLinecap="round"
            opacity="0.7"
          />
        )}

        {/* Path preview (dashed full path) */}
        {event && (
          <motion.path
            d={event.path
              .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
              .join(' ')}
            fill="none"
            stroke="rgba(245,165,92,0.2)"
            strokeWidth="1"
            strokeLinecap="round"
            strokeDasharray="3 5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
          />
        )}

        {ripple && (
          <circle
            cx={ripple.pos.x}
            cy={ripple.pos.y}
            r={30}
            fill="none"
            stroke="#f5a55c"
            strokeWidth="1.5"
            opacity="0.5"
          >
            <animate attributeName="r" from="8" to="44" dur="0.5s" repeatCount="1" />
            <animate attributeName="opacity" from="0.7" to="0" dur="0.5s" repeatCount="1" />
          </circle>
        )}

        <g style={{ transform: `translate(${cursor.x}px, ${cursor.y}px)` }}>
          <path
            d="M 0 0 L 15 5 L 7 9 L 5 18 Z"
            fill="#f5a55c"
            stroke="#020203"
            strokeWidth="0.6"
            strokeLinejoin="round"
          />
        </g>
      </svg>

      <div className="flex items-center justify-between border-t border-hairline px-4 py-2.5 font-mono text-[10px]">
        <code className="text-foreground/80">
          <span className="text-muted">{`await human.click(`}</span>
          <span className="text-accent">
            {`{ x: ${cursor.x.toFixed(0)}, y: ${cursor.y.toFixed(0)} }`}
          </span>
          <span className="text-muted">);</span>
        </code>
        <button
          type="button"
          onClick={() => {
            const rect = svgRef.current?.getBoundingClientRect();
            handleClick({
              clientX: (rect?.left ?? 0) + (rect?.width ?? VIEW_W) * Math.random(),
              clientY: (rect?.top ?? 0) + (rect?.height ?? VIEW_H) * Math.random(),
            } as unknown as React.MouseEvent<SVGSVGElement>);
          }}
          className="rounded-md px-2 py-1 text-muted/70 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {event ? 'traveling…' : interacted ? 'random click ↻' : 'random click'}
        </button>
      </div>
    </div>
  );
}

function HintTarget({ x, y, label }: { x: number; y: number; label: string }) {
  return (
    <g aria-hidden>
      <circle
        cx={x}
        cy={y}
        r="14"
        fill="none"
        stroke="rgba(245,165,92,0.3)"
        strokeWidth="1"
        strokeDasharray="3 3"
      >
        <animate attributeName="r" values="14;18;14" dur="2.6s" repeatCount="indefinite" />
      </circle>
      <circle cx={x} cy={y} r="2.5" fill="#f5a55c" opacity="0.5" />
      <text
        x={x}
        y={y + 30}
        fontSize="9"
        fontFamily="var(--font-mono)"
        fill="rgba(245,165,92,0.55)"
        textAnchor="middle"
      >
        {label}
      </text>
    </g>
  );
}
