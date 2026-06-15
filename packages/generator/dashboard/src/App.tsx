import { Reorder, useDragControls } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import type { AssertKind, ClientMessage, Step } from '../../src/protocol';
import { type Generator, useGenerator } from './api';
import { CodePreview } from './components/CodePreview';
import { Select } from './components/Select';

const ASSERT_KINDS: AssertKind[] = ['visible', 'text', 'url'];

function strParam(step: Step, key: string): string {
  const value = step.params[key];
  return typeof value === 'string' ? value : '';
}

function candidatesOf(step: Step): string[] {
  const value = step.params.candidates;
  return Array.isArray(value) ? (value as string[]) : [];
}

function detailFor(step: Step): string {
  const p = step.params;
  if (typeof step.inputValue === 'string') return JSON.stringify(step.inputValue);
  if (typeof p.from === 'string') return `${p.from} → ${String(p.to ?? '')}`;
  if (typeof p.key === 'string') return p.key;
  if (typeof p.url === 'string') return p.url;
  if (Array.isArray(p.values)) return JSON.stringify(p.values);
  return strParam(step, 'target');
}

function AssertForm({ afterId, send }: { afterId: string; send: Generator['send'] }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<AssertKind>('visible');
  const [target, setTarget] = useState('');
  const [value, setValue] = useState('');

  if (!open) {
    return (
      <button type="button" className="link" onClick={() => setOpen(true)}>
        + assert
      </button>
    );
  }

  const submit = (): void => {
    const message: ClientMessage = {
      type: 'addAssert',
      afterId,
      kind,
      ...(kind !== 'url' && target ? { target } : {}),
      ...(kind !== 'visible' && value ? { value } : {}),
    };
    send(message);
    setOpen(false);
    setTarget('');
    setValue('');
  };

  return (
    <div className="assert-form">
      <Select
        ariaLabel="assertion kind"
        value={kind}
        options={ASSERT_KINDS.map((k) => ({ value: k }))}
        onChange={(v) => setKind(v as AssertKind)}
      />
      {kind !== 'url' && (
        <input
          aria-label="assertion target"
          placeholder="selector"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
        />
      )}
      {kind !== 'visible' && (
        <input
          aria-label="assertion value"
          placeholder={kind === 'url' ? 'url' : 'expected text'}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      )}
      <button type="button" onClick={submit}>
        add
      </button>
      <button type="button" className="link" onClick={() => setOpen(false)}>
        cancel
      </button>
    </div>
  );
}

function StepRow({
  step,
  send,
  onDragStart,
  onDragEnd,
}: {
  step: Step;
  send: Generator['send'];
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const controls = useDragControls();
  const candidates = candidatesOf(step);
  const target = strParam(step, 'target');
  const isText = step.type === 'type' || step.type === 'paste';
  const secret = strParam(step, 'secret');
  const label = strParam(step, 'label');

  return (
    <Reorder.Item
      value={step}
      dragListener={false}
      dragControls={controls}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className="step"
      whileDrag={{ scale: 1.015 }}
    >
      <div className="step-head">
        <button
          type="button"
          className="grip"
          aria-label="drag to reorder"
          onPointerDown={(e) => controls.start(e)}
        >
          ⋮⋮
        </button>
        <span className={`kind kind-${step.type}`}>{step.type}</span>
        <span className="detail">{detailFor(step)}</span>
        <button
          type="button"
          className="del"
          aria-label="delete step"
          onClick={() => send({ type: 'delete', id: step.id })}
        >
          ✕
        </button>
      </div>

      <div className="step-edit">
        {candidates.length > 1 && step.type !== 'assert' && (
          <Select
            className="picker"
            ariaLabel="selector"
            value={target}
            options={candidates.map((c) => ({ value: c }))}
            onChange={(v) => send({ type: 'update', id: step.id, patch: { target: v } })}
          />
        )}

        {isText && (
          <input
            aria-label="value"
            className="value"
            defaultValue={step.inputValue ?? ''}
            placeholder={step.inputValue === undefined ? '(masked)' : ''}
            onBlur={(e) =>
              send({ type: 'update', id: step.id, patch: { inputValue: e.target.value } })
            }
          />
        )}

        {isText && (
          <label className="secret">
            <input
              type="checkbox"
              checked={secret !== ''}
              onChange={(e) =>
                send({
                  type: 'update',
                  id: step.id,
                  patch: { secret: e.target.checked ? 'SECRET' : null },
                })
              }
            />
            secret
            {secret !== '' && (
              <input
                aria-label="env var name"
                className="env"
                defaultValue={secret}
                onBlur={(e) =>
                  send({ type: 'update', id: step.id, patch: { secret: e.target.value || null } })
                }
              />
            )}
          </label>
        )}

        <input
          aria-label="label"
          className="label"
          placeholder="label…"
          defaultValue={label}
          onBlur={(e) => send({ type: 'update', id: step.id, patch: { label: e.target.value } })}
        />

        <AssertForm afterId={step.id} send={send} />
      </div>
    </Reorder.Item>
  );
}

export function App() {
  const { state, connected, exportedPath, send } = useGenerator();
  const [order, setOrder] = useState<Step[]>([]);
  const dragging = useRef(false);
  const editorRef = useRef<HTMLElement>(null);
  // Stick to the bottom as steps stream in — but only if the user is already
  // there. If they scrolled up to inspect a step, leave them be.
  const stickBottom = useRef(true);
  const stepCount = state?.steps.length ?? 0;

  // Mirror the server's step order locally so framer-motion can animate
  // reordering. Don't clobber the local order mid-drag (the server echoes our
  // own reorder back, which would otherwise interrupt the animation).
  useEffect(() => {
    if (state && !dragging.current) setOrder([...state.steps]);
  }, [state]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: fire on step-count change to autoscroll
  useEffect(() => {
    if (!stickBottom.current) return;
    // Wait for the new row to lay out (framer-motion is mid-animation on the
    // same frame) before measuring scrollHeight, or we stop just short.
    const id = requestAnimationFrame(() => {
      const el = editorRef.current;
      if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    });
    return () => cancelAnimationFrame(id);
  }, [stepCount]);

  if (!state) {
    return (
      <main className="empty-state">
        <h1>
          <span className="accent">HumanJS</span> Generator
        </h1>
        <p className="muted">{connected ? 'Waiting for the session…' : 'Connecting…'}</p>
      </main>
    );
  }

  return (
    <div className="layout">
      <section
        className="editor"
        ref={editorRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          stickBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
      >
        <header className="topbar">
          <h1>
            <span className="accent">HumanJS</span> Generator
          </h1>
          <p className="muted target">Recording: {state.targetUrl}</p>
          <div className="controls">
            <div className="field">
              <span>Personality</span>
              <Select
                ariaLabel="personality"
                value={state.personality}
                options={state.personalities.map((p) => ({ value: p }))}
                onChange={(v) => send({ type: 'setPersonality', personality: v })}
              />
            </div>
            <button type="button" onClick={() => send({ type: 'export', format: 'spec' })}>
              Export .spec.ts
            </button>
            <button type="button" onClick={() => send({ type: 'export', format: 'script' })}>
              Export .ts
            </button>
          </div>
          {exportedPath && <p className="saved">Saved {exportedPath}</p>}
        </header>

        {order.length === 0 ? (
          <p className="muted hint">
            No steps yet — interact with the Chromium window. Drag the handle to reorder.
          </p>
        ) : (
          <Reorder.Group
            axis="y"
            values={order}
            onReorder={(next) => {
              setOrder(next);
              send({ type: 'reorder', ids: next.map((s) => s.id) });
            }}
            className="steps"
          >
            {order.map((step) => (
              <StepRow
                key={step.id}
                step={step}
                send={send}
                onDragStart={() => {
                  dragging.current = true;
                }}
                onDragEnd={() => {
                  dragging.current = false;
                }}
              />
            ))}
          </Reorder.Group>
        )}
      </section>

      <section className="preview">
        <header className="preview-head">
          <span className="muted">Live preview · spec</span>
        </header>
        <CodePreview code={state.code} />
      </section>
    </div>
  );
}
