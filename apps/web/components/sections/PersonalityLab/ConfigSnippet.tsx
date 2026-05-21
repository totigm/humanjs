'use client';

import type { PresetName } from '@humanjs/core';
import { AnimatePresence, motion } from 'framer-motion';
import { EASE_EXPO } from '../../../lib/motion';

interface ConfigSnippetProps {
  personality: PresetName;
  curvature: number;
  jitterPx: number;
  dirty: boolean;
}

export function ConfigSnippet({ personality, curvature, jitterPx, dirty }: ConfigSnippetProps) {
  return (
    <pre className="overflow-x-auto rounded-card border border-hairline bg-canvas p-4 font-mono text-[11px] leading-relaxed text-foreground/90">
      <span className="text-muted">{`{ `}</span>
      <span className="block pl-2">
        {`personality: `}
        <span className="text-accent">{`'${personality}'`}</span>
        {','}
      </span>
      <AnimatePresence initial={false}>
        {dirty && (
          <motion.span
            key="mouse-override"
            initial={{ opacity: 0, height: 0, y: -4 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -4 }}
            transition={{
              duration: 0.32,
              ease: EASE_EXPO,
              opacity: { duration: 0.24 },
            }}
            className="block overflow-hidden pl-2"
          >
            {`mouse: { `}
            <motion.span
              key={`curv-${curvature.toFixed(2)}`}
              initial={{ opacity: 0.4 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.18 }}
              className="text-accent"
            >
              {`curvature: ${curvature.toFixed(2)}`}
            </motion.span>
            {`, `}
            <motion.span
              key={`jit-${jitterPx.toFixed(1)}`}
              initial={{ opacity: 0.4 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.18 }}
              className="text-accent"
            >
              {`jitterPx: ${jitterPx.toFixed(1)}`}
            </motion.span>
            {` },`}
          </motion.span>
        )}
      </AnimatePresence>
      <span className="text-muted">{`}`}</span>
    </pre>
  );
}
