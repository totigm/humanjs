import { AnimatePresence, motion } from 'framer-motion';
import { type KeyboardEvent, useEffect, useRef, useState } from 'react';

export interface SelectOption {
  readonly value: string;
  readonly label?: string;
}

/**
 * Themed dropdown that replaces the native `<select>` so it matches the app's
 * dark/emerald styling. Keyboard accessible (Arrow / Enter / Escape), closes on
 * outside click, and animates open with framer-motion.
 */
export function Select({
  value,
  options,
  onChange,
  ariaLabel,
  placeholder,
  className,
}: {
  value: string;
  options: readonly SelectOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const current = options.find((o) => o.value === value);
  const display = current?.label ?? current?.value ?? placeholder ?? '';

  // Open downward when there's room, otherwise upward — measured against the
  // trigger's position at open time.
  const openMenu = (): void => {
    const rect = ref.current?.getBoundingClientRect();
    if (rect) {
      const panel = Math.min(256, options.length * 33 + 8);
      const below = window.innerHeight - rect.bottom;
      setDropUp(below < panel + 8 && rect.top > below);
    }
    setActive(
      Math.max(
        0,
        options.findIndex((o) => o.value === value),
      ),
    );
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const choose = (v: string): void => {
    onChange(v);
    setOpen(false);
  };

  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      setOpen(false);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) {
        openMenu();
        return;
      }
      setActive((a) => {
        const next = e.key === 'ArrowDown' ? a + 1 : a - 1;
        return Math.max(0, Math.min(next, options.length - 1));
      });
    } else if ((e.key === 'Enter' || e.key === ' ') && open) {
      e.preventDefault();
      const opt = options[active];
      if (opt) choose(opt.value);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openMenu();
    }
  };

  return (
    <div className={`select${className ? ` ${className}` : ''}`} ref={ref}>
      <button
        type="button"
        className="select-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onKeyDown}
      >
        <span className="select-value">{display}</span>
        <span className="select-caret" aria-hidden>
          ▾
        </span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul
            className={`select-list${dropUp ? ' drop-up' : ''}`}
            aria-label={ariaLabel}
            initial={{ opacity: 0, y: dropUp ? 4 : -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: dropUp ? 4 : -4 }}
            transition={{ duration: 0.12, ease: 'easeOut' }}
          >
            {options.map((o, i) => (
              <li key={o.value}>
                <button
                  type="button"
                  aria-pressed={o.value === value}
                  className={[
                    'select-opt',
                    o.value === value ? 'is-selected' : '',
                    i === active ? 'is-active' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(o.value)}
                >
                  {o.label ?? o.value}
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
