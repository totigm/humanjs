'use client';

import { createRng } from '@humanjs/core';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { useHumanCursor } from './HumanCursorProvider';

const SMOOTHING = 0.14;
const JITTER_REFRESH_FRAMES = 6;
const JITTER_STD_DEV = 0.4;

export function HumanCursor() {
  const { enabled } = useHumanCursor();
  const cursorRef = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    let frame = 0;
    let raf = 0;
    const target = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const current = { x: target.x, y: target.y };
    const jitter = { x: 0, y: 0 };
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

    const tick = () => {
      const dx = target.x - current.x;
      const dy = target.y - current.y;
      current.x += dx * SMOOTHING;
      current.y += dy * SMOOTHING;

      frame++;
      if (frame % JITTER_REFRESH_FRAMES === 0) {
        jitter.x = rng.nextGaussian(0, JITTER_STD_DEV);
        jitter.y = rng.nextGaussian(0, JITTER_STD_DEV);
      }

      const el = cursorRef.current;
      if (el) {
        const x = current.x + jitter.x;
        const y = current.y + jitter.y;
        el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
      }

      raf = window.requestAnimationFrame(tick);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseenter', onEnter);
    document.addEventListener('mouseleave', onLeave);
    raf = window.requestAnimationFrame(tick);

    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseenter', onEnter);
      document.removeEventListener('mouseleave', onLeave);
      window.cancelAnimationFrame(raf);
    };
  }, [enabled]);

  return (
    <AnimatePresence>
      {enabled && visible && (
        <motion.div
          ref={cursorRef}
          aria-hidden
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.5 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="pointer-events-none fixed left-0 top-0 z-[80] h-3 w-3 rounded-full bg-accent will-change-transform"
          style={{
            boxShadow:
              '0 0 0 1px rgba(245, 165, 92, 0.4), 0 0 12px rgba(245, 165, 92, 0.5), 0 0 32px rgba(245, 165, 92, 0.25)',
          }}
        />
      )}
    </AnimatePresence>
  );
}
