'use client';

import type { Point } from '@humanjs/core';
import { useReducedMotion } from 'framer-motion';
import { useEffect, useId, useRef, useState } from 'react';
import { makeHumanizedPath, pointAt, toSvgPathD } from '../../lib/path';
import { HUMAN_CURSOR_CSS, HumanCursorIcon } from './HumanCursorIcon';

const VIEW_W = 1000;
const VIEW_H = 800;
const START_POINT: Point = { x: 80, y: 110 };
const INITIAL_END: Point = { x: 540, y: 620 };
const INTRO_DURATION_MS = 1900;
const CLICK_DURATION_MS = 1300;

interface MovementEvent {
  id: number;
  target: Point;
  path: readonly Point[];
  startedAt: number;
  durationMs: number;
}

/**
 * 404-page background. A real humanized cursor flies in via Bezier on mount,
 * lands in an empty target. After that, clicking anywhere on the page sends
 * the cursor there via a fresh humanized path — same interactive feel as the
 * landing's playground, just without the chrome. The brand metaphor lives in
 * the empty target: "real path, no target at the end."
 *
 * The svg fills the surrounding container and uses `slice` so its grid
 * pattern always covers the full viewport regardless of aspect ratio.
 */
export function LostCursor() {
  const shouldReduceMotion = useReducedMotion();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const cursorGroupRef = useRef<SVGGElement | null>(null);
  const trailRef = useRef<SVGPathElement | null>(null);
  const cursorPos = useRef<Point>({ ...START_POINT });
  const idRef = useRef(0);

  const [event, setEvent] = useState<MovementEvent | null>(null);

  const reactId = useId();
  const gridId = `lost-grid-${reactId}`;
  const trailGradId = `lost-trail-${reactId}`;

  // Intro: cursor flies in from the upper-left to the empty target. For
  // reduced-motion users, we snap to the endpoint with no animation.
  useEffect(() => {
    if (shouldReduceMotion) {
      cursorPos.current = { ...INITIAL_END };
      cursorGroupRef.current?.setAttribute(
        'transform',
        `translate(${INITIAL_END.x}, ${INITIAL_END.y})`,
      );
      return;
    }
    const introPath = makeHumanizedPath(START_POINT, INITIAL_END, '404-intro', {
      curvature: 0.5,
      steps: 52,
      jitterPx: 0.5,
    });
    cursorPos.current = { ...START_POINT };
    cursorGroupRef.current?.setAttribute(
      'transform',
      `translate(${START_POINT.x}, ${START_POINT.y})`,
    );
    setEvent({
      id: idRef.current++,
      target: INITIAL_END,
      path: introPath,
      startedAt: performance.now(),
      durationMs: INTRO_DURATION_MS,
    });
  }, [shouldReduceMotion]);

  // RAF driver — runs whenever there's an active travel event (intro or click).
  // A new click during travel replaces the event, generating a fresh path from
  // the cursor's current position so the change-of-mind feels continuous.
  useEffect(() => {
    if (!event) return;
    let raf = 0;
    const tick = (now: number) => {
      const elapsed = now - event.startedAt;
      if (elapsed >= event.durationMs) {
        cursorPos.current = { ...event.target };
        cursorGroupRef.current?.setAttribute(
          'transform',
          `translate(${event.target.x.toFixed(2)}, ${event.target.y.toFixed(2)})`,
        );
        if (trailRef.current) trailRef.current.setAttribute('d', '');
        setEvent(null);
        return;
      }
      const t = elapsed / event.durationMs;
      const p = pointAt(event.path, t);
      cursorPos.current = p;
      cursorGroupRef.current?.setAttribute(
        'transform',
        `translate(${p.x.toFixed(2)}, ${p.y.toFixed(2)})`,
      );
      if (trailRef.current) {
        const upTo = Math.floor(t * event.path.length);
        trailRef.current.setAttribute('d', toSvgPathD(event.path, upTo));
      }
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [event]);

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;

    // Map screen-space click to viewBox-space, accounting for slice scaling.
    const rect = svg.getBoundingClientRect();
    const scale = Math.max(rect.width / VIEW_W, rect.height / VIEW_H);
    const offsetX = (rect.width - VIEW_W * scale) / 2;
    const offsetY = (rect.height - VIEW_H * scale) / 2;
    const target: Point = {
      x: (e.clientX - rect.left - offsetX) / scale,
      y: (e.clientY - rect.top - offsetY) / scale,
    };

    if (shouldReduceMotion) {
      cursorPos.current = target;
      cursorGroupRef.current?.setAttribute(
        'transform',
        `translate(${target.x.toFixed(2)}, ${target.y.toFixed(2)})`,
      );
      return;
    }

    const id = idRef.current++;
    const path = makeHumanizedPath({ ...cursorPos.current }, target, `lost-click-${id}`, {
      curvature: 0.45,
      steps: 36,
      jitterPx: 0.6,
    });
    setEvent({
      id,
      target,
      path,
      startedAt: performance.now(),
      durationMs: CLICK_DURATION_MS,
    });
  };

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 h-full w-full"
      style={{ cursor: HUMAN_CURSOR_CSS }}
      onClick={handleClick}
      aria-hidden
    >
      <defs>
        <pattern id={gridId} width="28" height="28" patternUnits="userSpaceOnUse">
          <path d="M 28 0 L 0 0 0 28" fill="none" stroke="rgba(245,230,215,0.03)" strokeWidth="1" />
        </pattern>
        <linearGradient id={trailGradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f5a55c" stopOpacity="0" />
          <stop offset="100%" stopColor="#f5a55c" stopOpacity="0.7" />
        </linearGradient>
      </defs>

      <rect width={VIEW_W} height={VIEW_H} fill={`url(#${gridId})`} />

      {/* Empty target — a faint dashed circle marks the cursor's intro destination,
          and stays as decoration even after the user starts steering it themselves. */}
      <circle
        cx={INITIAL_END.x}
        cy={INITIAL_END.y}
        r={42}
        fill="none"
        stroke="rgba(245,165,92,0.5)"
        strokeWidth="1"
        strokeDasharray="3 5"
      />

      {/* Trail behind the cursor — mutated imperatively during travel. */}
      <path
        ref={trailRef}
        d=""
        fill="none"
        stroke={`url(#${trailGradId})`}
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.75"
      />

      {/* The cursor — initial JSX position is the intro's start; RAF takes over from there. */}
      <g ref={cursorGroupRef} transform={`translate(${START_POINT.x}, ${START_POINT.y})`}>
        <HumanCursorIcon size={16} />
      </g>
    </svg>
  );
}
