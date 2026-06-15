import type { CapturedAction } from '../capture/types';
import { inferSelectors } from './selectors';

declare global {
  interface Window {
    /** Binding exposed by the CLI; receives each captured action. */
    __humanjsEmit?: (action: CapturedAction) => void;
    /** Guard so a re-injected script doesn't double-bind listeners. */
    __humanjsRecording?: boolean;
  }
}

/** Text-like input types whose value we capture as a `type` action. */
const TEXT_INPUT_TYPES = new Set(['text', 'email', 'tel', 'url', 'search', 'password', 'number']);

/** Non-printable keys worth recording as a `press` when NOT editing a field. */
const NAV_KEYS = new Set([
  'Enter',
  'Tab',
  'Escape',
  'Backspace',
  'Delete',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Home',
  'End',
  'PageUp',
  'PageDown',
]);

/** Keys still meaningful as a `press` while a field is focused. */
const COMMAND_KEYS = new Set(['Enter', 'Tab', 'Escape']);

/** Keys that scroll the page natively — their scroll is reproduced by the recorded press. */
const SCROLL_KEYS = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'PageUp',
  'PageDown',
  'Home',
  'End',
  ' ',
]);

const ACTIONABLE =
  'a[href],button,input,select,textarea,label,summary,[role],[contenteditable=""],[contenteditable="true"],[onclick]';

/** Min pointer travel (px) before a press-drag-release counts as a drag, not a click. */
const DRAG_THRESHOLD = 10;

function emit(action: CapturedAction): void {
  try {
    window.__humanjsEmit?.(action);
  } catch {
    // Binding not ready yet (very early event) — drop it; the next one lands.
  }
}

function resolveActionable(target: EventTarget | null): Element | null {
  if (!(target instanceof Element)) return null;
  return target.closest(ACTIONABLE) ?? target;
}

function targetParams(el: Element): Record<string, unknown> {
  const candidates = inferSelectors(el);
  return { target: candidates[0] ?? '', candidates };
}

function isEditable(el: Element | null): boolean {
  if (!el) return false;
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return true;
  return el instanceof HTMLElement && el.isContentEditable;
}

/**
 * Patch the page's programmatic scroll APIs so each call runs `mark()`. Lets the
 * recorder distinguish a programmatic scroll (SPA scroll-restoration, gallery
 * reset, anchor jump, scroll-to-top button) from a real user scroll. Every
 * wrapper calls through to the original, so page behavior is unchanged.
 */
function patchProgrammaticScroll(mark: () => void): void {
  type AnyFn = (...args: unknown[]) => unknown;
  const wrapMethod = (holder: Record<string, unknown>, name: string): void => {
    const original = holder[name];
    if (typeof original !== 'function') return;
    holder[name] = function (this: unknown, ...args: unknown[]) {
      mark();
      return (original as AnyFn).apply(this, args);
    };
  };

  // `as unknown as Record`: we index these built-ins by scroll-method name.
  const win = window as unknown as Record<string, unknown>;
  const elementProto = Element.prototype as unknown as Record<string, unknown>;
  for (const name of ['scroll', 'scrollTo', 'scrollBy']) wrapMethod(win, name);
  for (const name of ['scroll', 'scrollTo', 'scrollBy', 'scrollIntoView'])
    wrapMethod(elementProto, name);

  for (const prop of ['scrollTop', 'scrollLeft'] as const) {
    const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, prop);
    if (!descriptor?.configurable || typeof descriptor.set !== 'function') continue;
    const originalSet = descriptor.set;
    Object.defineProperty(Element.prototype, prop, {
      ...descriptor,
      set(this: Element, value: number) {
        mark();
        originalSet.call(this, value);
      },
    });
  }
}

interface PendingType {
  readonly params: Record<string, unknown>;
  readonly value: string;
  readonly masked: boolean;
}

export function installRecorder(): void {
  if (window.__humanjsRecording) return;
  window.__humanjsRecording = true;

  // --- Text input: capture via `input` (reliable on SPA fields), debounced,
  // and flushed before any other action so [type, click] order is preserved.
  let pendingType: PendingType | null = null;
  let typeTimer: ReturnType<typeof setTimeout> | undefined;

  // A pointer-drag (e.g. a carousel/slider) often fires a trailing `click` on
  // release. When we record a drag, swallow that follow-up click so it isn't
  // captured as a separate step.
  let suppressNextClick = false;

  // Throttled "a gesture happened" ping. Lets the CLI tell a navigation caused
  // by interaction (clicked link, form submit, search-as-you-type) from a
  // user-driven one (address bar) — only the latter becomes a `goto` step.
  let lastPing = 0;
  function pingNavIntent(): void {
    const now = Date.now();
    if (now - lastPing < 150) return;
    lastPing = now;
    emit({ type: '__navIntent', params: {} });
  }

  // Scroll provenance: a scroll is recorded unless we can attribute it to a
  // programmatic call (patched scroll APIs stamp `lastProgrammaticAt`) or a
  // scroll key (`lastScrollKeyAt`, reproduced by the recorded press). Everything
  // else — wheel, trackpad, touch, AND dragging the scrollbar — is a real user
  // scroll we keep.
  let lastProgrammaticAt = 0;
  let lastScrollKeyAt = 0;
  patchProgrammaticScroll(() => {
    lastProgrammaticAt = Date.now();
  });

  function flushType(): void {
    clearTimeout(typeTimer);
    if (!pendingType) return;
    const { params, value, masked } = pendingType;
    pendingType = null;
    emit({ type: 'type', params, inputValue: masked ? undefined : value });
  }

  /** Flush any pending typed value, then emit a discrete action in order. */
  function emitAction(action: CapturedAction): void {
    flushType();
    emit(action);
  }

  document.addEventListener(
    'input',
    (event) => {
      const el = event.target;
      let value: string | null = null;
      let masked = false;
      if (el instanceof HTMLInputElement && TEXT_INPUT_TYPES.has(el.type)) {
        value = el.value;
        masked = el.type === 'password';
      } else if (el instanceof HTMLTextAreaElement) {
        value = el.value;
      } else if (el instanceof HTMLElement && el.isContentEditable) {
        value = el.textContent ?? '';
      }
      if (value === null || !(el instanceof Element)) return;
      pendingType = { params: targetParams(el), value, masked };
      clearTimeout(typeTimer);
      typeTimer = setTimeout(flushType, 500);
    },
    true,
  );

  // Leaving a field commits its value immediately (before the next interaction).
  document.addEventListener('focusout', () => flushType(), true);

  document.addEventListener(
    'click',
    (event) => {
      if (event.button !== 0) return;
      if (suppressNextClick) {
        suppressNextClick = false;
        return;
      }
      const el = resolveActionable(event.target);
      if (el) emitAction({ type: 'click', params: targetParams(el) });
    },
    true,
  );

  document.addEventListener(
    'contextmenu',
    (event) => {
      const el = resolveActionable(event.target);
      if (el) emitAction({ type: 'rightClick', params: targetParams(el) });
    },
    true,
  );

  // Checkboxes, radios, and <select> commit reliably on `change`. Text inputs
  // are handled by the `input` listener above.
  document.addEventListener(
    'change',
    (event) => {
      const el = event.target;
      if (el instanceof HTMLInputElement) {
        if (el.type === 'checkbox') {
          emitAction({ type: el.checked ? 'check' : 'uncheck', params: targetParams(el) });
        } else if (el.type === 'radio' && el.checked) {
          emitAction({ type: 'check', params: targetParams(el) });
        }
      } else if (el instanceof HTMLSelectElement) {
        const values = Array.from(el.selectedOptions, (option) => option.value);
        emitAction({ type: 'selectOption', params: { ...targetParams(el), values } });
      }
    },
    true,
  );

  document.addEventListener(
    'keydown',
    (event) => {
      pingNavIntent();
      const key = event.key;
      if (key === 'Shift' || key === 'Control' || key === 'Alt' || key === 'Meta') return;

      const editing = isEditable(event.target as Element);

      // A scroll key reproduces its scroll on replay via the recorded press, so
      // mark it to suppress the redundant scroll step it triggers.
      if (!editing && SCROLL_KEYS.has(key)) lastScrollKeyAt = Date.now();

      if (event.metaKey || event.ctrlKey) {
        const parts = ['Mod'];
        if (event.shiftKey) parts.push('Shift');
        if (event.altKey) parts.push('Alt');
        parts.push(key.length === 1 ? key.toUpperCase() : key);
        emitAction({ type: 'press', params: { key: parts.join('+') } });
        return;
      }

      // Plain character typing is captured as `type` — never as a press.
      if (key.length === 1) return;

      if (editing) {
        // Inside a field, only submit/cancel/next-field keys are meaningful;
        // Backspace / Delete / arrows are editing noise.
        if (COMMAND_KEYS.has(key)) emitAction({ type: 'press', params: { key } });
      } else if (NAV_KEYS.has(key)) {
        emitAction({ type: 'press', params: { key } });
      }
    },
    true,
  );

  // --- Drag: native HTML5 DnD plus pointer-based drags (sortables, sliders).
  let dndSource: Element | null = null;
  document.addEventListener('dragstart', (e) => {
    dndSource = resolveActionable(e.target);
  });
  document.addEventListener('drop', (e) => {
    if (dndSource) emitDrag(dndSource, resolveActionable(e.target));
    dndSource = null;
  });
  document.addEventListener('dragend', () => {
    dndSource = null;
  });

  let pointerStart: { x: number; y: number; el: Element | null } | null = null;
  document.addEventListener(
    'pointerdown',
    (event) => {
      pingNavIntent();
      if (event.button !== 0) return;
      pointerStart = { x: event.clientX, y: event.clientY, el: resolveActionable(event.target) };
    },
    true,
  );
  document.addEventListener(
    'pointerup',
    (event) => {
      const start = pointerStart;
      pointerStart = null;
      if (!start) return;
      const distance = Math.hypot(event.clientX - start.x, event.clientY - start.y);
      if (distance < DRAG_THRESHOLD) return; // a click, not a drag
      // A non-empty selection means the user was selecting text, not dragging.
      if ((window.getSelection()?.toString().length ?? 0) > 0) return;
      emitDrag(start.el, resolveActionable(event.target), event.clientX, event.clientY);
    },
    true,
  );
  document.addEventListener(
    'pointercancel',
    () => {
      pointerStart = null;
    },
    true,
  );

  function emitDrag(fromEl: Element | null, toEl: Element | null, x?: number, y?: number): void {
    if (!fromEl) return;
    const from = inferSelectors(fromEl);
    const to = toEl ? inferSelectors(toEl) : [];
    const toTarget =
      to[0] ??
      (x !== undefined && y !== undefined ? `point(${Math.round(x)}, ${Math.round(y)})` : '');
    if (!from[0] || !toTarget) return;
    emitAction({
      type: 'drag',
      params: { from: from[0], to: toTarget, fromCandidates: from, toCandidates: to },
    });
    // Swallow the click some draggable widgets fire on release. Cleared on a
    // short timer so a later genuine click isn't lost if none follows.
    suppressNextClick = true;
    setTimeout(() => {
      suppressNextClick = false;
    }, 400);
  }

  // Record real user scrolls (wheel / trackpad / touch / scrollbar drag) but
  // not the programmatic ones — SPA scroll-restoration on navigation, a gallery
  // resetting scroll on arrow keys, anchor jumps, scroll-to-top buttons — which
  // are already reproduced by the action that caused them. A scroll is "real"
  // unless it lands right after a patched programmatic call or a scroll key.
  let userScrolled = false;
  let scrollTimer: ReturnType<typeof setTimeout> | undefined;
  window.addEventListener(
    'scroll',
    () => {
      const now = Date.now();
      const programmatic = now - lastProgrammaticAt < 150;
      const keyboard = now - lastScrollKeyAt < 600;
      if (!programmatic && !keyboard) userScrolled = true;
      clearTimeout(scrollTimer);
      // Debounce: record where the scroll settled, not every frame.
      scrollTimer = setTimeout(() => {
        if (!userScrolled) return;
        userScrolled = false;
        emit({ type: 'scroll', params: { target: `to:${Math.round(window.scrollY)}` } });
      }, 300);
    },
    { passive: true, capture: true },
  );
}
