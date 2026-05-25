'use client';

import type { PresetName } from '@humanjs/core';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { cn } from '../../lib/cn';

type EventKind = 'click' | 'type' | 'scroll' | 'read';

interface RecordedEvent {
  readonly type: EventKind;
  /** Offset (ms) from recording start when the action began. */
  readonly tMs: number;
  readonly durationMs: number;
  /** Free-form params, faithful in shape to the real Timeline schema. */
  readonly params: Readonly<Record<string, string | number>>;
  /** Display label for the scrubber marker. */
  readonly label: string;
}

interface Session {
  readonly filename: string;
  readonly events: readonly RecordedEvent[];
  readonly durationMs: number;
}

/**
 * Per-personality fake recording sessions. Shapes match the real
 * `Timeline` interface so the JSON readout in the right pane is the
 * same shape `rec.toTimeline()` would emit — just authored not captured.
 */
const SESSIONS: Record<PresetName, Session> = {
  careful: {
    filename: 'humanjs-careful.mp4',
    durationMs: 11800,
    events: [
      {
        type: 'click',
        tMs: 320,
        durationMs: 760,
        params: { target: 'button.start' },
        label: 'click',
      },
      {
        type: 'type',
        tMs: 1480,
        durationMs: 3200,
        params: { target: '#email', length: 18 },
        label: 'type',
      },
      {
        type: 'scroll',
        tMs: 5100,
        durationMs: 1240,
        params: { target: '#features' },
        label: 'scroll',
      },
      // Read at ~250 wpm on a 42-word passage — about 5s. Real `human.read`
      // dwell scales by personality and word count; matching here so the
      // demo's cadence reads like the real thing, not an art-direction blur.
      {
        type: 'read',
        tMs: 6680,
        durationMs: 4800,
        params: { target: 'p.passage', kind: 'prose', words: 42 },
        label: 'read',
      },
    ],
  },
  fast: {
    filename: 'humanjs-fast.mp4',
    durationMs: 6800,
    events: [
      {
        type: 'click',
        tMs: 200,
        durationMs: 420,
        params: { target: 'button.start' },
        label: 'click',
      },
      {
        type: 'type',
        tMs: 720,
        durationMs: 1900,
        params: { target: '#email', length: 18 },
        label: 'type',
      },
      {
        type: 'scroll',
        tMs: 2720,
        durationMs: 700,
        params: { target: '#features' },
        label: 'scroll',
      },
      // Skim mode — about half the careful pace.
      {
        type: 'read',
        tMs: 3520,
        durationMs: 3000,
        params: { target: 'p.passage', kind: 'prose', words: 42 },
        label: 'read',
      },
    ],
  },
  distracted: {
    filename: 'humanjs-distracted.mp4',
    durationMs: 15400,
    events: [
      {
        type: 'click',
        tMs: 480,
        durationMs: 1120,
        params: { target: 'button.start' },
        label: 'click',
      },
      {
        type: 'type',
        tMs: 1900,
        durationMs: 4800,
        params: { target: '#email', length: 18, typos: 3 },
        label: 'type · typos',
      },
      {
        type: 'scroll',
        tMs: 7000,
        durationMs: 2200,
        params: { target: '#features', overshoot: 1 },
        label: 'scroll · overshoot',
      },
      // Distracted reads slower with longer dwells — about 5.7s.
      {
        type: 'read',
        tMs: 9400,
        durationMs: 5700,
        params: { target: 'p.passage', kind: 'prose', words: 42 },
        label: 'read',
      },
    ],
  },
  precise: {
    filename: 'humanjs-precise.mp4',
    durationMs: 9400,
    events: [
      {
        type: 'click',
        tMs: 280,
        durationMs: 520,
        params: { target: 'button.start' },
        label: 'click',
      },
      {
        type: 'type',
        tMs: 1000,
        durationMs: 2600,
        params: { target: '#email', length: 18 },
        label: 'type',
      },
      {
        type: 'scroll',
        tMs: 3800,
        durationMs: 900,
        params: { target: '#features' },
        label: 'scroll',
      },
      // Steady, deliberate — ~4.4s.
      {
        type: 'read',
        tMs: 4900,
        durationMs: 4400,
        params: { target: 'p.passage', kind: 'prose', words: 42 },
        label: 'read',
      },
    ],
  },
};

type View = 'frame' | 'timeline';

const PLAYBACK_INTERVAL_MS = 33; // ~30fps scrubber update

function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, ms) / 1000;
  const s = Math.floor(totalSeconds);
  const tenths = Math.floor((totalSeconds - s) * 10);
  return `${s}.${tenths}s`;
}

function findActiveEvent(events: readonly RecordedEvent[], tMs: number): RecordedEvent | null {
  // The "active" event is the one whose window contains tMs. If tMs falls in a
  // gap, return the most recently started one (so the preview keeps showing
  // the last action's outcome instead of going blank between events).
  let active: RecordedEvent | null = null;
  for (const event of events) {
    if (event.tMs <= tMs) active = event;
    else break;
  }
  if (active && tMs > active.tMs + active.durationMs + 600) {
    // Long after a completed event — drop back to neutral preview
    return null;
  }
  return active;
}

interface RecorderDemoProps {
  readonly personality: PresetName;
}

export function RecorderDemo({ personality }: RecorderDemoProps) {
  const session = SESSIONS[personality];
  const prefersReducedMotion = useReducedMotion();

  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [view, setView] = useState<View>('frame');

  // Reset playback whenever the personality (and thus the session) changes.
  useEffect(() => {
    setCurrentTimeMs(0);
    setIsPlaying(true);
  }, []);

  // Auto-playback loop. Pauses while the user is scrubbing or when reduced
  // motion is requested. Loops back to 0 at the end so the demo keeps living.
  const playStateRef = useRef({ isPlaying, isScrubbing });
  playStateRef.current = { isPlaying, isScrubbing };
  useEffect(() => {
    if (prefersReducedMotion) return;
    const tick = window.setInterval(() => {
      if (!playStateRef.current.isPlaying || playStateRef.current.isScrubbing) return;
      setCurrentTimeMs((prev) => {
        const next = prev + PLAYBACK_INTERVAL_MS;
        if (next >= session.durationMs) return 0;
        return next;
      });
    }, PLAYBACK_INTERVAL_MS);
    return () => window.clearInterval(tick);
  }, [session.durationMs, prefersReducedMotion]);

  const activeEvent = useMemo(
    () => findActiveEvent(session.events, currentTimeMs),
    [session.events, currentTimeMs],
  );

  // Scrubber drag handling. Pointer events instead of mouse/touch so it
  // works seamlessly on desktop and mobile, including stylus.
  const scrubberRef = useRef<HTMLDivElement | null>(null);
  const seekToClientX = useCallback(
    (clientX: number) => {
      const el = scrubberRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      setCurrentTimeMs(ratio * session.durationMs);
    },
    [session.durationMs],
  );

  const onScrubberPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      setIsScrubbing(true);
      setIsPlaying(false);
      seekToClientX(e.clientX);
    },
    [seekToClientX],
  );

  const onScrubberPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!isScrubbing) return;
      seekToClientX(e.clientX);
    },
    [isScrubbing, seekToClientX],
  );

  const onScrubberPointerUp = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    setIsScrubbing(false);
  }, []);

  const progressRatio = session.durationMs === 0 ? 0 : currentTimeMs / session.durationMs;

  return (
    <div className="rounded-card-lg border border-hairline bg-surface/60 p-3 backdrop-blur md:p-5">
      {/* Status bar — REC indicator, filename, runtime, event count */}
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted md:mb-4">
        <div className="flex items-center gap-2.5">
          <RecDot active={isPlaying && !isScrubbing} reducedMotion={!!prefersReducedMotion} />
          <span className="text-foreground-warm/90">REC</span>
          <span className="text-muted/50">·</span>
          <span className="truncate text-muted-strong">{session.filename}</span>
        </div>
        <div className="flex items-center gap-3 text-muted/70 tabular-nums">
          <span>
            <span className="text-foreground-warm tabular-nums">{formatTime(currentTimeMs)}</span>
            <span className="text-muted/50"> / {formatTime(session.durationMs)}</span>
          </span>
          <span className="hidden text-muted/50 sm:inline">·</span>
          <span className="hidden sm:inline">{session.events.length} events</span>
        </div>
      </header>

      {/* Main panel — frame preview + tabs/output, side-by-side on desktop */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1.15fr_1fr] md:gap-4">
        {/* LEFT: visual frame preview that reacts to the current event */}
        <FramePreview
          event={activeEvent}
          currentTimeMs={currentTimeMs}
          reducedMotion={!!prefersReducedMotion}
        />

        {/* RIGHT: tabbed output panel — visual frame strip or JSON timeline */}
        <div className="overflow-hidden rounded-card border border-hairline bg-ink/40">
          <div className="flex items-center gap-1 border-hairline border-b p-1.5">
            <ViewTab label="Frames" value="frame" active={view} onClick={setView} />
            <ViewTab label="Timeline" value="timeline" active={view} onClick={setView} />
            <span className="ml-auto px-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted/60">
              {view === 'frame' ? 'rec.toVideo()' : 'rec.toTimeline()'}
            </span>
          </div>

          <div className="relative h-[260px] overflow-hidden md:h-[300px]">
            <AnimatePresence mode="wait">
              {view === 'frame' ? (
                <motion.div
                  key="frame-strip"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute inset-0"
                >
                  <FrameStrip
                    events={session.events}
                    durationMs={session.durationMs}
                    currentTimeMs={currentTimeMs}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="timeline-json"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute inset-0"
                >
                  <TimelineJson
                    personality={personality}
                    session={session}
                    activeEvent={activeEvent}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Scrubber — the hero interaction */}
      <div className="mt-3 md:mt-4">
        <Scrubber
          ref={scrubberRef}
          events={session.events}
          durationMs={session.durationMs}
          progressRatio={progressRatio}
          isScrubbing={isScrubbing}
          onPointerDown={onScrubberPointerDown}
          onPointerMove={onScrubberPointerMove}
          onPointerUp={onScrubberPointerUp}
          onPointerCancel={onScrubberPointerUp}
          onTogglePlay={() => setIsPlaying((p) => !p)}
          isPlaying={isPlaying}
        />
      </div>
    </div>
  );
}

/**
 * The pulsing red dot. When recording is "active" (auto-playing, no scrub),
 * it pulses. When paused/scrubbing, it stays solid so the user sees the
 * difference. Animation runs via CSS so it doesn't tax React.
 */
function RecDot({ active, reducedMotion }: { active: boolean; reducedMotion: boolean }) {
  return (
    <span className="relative inline-flex h-2.5 w-2.5 items-center justify-center">
      <span
        className={cn(
          'absolute inline-block h-2.5 w-2.5 rounded-full bg-[#ff5b5b]',
          active && !reducedMotion && 'animate-rec-pulse',
        )}
      />
      <span className="relative inline-block h-1.5 w-1.5 rounded-full bg-[#ff7878]" />
      <style jsx>{`
        @keyframes recPulse {
          0%, 100% { transform: scale(1); opacity: 0.45; }
          50% { transform: scale(1.6); opacity: 0; }
        }
        :global(.animate-rec-pulse) {
          animation: recPulse 1.4s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
      `}</style>
    </span>
  );
}

function ViewTab({
  label,
  value,
  active,
  onClick,
}: {
  label: string;
  value: View;
  active: View;
  onClick: (v: View) => void;
}) {
  const isActive = active === value;
  return (
    <button
      type="button"
      onClick={() => onClick(value)}
      aria-pressed={isActive}
      className={cn(
        'relative rounded-md px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-accent',
        isActive ? 'text-foreground-warm' : 'text-muted/70 hover:text-muted-strong',
      )}
    >
      {isActive && (
        <motion.span
          layoutId="recorder-view-tab"
          className="absolute inset-0 rounded-md bg-accent/10"
          transition={{ type: 'spring', bounce: 0.18, duration: 0.4 }}
        />
      )}
      <span className="relative">{label}</span>
    </button>
  );
}

/**
 * Visual preview of the action happening at the current scrub time. Renders
 * one of four stylized "frames" — symbolic, not screenshot-literal. The
 * goal is to read as "this is what would be on screen RIGHT NOW," fast
 * enough to track while the scrubber moves.
 */
function FramePreview({
  event,
  currentTimeMs,
  reducedMotion,
}: {
  event: RecordedEvent | null;
  currentTimeMs: number;
  reducedMotion: boolean;
}) {
  return (
    <div className="relative overflow-hidden rounded-card border border-hairline bg-gradient-to-br from-ink/80 via-canvas to-surface-elevated/60 h-[260px] md:h-[300px]">
      {/* Scan lines for the "captured frame" feel */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(to bottom, transparent 0, transparent 2px, rgba(255,255,255,0.4) 2px, rgba(255,255,255,0.4) 3px)',
        }}
      />
      {/* Subtle radial glow that shifts with the active event */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 transition-[background] duration-700"
        style={{
          background: event
            ? `radial-gradient(circle at 30% 30%, ${glowFor(event.type)} 0%, transparent 60%)`
            : 'radial-gradient(circle at 50% 50%, rgba(245,165,92,0.04) 0%, transparent 60%)',
        }}
      />

      {/* Crossfade — don't use mode="wait" because waiting for the exit
          animation (320ms) means the cursor in the entering read frame is
          already ~7% into the first line by the time the frame is visible.
          Crossfade lets the new frame mount immediately at its true position. */}
      <AnimatePresence>
        {event ? (
          <motion.div
            key={event.type + event.tMs}
            initial={{ opacity: 0, scale: 0.99 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.01 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 flex items-center justify-center p-6 md:p-8"
          >
            <FrameContent
              event={event}
              currentTimeMs={currentTimeMs}
              reducedMotion={reducedMotion}
            />
          </motion.div>
        ) : (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted/50"
          >
            <span className="font-mono text-[10px] uppercase tracking-[0.22em]">Captured</span>
            <span className="font-display text-2xl italic text-muted/60">Session ready.</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom-left frame metadata stamp */}
      {event && (
        <div className="pointer-events-none absolute bottom-2 left-3 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.22em] text-muted/55">
          <span className="text-accent/70">▸</span>
          <span>{event.type}</span>
          <span className="text-muted/40">·</span>
          <span>{formatTime(event.tMs)}</span>
        </div>
      )}
    </div>
  );
}

function glowFor(type: EventKind): string {
  switch (type) {
    case 'click':
      return 'rgba(245, 165, 92, 0.14)';
    case 'type':
      return 'rgba(91, 124, 201, 0.14)';
    case 'scroll':
      return 'rgba(122, 191, 133, 0.12)';
    case 'read':
      return 'rgba(215, 127, 163, 0.12)';
  }
}

/**
 * Computes how far into the event the scrubber is, clamped to [0, 1]. Used
 * by type + read frames to animate progressively as scrub time advances —
 * dragging the scrubber through a typing event types the text out; dragging
 * through a read event walks the cursor line-by-line through the passage.
 */
function eventProgress(event: RecordedEvent, currentTimeMs: number): number {
  if (event.durationMs <= 0) return 1;
  const local = (currentTimeMs - event.tMs) / event.durationMs;
  return Math.max(0, Math.min(1, local));
}

const READ_LINES = [
  'A real cursor curves between targets.',
  'A real keyboard has rhythm.',
  'A real reader dwells. HumanJS turns',
  'automation into something the reader',
  "can't tell apart from a person.",
];

const TYPED_TARGET = 'demo@humanjs.dev';

/** Per-event-type stylized "what's on screen right now" visual. */
function FrameContent({
  event,
  currentTimeMs,
  reducedMotion,
}: {
  event: RecordedEvent;
  currentTimeMs: number;
  reducedMotion: boolean;
}) {
  if (event.type === 'click') {
    return (
      <div className="relative">
        <div className="rounded-card border border-accent/40 bg-accent/15 px-5 py-3 font-medium text-accent shadow-[0_8px_32px_rgba(245,165,92,0.25)]">
          {String(event.params.target ?? 'button')}
        </div>
        {!reducedMotion && (
          <motion.span
            aria-hidden
            className="-translate-x-1/2 -translate-y-1/2 absolute top-1/2 left-1/2 rounded-full border border-accent/50"
            initial={{ width: 8, height: 8, opacity: 0.9 }}
            animate={{ width: 92, height: 92, opacity: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut', repeat: Number.POSITIVE_INFINITY }}
          />
        )}
      </div>
    );
  }

  if (event.type === 'type') {
    // Animate the typed text from empty → full as the scrubber advances
    // through the event's window. Mirrors the real `human.type()` behavior
    // where keystrokes accumulate over the event's duration.
    const t = eventProgress(event, currentTimeMs);
    const targetLength = Math.min(
      TYPED_TARGET.length,
      Number(event.params.length) || TYPED_TARGET.length,
    );
    const charsToShow = Math.floor(t * targetLength);
    const typed = TYPED_TARGET.slice(0, charsToShow);
    const hasTypos = Number(event.params.typos) > 0;
    // Show a "typo ghost" briefly mid-word — matches what the real distracted
    // personality does (inject a wrong char, then backspace).
    const showTypoGhost = hasTypos && t > 0.4 && t < 0.55 && charsToShow >= 5;

    return (
      <div className="w-full max-w-xs">
        <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted/60">
          {String(event.params.target ?? '#email')}
        </div>
        <div className="rounded-card border border-accent/30 bg-ink/60 px-4 py-3 font-mono text-[15px] text-accent min-h-[44px]">
          {typed}
          {showTypoGhost && <span className="text-[#ff7878]/70">a</span>}
          <span
            className={cn(
              'ml-0.5 inline-block h-4 w-[2px] translate-y-[3px] bg-accent',
              !reducedMotion && 'animate-[caret_900ms_steps(1,end)_infinite]',
            )}
          />
        </div>
        <style jsx>{`
          @keyframes caret {
            0%, 49% { opacity: 1; }
            50%, 100% { opacity: 0; }
          }
        `}</style>
      </div>
    );
  }

  if (event.type === 'scroll') {
    const overshoot = Number(event.params.overshoot) > 0;
    return (
      <div className="flex w-full max-w-[200px] flex-col items-center gap-3">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted/60">
          {String(event.params.target ?? '#section')}
        </div>
        <div className="relative h-32 w-1.5 rounded-full bg-hairline">
          {!reducedMotion && (
            <motion.span
              aria-hidden
              className="absolute left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-accent shadow-[0_0_16px_rgba(245,165,92,0.7)]"
              animate={{
                top: overshoot ? ['0%', '90%', '78%'] : ['0%', '90%'],
              }}
              transition={{
                duration: overshoot ? 1.6 : 1.2,
                ease: [0.16, 1, 0.3, 1],
                repeat: Number.POSITIVE_INFINITY,
                repeatType: 'reverse',
              }}
            />
          )}
        </div>
        {overshoot && (
          <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#d77fa3]/80">
            overshoot · correct
          </span>
        )}
      </div>
    );
  }

  // read — eye-scan cursor walks line-by-line through the passage, mirroring
  // the real `human.read({ withMotion: true })` behavior. Each line gets an
  // equal slice of the event's duration; within a line, the cursor sweeps
  // L→R across the actual text width (not the container), then jumps to
  // the start of the next line — same path shape `planReadingScan` traces.
  const t = eventProgress(event, currentTimeMs);
  const lines = READ_LINES;
  const totalProgress = t * lines.length;
  const lineIndex = Math.min(lines.length - 1, Math.floor(totalProgress));
  const lineProgress = Math.min(1, totalProgress - lineIndex);
  // Each line is rendered at the same vertical slot — equal spacing makes
  // the cursor's y-position calculation trivial.
  const lineHeightPx = 22;
  // Approximate width of the current line's text in pixels. Monospaced font
  // at 12px renders roughly 7.2px per character; using the line's char count
  // keeps the cursor on the actual text instead of sweeping past it into
  // the container's empty trailing whitespace.
  const charWidthPx = 7.2;
  const currentLineWidthPx = lines[lineIndex] ? lines[lineIndex].length * charWidthPx : 0;
  const cursorX = lineProgress * currentLineWidthPx;
  // Cursor tip sits on the text — line is 22px tall, 12px text vertically
  // centered (so the text occupies y=5..17 within the line). Anchoring the
  // tip at y=8 puts it on the upper portion of the glyphs, which reads as
  // "mouse hovering over the word" rather than "marker in the gap above."
  const cursorY = lineIndex * lineHeightPx + 8;

  return (
    <div className="relative w-full max-w-sm font-mono text-[12px] leading-[22px] text-muted-strong">
      {lines.map((line, i) => (
        <div
          key={line}
          className={cn(
            'transition-colors duration-300',
            i < lineIndex
              ? 'text-muted/45'
              : i === lineIndex
                ? 'text-foreground-warm'
                : 'text-muted-strong',
          )}
          style={{ height: `${lineHeightPx}px` }}
        >
          {line}
        </div>
      ))}
      {/* Eye-scan cursor — same arrow shape as the HumanJS visible-cursor
          overlay, anchored at its tip so it appears to "hover over" the
          word being read. Sweeps L→R across the current line's actual text
          width, then jumps to the next line's start position.
          NOTE: no CSS transition on top/left — the parent updates this every
          ~33ms during auto-play, and a CSS transition would make the cursor
          chase its target and visibly lag behind (the value the user sees
          is the value from one transition-duration ago). Following the React
          render cadence directly keeps the cursor on the word being read. */}
      {!reducedMotion && (
        <svg
          aria-hidden
          viewBox="0 0 22 24"
          preserveAspectRatio="xMinYMin meet"
          className="pointer-events-none absolute h-[14px] w-[13px] drop-shadow-[0_0_6px_rgba(245,165,92,0.7)]"
          style={{ top: `${cursorY}px`, left: `${cursorX}px` }}
        >
          <path
            d="M 0 0 L 16 6 L 8 9.5 L 5 19 Z"
            fill="var(--color-accent)"
            stroke="#020203"
            strokeWidth={0.7}
            strokeLinejoin="round"
          />
        </svg>
      )}
    </div>
  );
}

/** Vertical frame strip — events stacked as chips, current one highlighted. */
function FrameStrip({
  events,
  durationMs,
  currentTimeMs,
}: {
  events: readonly RecordedEvent[];
  durationMs: number;
  currentTimeMs: number;
}) {
  return (
    <div className="h-full overflow-y-auto px-4 py-3">
      <ul className="space-y-2">
        {events.map((event) => {
          const isActive =
            currentTimeMs >= event.tMs && currentTimeMs < event.tMs + event.durationMs;
          const isPast = currentTimeMs >= event.tMs + event.durationMs;
          return (
            <li
              key={`${event.type}-${event.tMs}`}
              className={cn(
                'group flex items-center gap-3 rounded-md border px-3 py-2 transition-all duration-300',
                isActive
                  ? 'border-accent/40 bg-accent/8 shadow-[0_0_24px_rgba(245,165,92,0.12)]'
                  : isPast
                    ? 'border-hairline bg-surface/30 opacity-60'
                    : 'border-hairline bg-surface/40',
              )}
            >
              <span
                className={cn(
                  'inline-block h-1.5 w-1.5 rounded-full transition-colors duration-300',
                  isActive ? 'bg-accent' : isPast ? 'bg-muted/60' : 'bg-muted/30',
                )}
              />
              <span
                className={cn(
                  'font-mono text-[11px] uppercase tracking-[0.18em] transition-colors duration-300',
                  isActive ? 'text-foreground-warm' : 'text-muted-strong',
                )}
              >
                {event.label}
              </span>
              <span className="ml-auto font-mono text-[10px] text-muted/60 tabular-nums">
                {formatTime(event.tMs)}
              </span>
            </li>
          );
        })}
        <li
          className={cn(
            'flex items-center gap-3 rounded-md border border-hairline border-dashed px-3 py-2 transition-opacity duration-300',
            currentTimeMs >= durationMs - 100 ? 'opacity-100' : 'opacity-40',
          )}
        >
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-muted/40" />
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted/60">
            end of recording
          </span>
        </li>
      </ul>
    </div>
  );
}

/** Pretty-printed Timeline JSON with the active event line highlighted. */
function TimelineJson({
  personality,
  session,
  activeEvent,
}: {
  personality: PresetName;
  session: Session;
  activeEvent: RecordedEvent | null;
}) {
  return (
    <div className="h-full overflow-auto bg-ink/60 p-4 font-mono text-[11px] leading-[1.7] text-muted-strong">
      <div className="whitespace-pre">
        <span className="text-muted/50">{'{'}</span>
        {'\n  '}
        <span className="text-accent-cool">"version"</span>
        <span className="text-muted/50">: </span>
        <span className="text-accent">1</span>
        <span className="text-muted/50">,</span>
        {'\n  '}
        <span className="text-accent-cool">"personality"</span>
        <span className="text-muted/50">: </span>
        <span className="text-[#7abf85]">"{personality}"</span>
        <span className="text-muted/50">,</span>
        {'\n  '}
        <span className="text-accent-cool">"durationMs"</span>
        <span className="text-muted/50">: </span>
        <span className="text-accent">{session.durationMs}</span>
        <span className="text-muted/50">,</span>
        {'\n  '}
        <span className="text-accent-cool">"events"</span>
        <span className="text-muted/50">: [</span>
        {'\n'}
        {session.events.map((event, i) => {
          const isActive = activeEvent === event;
          return (
            <span
              key={`json-${event.type}-${event.tMs}`}
              className={cn(
                'block rounded-sm transition-colors duration-300',
                isActive ? 'bg-accent/10 px-1 -mx-1 ring-1 ring-accent/20' : '',
              )}
            >
              {'    '}
              <span className="text-muted/50">{'{ '}</span>
              <span className="text-accent-cool">"type"</span>
              <span className="text-muted/50">: </span>
              <span className="text-[#7abf85]">"{event.type}"</span>
              <span className="text-muted/50">, </span>
              <span className="text-accent-cool">"tMs"</span>
              <span className="text-muted/50">: </span>
              <span className="text-accent">{event.tMs}</span>
              <span className="text-muted/50">, </span>
              <span className="text-accent-cool">"durationMs"</span>
              <span className="text-muted/50">: </span>
              <span className="text-accent">{event.durationMs}</span>
              <span className="text-muted/50">
                {' }'}
                {i < session.events.length - 1 ? ',' : ''}
              </span>
            </span>
          );
        })}
        <span className="text-muted/50">{'  ]\n'}</span>
        <span className="text-muted/50">{'}'}</span>
      </div>
    </div>
  );
}

interface ScrubberProps {
  readonly events: readonly RecordedEvent[];
  readonly durationMs: number;
  readonly progressRatio: number;
  readonly isScrubbing: boolean;
  readonly isPlaying: boolean;
  readonly onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void;
  readonly onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => void;
  readonly onPointerUp: (e: ReactPointerEvent<HTMLDivElement>) => void;
  readonly onPointerCancel: (e: ReactPointerEvent<HTMLDivElement>) => void;
  readonly onTogglePlay: () => void;
}

const Scrubber = ({
  ref,
  events,
  durationMs,
  progressRatio,
  isScrubbing,
  isPlaying,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onTogglePlay,
}: ScrubberProps & { ref?: React.Ref<HTMLDivElement> }) => {
  return (
    <div className="flex items-center gap-3 rounded-card border border-hairline bg-ink/40 p-2 md:gap-4 md:p-3">
      <button
        type="button"
        onClick={onTogglePlay}
        aria-label={isPlaying ? 'Pause playback' : 'Resume playback'}
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-accent',
          isPlaying
            ? 'border-accent/40 bg-accent/10 text-accent'
            : 'border-hairline-strong bg-surface/60 text-muted-strong hover:text-foreground-warm',
        )}
      >
        {isPlaying ? <PauseGlyph /> : <PlayGlyph />}
      </button>

      <div
        ref={ref}
        role="slider"
        aria-label="Recording timeline scrubber"
        aria-valuemin={0}
        aria-valuemax={durationMs}
        aria-valuenow={Math.round(progressRatio * durationMs)}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        className={cn(
          'relative h-9 flex-1 cursor-pointer select-none rounded-full border border-hairline bg-surface/40 touch-none',
          isScrubbing && 'border-accent/40',
        )}
      >
        {/* Played portion */}
        <div
          className="pointer-events-none absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-accent/20 via-accent/15 to-accent/5"
          style={{ width: `${Math.min(100, progressRatio * 100)}%` }}
        />

        {/* Event markers — small chips at each event's tMs */}
        {events.map((event) => {
          const leftPercent = (event.tMs / durationMs) * 100;
          const widthPercent = Math.max(0.5, (event.durationMs / durationMs) * 100);
          return (
            <div
              key={`marker-${event.type}-${event.tMs}`}
              className="pointer-events-none absolute top-1/2 -translate-y-1/2 h-1 rounded-full bg-accent/45"
              style={{
                left: `${leftPercent}%`,
                width: `${widthPercent}%`,
              }}
            />
          );
        })}

        {/* Scrubber handle */}
        <div
          className={cn(
            'pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2 transition-shadow duration-150',
            isScrubbing
              ? 'shadow-[0_0_0_8px_rgba(245,165,92,0.10),0_0_16px_rgba(245,165,92,0.4)]'
              : 'shadow-[0_0_0_4px_rgba(245,165,92,0.06)]',
          )}
          style={{ left: `${Math.min(100, progressRatio * 100)}%` }}
        >
          <div className="h-6 w-1.5 rounded-full bg-accent" />
        </div>
      </div>

      <div className="hidden font-mono text-[10px] uppercase tracking-[0.18em] text-muted/60 tabular-nums sm:block">
        {isScrubbing ? 'scrubbing' : isPlaying ? 'playing' : 'paused'}
      </div>
    </div>
  );
};

function PlayGlyph() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-current" aria-hidden>
      <path d="M4 2.5 L13 8 L4 13.5 Z" />
    </svg>
  );
}

function PauseGlyph() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-current" aria-hidden>
      <rect x="4" y="3" width="3" height="10" rx="1" />
      <rect x="9" y="3" width="3" height="10" rx="1" />
    </svg>
  );
}
