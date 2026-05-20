'use client';

import { careful, type Point } from '@humanjs/core';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { EASE_EXPO } from '../../lib/motion';
import { makeHumanizedPath, pointAt } from '../../lib/path';
import { useHumanCursor } from './HumanCursorProvider';

const TRAVEL_MS = 950;
const DWELL_MS = 700;
const COOLDOWN_MS = 2200;

interface Ghost {
  id: number;
  startPos: Point;
  targetPos: Point;
}

/**
 * Spawns a small ghost cursor that flies in via a real HumanJS-powered
 * Bezier path toward any element marked with `data-ghost-cursor`.
 * Acts as a hands-off demo of the library.
 *
 * Suppressed when:
 * - prefers-reduced-motion
 * - the site-wide HumanCursor toggle is on (avoid double amber)
 * - the device is touch-only
 */
export function HoverGhostCursor() {
  const shouldReduceMotion = useReducedMotion();
  const { enabled: humanCursorEnabled } = useHumanCursor();
  const [ghost, setGhost] = useState<Ghost | null>(null);
  const lastTriggerRef = useRef(0);

  useEffect(() => {
    if (shouldReduceMotion || humanCursorEnabled) return;
    if (typeof window === 'undefined') return;
    if (!window.matchMedia('(pointer: fine)').matches) return;

    const handleOver = (event: MouseEvent) => {
      const path = event.composedPath();
      const target = path.find(
        (node): node is HTMLElement =>
          node instanceof HTMLElement && node.hasAttribute('data-ghost-cursor'),
      );
      if (!target) return;

      const now = performance.now();
      if (now - lastTriggerRef.current < COOLDOWN_MS) return;
      lastTriggerRef.current = now;

      const rect = target.getBoundingClientRect();
      const targetPos: Point = {
        x: rect.left + 24,
        y: rect.top + rect.height / 2,
      };

      // Spawn from the corner farthest from the target so the ghost
      // has visible distance to travel.
      const fromLeft = targetPos.x > window.innerWidth / 2;
      const fromTop = targetPos.y > window.innerHeight / 2;
      const startPos: Point = {
        x: fromLeft ? Math.max(60, window.innerWidth * 0.08) : window.innerWidth - 60,
        y: fromTop ? Math.max(80, window.innerHeight * 0.12) : window.innerHeight - 60,
      };

      setGhost({ id: now, startPos, targetPos });
    };

    document.addEventListener('mouseover', handleOver);
    return () => document.removeEventListener('mouseover', handleOver);
  }, [shouldReduceMotion, humanCursorEnabled]);

  return (
    <AnimatePresence>
      {ghost && <GhostCursor key={ghost.id} ghost={ghost} onComplete={() => setGhost(null)} />}
    </AnimatePresence>
  );
}

function GhostCursor({ ghost, onComplete }: { ghost: Ghost; onComplete: () => void }) {
  const [pos, setPos] = useState<Point>(ghost.startPos);

  useEffect(() => {
    const path = makeHumanizedPath(ghost.startPos, ghost.targetPos, `ghost-${ghost.id}`, {
      curvature: careful.mouse.curvature * 1.4,
      steps: 36,
      jitterPx: 0.6,
    });
    const start = performance.now();
    let raf = 0;
    let dwellTimer = 0;

    const tick = (now: number) => {
      const elapsed = now - start;
      if (elapsed >= TRAVEL_MS) {
        setPos(ghost.targetPos);
        dwellTimer = window.setTimeout(onComplete, DWELL_MS);
        return;
      }
      setPos(pointAt(path, elapsed / TRAVEL_MS));
      raf = window.requestAnimationFrame(tick);
    };

    raf = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(raf);
      if (dwellTimer) window.clearTimeout(dwellTimer);
    };
  }, [ghost, onComplete]);

  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`,
        pointerEvents: 'none',
        zIndex: 60,
        willChange: 'transform',
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.6 }}
        transition={{ duration: 0.25, ease: EASE_EXPO }}
        style={{ transformOrigin: '0 0' }}
      >
        <svg width="22" height="24" viewBox="0 0 22 24" aria-hidden>
          <path
            d="M 0 0 L 16 6 L 8 9.5 L 5 19 Z"
            fill="#f5a55c"
            stroke="#020203"
            strokeWidth="0.7"
            strokeLinejoin="round"
          />
        </svg>
        <span
          className="absolute left-6 top-7 whitespace-nowrap rounded-full border border-accent/30 bg-canvas/90 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-accent backdrop-blur"
          aria-hidden
        >
          humanjs
        </span>
      </motion.div>
    </div>
  );
}
