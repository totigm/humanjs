'use client';

import { motion, useReducedMotion } from 'framer-motion';

interface AmbientBlobsProps {
  className?: string;
}

export function AmbientBlobs({ className }: AmbientBlobsProps) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return (
      <div
        aria-hidden
        className={className}
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background:
            'radial-gradient(circle at 30% 20%, rgba(245, 165, 92, 0.08), transparent 50%), radial-gradient(circle at 70% 80%, rgba(91, 124, 201, 0.05), transparent 50%)',
        }}
      />
    );
  }

  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className ?? ''}`}
    >
      <motion.div
        className="absolute h-[600px] w-[600px] rounded-full blur-3xl"
        style={{
          left: '20%',
          top: '10%',
          background: 'radial-gradient(circle, rgba(245, 165, 92, 0.10), transparent 60%)',
        }}
        animate={{
          x: [0, 40, -20, 0],
          y: [0, 30, -10, 0],
        }}
        transition={{
          duration: 24,
          repeat: Number.POSITIVE_INFINITY,
          ease: 'easeInOut',
        }}
      />
      <motion.div
        className="absolute h-[500px] w-[500px] rounded-full blur-3xl"
        style={{
          right: '15%',
          bottom: '20%',
          background: 'radial-gradient(circle, rgba(91, 124, 201, 0.08), transparent 60%)',
        }}
        animate={{
          x: [0, -30, 20, 0],
          y: [0, -20, 30, 0],
        }}
        transition={{
          duration: 28,
          repeat: Number.POSITIVE_INFINITY,
          ease: 'easeInOut',
        }}
      />
    </div>
  );
}
