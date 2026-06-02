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

const ACTIONABLE =
  'a[href],button,input,select,textarea,label,summary,[role],[contenteditable=""],[contenteditable="true"],[onclick]';

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

function emitType(el: HTMLInputElement | HTMLTextAreaElement): void {
  const isPassword = el instanceof HTMLInputElement && el.type === 'password';
  emit({
    type: 'type',
    params: targetParams(el),
    // Passwords are masked: omit the value entirely (mirrors the recorder).
    inputValue: isPassword ? undefined : el.value,
  });
}

export function installRecorder(): void {
  if (window.__humanjsRecording) return;
  window.__humanjsRecording = true;

  document.addEventListener(
    'click',
    (event) => {
      if (event.button !== 0) return;
      const el = resolveActionable(event.target);
      if (el) emit({ type: 'click', params: targetParams(el) });
    },
    true,
  );

  document.addEventListener(
    'contextmenu',
    (event) => {
      const el = resolveActionable(event.target);
      if (el) emit({ type: 'rightClick', params: targetParams(el) });
    },
    true,
  );

  document.addEventListener(
    'change',
    (event) => {
      const el = event.target;
      if (el instanceof HTMLInputElement) {
        if (el.type === 'checkbox') {
          emit({ type: el.checked ? 'check' : 'uncheck', params: targetParams(el) });
        } else if (el.type === 'radio') {
          if (el.checked) emit({ type: 'check', params: targetParams(el) });
        } else {
          emitType(el);
        }
      } else if (el instanceof HTMLTextAreaElement) {
        emitType(el);
      } else if (el instanceof HTMLSelectElement) {
        const values = Array.from(el.selectedOptions, (option) => option.value);
        emit({ type: 'selectOption', params: { ...targetParams(el), values } });
      }
    },
    true,
  );

  document.addEventListener(
    'keydown',
    (event) => {
      const key = event.key;
      if (key === 'Shift' || key === 'Control' || key === 'Alt' || key === 'Meta') return;

      const chord = event.metaKey || event.ctrlKey;
      const printable = key.length === 1;

      // Plain typing into a field is captured on `change` — don't also record
      // every character as a press.
      if (!chord && printable && isEditable(event.target as Element)) return;

      if (chord) {
        const parts = ['Mod'];
        if (event.shiftKey) parts.push('Shift');
        if (event.altKey) parts.push('Alt');
        parts.push(printable ? key.toUpperCase() : key);
        emit({ type: 'press', params: { key: parts.join('+') } });
      } else if (NAV_KEYS.has(key)) {
        emit({ type: 'press', params: { key } });
      }
    },
    true,
  );

  let scrollTimer: ReturnType<typeof setTimeout> | undefined;
  window.addEventListener(
    'scroll',
    () => {
      clearTimeout(scrollTimer);
      // Debounce: record where the scroll settled, not every frame.
      scrollTimer = setTimeout(() => {
        emit({ type: 'scroll', params: { target: `to:${Math.round(window.scrollY)}` } });
      }, 300);
    },
    { passive: true, capture: true },
  );
}
