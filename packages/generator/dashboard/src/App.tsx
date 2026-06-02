import { useState } from 'react';
import type { AssertKind, ClientMessage, Step } from '../../src/protocol';
import { type Generator, useGenerator } from './api';

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
      <select
        aria-label="assertion kind"
        value={kind}
        onChange={(e) => setKind(e.target.value as AssertKind)}
      >
        {ASSERT_KINDS.map((k) => (
          <option key={k} value={k}>
            {k}
          </option>
        ))}
      </select>
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
  index,
  send,
  onMove,
}: {
  step: Step;
  index: number;
  send: Generator['send'];
  onMove: (draggedId: string, toIndex: number) => void;
}) {
  const candidates = candidatesOf(step);
  const target = strParam(step, 'target');
  const isText = step.type === 'type' || step.type === 'paste';
  const secret = strParam(step, 'secret');
  const label = strParam(step, 'label');

  return (
    <li
      className="step"
      draggable
      onDragStart={(e) => e.dataTransfer.setData('text/plain', step.id)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const draggedId = e.dataTransfer.getData('text/plain');
        if (draggedId && draggedId !== step.id) onMove(draggedId, index);
      }}
    >
      <div className="step-head">
        <span className="grip" aria-hidden>
          ⋮⋮
        </span>
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
          <select
            aria-label="selector"
            value={target}
            onChange={(e) =>
              send({ type: 'update', id: step.id, patch: { target: e.target.value } })
            }
          >
            {candidates.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
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
    </li>
  );
}

export function App() {
  const { state, connected, exportedPath, send } = useGenerator();

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
      <section className="editor">
        <header className="topbar">
          <h1>
            <span className="accent">HumanJS</span> Generator
          </h1>
          <p className="muted target">Recording: {state.targetUrl}</p>
          <div className="controls">
            <label className="field">
              Personality
              <select
                value={state.personality}
                onChange={(e) => send({ type: 'setPersonality', personality: e.target.value })}
              >
                {state.personalities.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" onClick={() => send({ type: 'export', format: 'spec' })}>
              Export .spec.ts
            </button>
            <button type="button" onClick={() => send({ type: 'export', format: 'script' })}>
              Export .ts
            </button>
          </div>
          {exportedPath && <p className="saved">Saved {exportedPath}</p>}
        </header>

        {state.steps.length === 0 ? (
          <p className="muted hint">
            No steps yet — interact with the Chromium window. Drag rows to reorder.
          </p>
        ) : (
          <ul className="steps">
            {state.steps.map((step, index) => (
              <StepRow
                key={step.id}
                step={step}
                index={index}
                send={send}
                onMove={(draggedId, toIndex) => send({ type: 'move', id: draggedId, toIndex })}
              />
            ))}
          </ul>
        )}
      </section>

      <section className="preview">
        <header className="preview-head">
          <span className="muted">Live preview · spec</span>
        </header>
        <pre className="code">{state.code}</pre>
      </section>
    </div>
  );
}
