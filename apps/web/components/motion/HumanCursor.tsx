'use client';

import { createRng } from '@humanjs/core';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { EASE_EXPO } from '../../lib/motion';
import { useHumanCursor } from './HumanCursorProvider';

const SMOOTHING = 0.24;
const JITTER_REFRESH_FRAMES = 7;
const JITTER_STD_DEV = 0.3;
const TRAIL_LIFETIME_MS = 650;
const TRAIL_MIN_DISTANCE_PX = 4;

export function HumanCursor() {
  const { enabled } = useHumanCursor();
  const cursorRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    let raf = 0;
    let frame = 0;
    const target = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const current = { x: target.x, y: target.y };
    const jitter = { x: 0, y: 0 };
    const trail: { x: number; y: number; t: number }[] = [];
    const rng = createRng('humanjs-site-cursor');
    let hasMoved = false;

    const onMove = (e: MouseEvent) => {
      target.x = e.clientX;
      target.y = e.clientY;
      if (!hasMoved) {
        current.x = target.x;
        current.y = target.y;
        hasMoved = true;
        setVisible(true);
      }
    };
    const onLeave = () => setVisible(false);
    const onEnter = () => setVisible(true);

    const tick = (now: number) => {
      const dx = target.x - current.x;
      const dy = target.y - current.y;
      current.x += dx * SMOOTHING;
      current.y += dy * SMOOTHING;

      frame++;
      if (frame % JITTER_REFRESH_FRAMES === 0) {
        jitter.x = rng.nextGaussian(0, JITTER_STD_DEV);
        jitter.y = rng.nextGaussian(0, JITTER_STD_DEV);
      }

      const renderX = current.x + jitter.x;
      const renderY = current.y + jitter.y;

      const last = trail[trail.length - 1];
      const distMoved = last ? Math.hypot(renderX - last.x, renderY - last.y) : Infinity;
      if (distMoved > TRAIL_MIN_DISTANCE_PX) {
        trail.push({ x: renderX, y: renderY, t: now });
      }
      // Drop expired points
      while (trail.length > 0 && now - (trail[0]?.t ?? 0) > TRAIL_LIFETIME_MS) {
        trail.shift();
      }

      // Clear and redraw trail with age-based fade
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      if (trail.length > 1) {
        for (let i = 1; i < trail.length; i++) {
          const p0 = trail[i - 1];
          const p1 = trail[i];
          if (!p0 || !p1) continue;
          const age = (now - p1.t) / TRAIL_LIFETIME_MS;
          const opacity = Math.max(0, 1 - age);
          ctx.strokeStyle = `rgba(245, 165, 92, ${opacity * 0.55})`;
          ctx.lineWidth = 1.6 * (1 - age * 0.6);
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          ctx.lineTo(p1.x, p1.y);
          ctx.stroke();
        }
      }

      const el = cursorRef.current;
      if (el) {
        // Positioning only — never scale/opacity. The inner motion.div owns those,
        // and we keep transform-writers on separate elements so framer-motion's
        // scale animation doesn't fight the RAF tick (which would flicker the dot).
        el.style.transform = `translate3d(${renderX}px, ${renderY}px, 0)`;
      }

      raf = window.requestAnimationFrame(tick);
    };

    // `mouseenter` / `mouseleave` are element-targeted events per the spec;
    // attach them to documentElement (the <html> root) for guaranteed
    // cross-browser firing when the pointer exits or re-enters the viewport.
    const root = document.documentElement;
    document.addEventListener('mousemove', onMove);
    root.addEventListener('mouseenter', onEnter);
    root.addEventListener('mouseleave', onLeave);
    raf = window.requestAnimationFrame(tick);

    return () => {
      document.removeEventListener('mousemove', onMove);
      root.removeEventListener('mouseenter', onEnter);
      root.removeEventListener('mouseleave', onLeave);
      window.removeEventListener('resize', resize);
      window.cancelAnimationFrame(raf);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <>
      <canvas ref={canvasRef} aria-hidden className="pointer-events-none fixed inset-0 z-[78]" />
      <div
        ref={cursorRef}
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 z-[80] will-change-transform"
        style={{ transform: 'translate3d(0, 0, 0)' }}
      >
        <AnimatePresence>
          {visible && (
            <motion.div
              aria-hidden
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={{ duration: 0.25, ease: EASE_EXPO }}
              className="absolute h-3 w-3 rounded-full bg-accent"
              style={{
                // Center the 12×12 dot on the outer div's origin via CSS, not
                // transform — so the scale animation has free reign on `transform`.
                left: -6,
                top: -6,
                boxShadow:
                  '0 0 0 1px rgba(245, 165, 92, 0.5), 0 0 16px rgba(245, 165, 92, 0.6), 0 0 36px rgba(245, 165, 92, 0.3)',
              }}
            />
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
