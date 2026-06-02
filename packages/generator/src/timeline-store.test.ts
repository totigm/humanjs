import type { TimelineEvent } from '@humanjs/playwright';
import { describe, expect, it } from 'vitest';
import { TimelineStore } from './timeline-store';

function ev(
  type: string,
  params: Record<string, unknown> = {},
  inputValue?: string,
): TimelineEvent {
  return {
    type,
    params,
    tMs: 0,
    durationMs: 0,
    ...(inputValue === undefined ? {} : { inputValue }),
  };
}

function seed(...types: string[]): TimelineStore {
  const store = new TimelineStore();
  for (const t of types) store.append(ev(t, { target: `#${t}` }));
  return store;
}

describe('TimelineStore', () => {
  it('assigns stable, unique ids on append', () => {
    const store = seed('click', 'type');
    const ids = store.list().map((s) => s.id);
    expect(ids).toEqual(['s1', 's2']);
  });

  it('deletes by id', () => {
    const store = seed('click', 'type', 'press');
    const [, second] = store.list();
    store.delete(second?.id ?? '');
    expect(store.list().map((s) => s.type)).toEqual(['click', 'press']);
  });

  it('moves a step to a new index', () => {
    const store = seed('a', 'b', 'c');
    const last = store.list()[2];
    store.move(last?.id ?? '', 0);
    expect(store.list().map((s) => s.type)).toEqual(['c', 'a', 'b']);
  });

  it('clamps an out-of-range move', () => {
    const store = seed('a', 'b');
    const first = store.list()[0];
    store.move(first?.id ?? '', 99);
    expect(store.list().map((s) => s.type)).toEqual(['b', 'a']);
  });

  it('updates the chosen selector, label, and value', () => {
    const store = seed('type');
    const id = store.list()[0]?.id ?? '';
    store.update(id, {
      target: 'role=textbox[name="Email"]',
      label: 'enter email',
      inputValue: 'a@b.com',
    });
    const step = store.list()[0];
    expect(step?.params.target).toBe('role=textbox[name="Email"]');
    expect(step?.params.label).toBe('enter email');
    expect(step?.inputValue).toBe('a@b.com');
  });

  it('sets and clears a secret flag', () => {
    const store = seed('type');
    const id = store.list()[0]?.id ?? '';
    store.update(id, { secret: 'API_TOKEN' });
    expect(store.list()[0]?.params.secret).toBe('API_TOKEN');
    store.update(id, { secret: null });
    expect(store.list()[0]?.params.secret).toBeUndefined();
  });

  it('inserts an assertion after a given step', () => {
    const store = seed('click', 'press');
    const firstId = store.list()[0]?.id ?? '';
    store.addAssert(firstId, 'visible', '.banner');
    expect(store.list().map((s) => s.type)).toEqual(['click', 'assert', 'press']);
    expect(store.list()[1]?.params).toEqual({ kind: 'visible', target: '.banner' });
  });

  it('appends an assertion at the end when afterId is null', () => {
    const store = seed('click');
    store.addAssert(null, 'url', undefined, '/done');
    const last = store.list().at(-1);
    expect(last?.type).toBe('assert');
    expect(last?.params).toEqual({ kind: 'url', value: '/done' });
  });
});
