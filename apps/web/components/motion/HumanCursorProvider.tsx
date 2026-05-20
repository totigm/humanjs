'use client';

import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

interface HumanCursorContextValue {
  enabled: boolean;
  toggle: () => void;
  setEnabled: (value: boolean) => void;
  supported: boolean;
}

const HumanCursorContext = createContext<HumanCursorContextValue | null>(null);
const STORAGE_KEY = 'humanjs:cursor-enabled';

export function HumanCursorProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(false);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hasFinePointer = window.matchMedia('(pointer: fine)').matches;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isSupported = hasFinePointer && !prefersReducedMotion;
    setSupported(isSupported);

    if (!isSupported) {
      setEnabled(false);
      return;
    }

    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === 'true') setEnabled(true);
    } catch {
      // localStorage unavailable; ignore
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(STORAGE_KEY, String(enabled));
    } catch {
      // ignore
    }
  }, [enabled]);

  const toggle = useCallback(() => setEnabled((prev) => !prev), []);

  const value = useMemo<HumanCursorContextValue>(
    () => ({ enabled: supported && enabled, toggle, setEnabled, supported }),
    [enabled, supported, toggle],
  );

  return <HumanCursorContext.Provider value={value}>{children}</HumanCursorContext.Provider>;
}

export function useHumanCursor(): HumanCursorContextValue {
  const ctx = useContext(HumanCursorContext);
  if (!ctx) {
    throw new Error('useHumanCursor must be used within HumanCursorProvider');
  }
  return ctx;
}
