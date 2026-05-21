'use client';

import { type Point, type PresetName, resolvePersonality } from '@humanjs/core';
import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { cn } from '../../lib/cn';
import { makeHumanizedPath, pointAt, toSvgPathD } from '../../lib/path';
import { DemoStatusBar } from './DemoStatusBar';
import { HUMAN_CURSOR_PATH, HumanCursorIcon } from './HumanCursorIcon';

const VIEW_W = 720;
const VIEW_H = 400;
const RIPPLE_MS = 500;
const INITIAL_CURSOR: Point = { x: VIEW_W * 0.5, y: VIEW_H * 0.5 };

// HumanJS cursor as a CSS custom-pointer data URI. Re-uses the canonical
// path; this is the one place where the path lives inside a string instead
// of JSX, so the duplication of literal coords is intentional.
const CURSOR_DATA_URI = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='22' height='24' viewBox='0 0 22 24'><path d='${HUMAN_CURSOR_PATH}' fill='%23f5a55c' stroke='%23020203' stroke-width='0.7' stroke-linejoin='round'/></svg>") 2 2, crosshair`;

interface ClickEvent {
  id: number;
  target: Point;
  path: readonly Point[];
  startedAt: number;
  travelMs: number;
}

interface SandboxProps {
  personality?: PresetName;
  className?: string;
}

/**
 * Interactive playground. The user clicks anywhere → cursor draws a real
 * humanized Bezier path to that point. Cursor + trail are mutated
 * imperatively in the RAF loop; React only re-renders on discrete events
 * (click start, ripple show/hide, first interaction).
 */
export function Sandbox({ personality = 'careful', className }: SandboxProps) {
  const shouldReduceMotion = useReducedMotion();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const cursorGroupRef = useRef<SVGGElement | null>(null);
  const trailRef = useRef<SVGPathElement | null>(null);
  const codeRef = useRef<HTMLSpanElement | null>(null);

  // The cursor's authoritative position lives here, not in state.
  const cursorRef = useRef<Point>({ ...INITIAL_CURSOR });

  const [event, setEvent] = useState<ClickEvent | null>(null);
  const [ripple, setRipple] = useState<{ id: number; pos: Point } | null>(null);
  const [interacted, setInteracted] = useState(false);
  const idRef = useRef(0);
  const rippleTimerRef = useRef<number | null>(null);

  const reactId = useId();
  const gridId = `sb-grid-${reactId}`;
  const vignetteId = `sb-vignette-${reactId}`;
  const trailGradId = `sb-trail-${reactId}`;

  const config = useMemo(() => {
    const profile = resolvePersonality(personality);
    return {
      curvature: profile.mouse.curvature,
      // Scale roughly to viewport distance — clamp so the demo still feels live.
      travelMs: Math.min(1700, Math.max(700, profile.mouse.travelTimeMs * 0.6)),
    };
  }, [personality]);

  // RAF driver — animates the cursor along the active event's path.
  // No companion "sync" effect needed: the JSX renders INITIAL_CURSOR on mount,
  // the RAF updates the DOM during travel, and on completion writes the final
  // target — which persists in the DOM until the next event starts.
  useEffect(() => {
    if (!event) return;
    let raf = 0;

    const tick = (now: number) => {
      const elapsed = now - event.startedAt;

      if (elapsed >= event.travelMs) {
        cursorRef.current = event.target;
        if (cursorGroupRef.current) {
          cursorGroupRef.current.setAttribute(
            'transform',
            `translate(${event.target.x.toFixed(2)}, ${event.target.y.toFixed(2)})`,
          );
        }
        if (trailRef.current) trailRef.current.setAttribute('d', '');
        if (codeRef.current) {
          codeRef.current.textContent = `{ x: ${event.target.x.toFixed(0)}, y: ${event.target.y.toFixed(0)} }`;
        }
        setRipple({ id: event.id, pos: event.target });
        rippleTimerRef.current = window.setTimeout(() => {
          setRipple((r) => (r?.id === event.id ? null : r));
          rippleTimerRef.current = null;
        }, RIPPLE_MS);
        setEvent(null);
        return;
      }

      const progress = elapsed / event.travelMs;
      const p = pointAt(event.path, progress);
      cursorRef.current = p;
      if (cursorGroupRef.current) {
        cursorGroupRef.current.setAttribute(
          'transform',
          `translate(${p.x.toFixed(2)}, ${p.y.toFixed(2)})`,
        );
      }
      if (codeRef.current) {
        codeRef.current.textContent = `{ x: ${p.x.toFixed(0)}, y: ${p.y.toFixed(0)} }`;
      }
      if (trailRef.current) {
        const upTo = Math.floor(progress * event.path.length);
        trailRef.current.setAttribute('d', toSvgPathD(event.path, upTo));
      }

      raf = window.requestAnimationFrame(tick);
    };

    raf = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(raf);
    };
  }, [event]);

  // Cancel pending ripple timer on unmount.
  useEffect(() => {
    return () => {
      if (rippleTimerRef.current !== null) {
        window.clearTimeout(rippleTimerRef.current);
        rippleTimerRef.current = null;
      }
    };
  }, []);

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * VIEW_W;
    const y = ((e.clientY - rect.top) / rect.height) * VIEW_H;
    sendCursorTo({ x, y });
  };

  const sendRandomClick = () => {
    sendCursorTo({
      x: VIEW_W * (0.1 + Math.random() * 0.8),
      y: VIEW_H * (0.15 + Math.random() * 0.7),
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      sendRandomClick();
    }
  };

  /**
   * Drive the cursor to a target point in viewBox space, generating a fresh
   * humanized path. Used by both the click handler and the "random click"
   * button — keeping a single code path avoids synthesizing fake MouseEvents.
   */
  const sendCursorTo = (target: Point) => {
    setInteracted(true);

    if (shouldReduceMotion) {
      cursorRef.current = target;
      if (cursorGroupRef.current) {
        cursorGroupRef.current.setAttribute(
          'transform',
          `translate(${target.x.toFixed(2)}, ${target.y.toFixed(2)})`,
        );
      }
      if (codeRef.current) {
        codeRef.current.textContent = `{ x: ${target.x.toFixed(0)}, y: ${target.y.toFixed(0)} }`;
      }
      const newRipple = { id: idRef.current++, pos: target };
      setRipple(newRipple);
      // Track the handle on the shared ref so the unmount cleanup clears it,
      // matching the RAF-branch behavior and avoiding setState-after-unmount.
      if (rippleTimerRef.current !== null) window.clearTimeout(rippleTimerRef.current);
      rippleTimerRef.current = window.setTimeout(() => {
        setRipple((r) => (r?.id === newRipple.id ? null : r));
        rippleTimerRef.current = null;
      }, RIPPLE_MS);
      return;
    }

    const id = idRef.current++;
    const seed = `sandbox-${personality}-${id}-${target.x.toFixed(0)}-${target.y.toFixed(0)}`;
    const path = makeHumanizedPath({ ...cursorRef.current }, target, seed, {
      curvature: config.curvature,
      steps: 36,
      jitterPx: 0.7,
    });
    setEvent({ id, target, path, startedAt: performance.now(), travelMs: config.travelMs });
  };

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-card-lg border border-hairline bg-surface',
        className,
      )}
    >
      <DemoStatusBar
        label="playground"
        sublabel={
          <>
            personality: <span className="text-accent">{personality}</span>
          </>
        }
      />

      {/*
        The interactive role lives on this wrapper div, not the svg, because
        svg is a non-interactive element per the WAI-ARIA spec. The svg itself
        is decorative — the wrapper is what screen readers see as a button,
        what receives focus, and what handles keyboard activation.
      */}
      {/* biome-ignore lint/a11y/useSemanticElements: a real <button> can't wrap an svg of arbitrary size that responds to pointer position; click coordinates are essential for this widget */}
      <div
        role="button"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        aria-label="Click anywhere to send a humanized cursor to that point. Press Enter or Space to send the cursor to a random position."
        className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="block h-auto w-full"
          style={{ cursor: CURSOR_DATA_URI }}
          onClick={handleClick}
          aria-hidden
        >
          <defs>
            <pattern id={gridId} width="24" height="24" patternUnits="userSpaceOnUse">
              <path
                d="M 24 0 L 0 0 0 24"
                fill="none"
                stroke="rgba(245,230,215,0.04)"
                strokeWidth="1"
              />
            </pattern>
            <radialGradient id={vignetteId}>
              <stop offset="0%" stopColor="rgba(245,165,92,0.06)" />
              <stop offset="100%" stopColor="rgba(245,165,92,0)" />
            </radialGradient>
            <linearGradient id={trailGradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f5a55c" stopOpacity="0" />
              <stop offset="100%" stopColor="#f5a55c" stopOpacity="0.8" />
            </linearGradient>
          </defs>
          <rect width={VIEW_W} height={VIEW_H} fill={`url(#${gridId})`} />
          <rect width={VIEW_W} height={VIEW_H} fill={`url(#${vignetteId})`} />

          {!interacted && (
            <>
              <HintTarget x={VIEW_W * 0.18} y={VIEW_H * 0.25} label="try here" />
              <HintTarget x={VIEW_W * 0.82} y={VIEW_H * 0.7} label="or here" />
              <HintTarget x={VIEW_W * 0.5} y={VIEW_H * 0.5} label="anywhere" />
            </>
          )}

          {/* Trail behind the cursor — mutated imperatively. */}
          <path
            ref={trailRef}
            d=""
            fill="none"
            stroke={`url(#${trailGradId})`}
            strokeWidth="1.75"
            strokeLinecap="round"
            opacity="0.7"
          />

          {/* Dashed full-path preview only while a travel event is active. */}
          {event && (
            <motion.path
              d={toSvgPathD(event.path)}
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

          <g ref={cursorGroupRef} transform={`translate(${INITIAL_CURSOR.x}, ${INITIAL_CURSOR.y})`}>
            <HumanCursorIcon size={15} />
          </g>
        </svg>
      </div>

      <div className="flex items-center justify-between border-t border-hairline px-4 py-2.5 font-mono text-[10px]">
        {/* Coordinates update ~60×/sec via imperative DOM mutation — would
            spam screen readers if announced, so we hide from SR. */}
        <code className="text-foreground/80" aria-hidden>
          <span className="text-muted">{`await human.click(`}</span>
          <span ref={codeRef} className="text-accent">
            {`{ x: ${INITIAL_CURSOR.x.toFixed(0)}, y: ${INITIAL_CURSOR.y.toFixed(0)} }`}
          </span>
          <span className="text-muted">);</span>
        </code>
        <button
          type="button"
          onClick={sendRandomClick}
          aria-label="Send a humanized cursor to a random position in the playground"
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
