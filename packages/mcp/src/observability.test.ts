import { describe, expect, it } from 'vitest';
import {
  type ConsoleEntry,
  compilePattern,
  formatConsole,
  formatNetwork,
  isFailure,
  type NetworkEntry,
  queryConsole,
  queryNetwork,
  RingBuffer,
} from './observability';

function consoleEntry(over: Partial<ConsoleEntry> = {}): ConsoleEntry {
  return { level: 'log', text: 'hello', source: null, at: 0, ...over };
}

function networkEntry(over: Partial<NetworkEntry> = {}): NetworkEntry {
  return {
    method: 'GET',
    url: 'https://example.com/a.png',
    status: 200,
    failure: null,
    resourceType: 'image',
    at: 0,
    ms: 12,
    ...over,
  };
}

function fill<T>(limit: number, items: readonly T[]): RingBuffer<T> {
  const buffer = new RingBuffer<T>(limit);
  for (const item of items) buffer.push(item);
  return buffer;
}

describe('RingBuffer', () => {
  it('keeps every entry while under the limit', () => {
    const buffer = fill(3, [1, 2]);
    expect(buffer.toArray()).toEqual([1, 2]);
    expect(buffer.dropped).toBe(0);
    expect(buffer.size).toBe(2);
  });

  it('evicts the oldest entries once full and counts the drops', () => {
    const buffer = fill(3, [1, 2, 3, 4, 5]);
    expect(buffer.toArray()).toEqual([3, 4, 5]);
    expect(buffer.dropped).toBe(2);
    expect(buffer.size).toBe(3);
  });

  it('resets both entries and the drop count on clear', () => {
    const buffer = fill(2, [1, 2, 3]);
    buffer.clear();
    expect(buffer.toArray()).toEqual([]);
    expect(buffer.dropped).toBe(0);
  });

  it('rejects a nonsensical limit rather than silently misbehaving', () => {
    expect(() => new RingBuffer(0)).toThrow(/limit must be >= 1/);
  });
});

describe('compilePattern', () => {
  it('matches case-insensitively', () => {
    expect(compilePattern('cors').test('Blocked by CORS policy')).toBe(true);
  });

  it('explains how to fix a malformed pattern', () => {
    expect(() => compilePattern('[unclosed')).toThrow(/Invalid `pattern`/);
  });
});

describe('queryConsole', () => {
  const buffer = fill(10, [
    consoleEntry({ level: 'log', text: 'boot' }),
    consoleEntry({ level: 'warn', text: 'deprecated api' }),
    consoleEntry({ level: 'error', text: 'CORS blocked for logo.png' }),
    consoleEntry({ level: 'pageerror', text: 'TypeError: x is not a function' }),
  ]);

  it('returns everything when unfiltered', () => {
    const result = queryConsole(buffer, {});
    expect(result.entries).toHaveLength(4);
    expect(result.total).toBe(4);
  });

  it('treats uncaught page errors as errors, not just console.error', () => {
    const result = queryConsole(buffer, { onlyErrors: true });
    expect(result.entries.map((e) => e.level)).toEqual(['error', 'pageerror']);
  });

  it('filters by pattern against the message text', () => {
    const result = queryConsole(buffer, { pattern: 'cors' });
    expect(result.entries).toHaveLength(1);
    expect(result.matched).toBe(1);
    expect(result.total).toBe(4);
  });

  it('keeps the most recent entries when limiting, not the oldest', () => {
    const result = queryConsole(buffer, { limit: 2 });
    expect(result.entries.map((e) => e.level)).toEqual(['error', 'pageerror']);
    expect(result.matched).toBe(4);
  });
});

describe('queryNetwork', () => {
  const buffer = fill(10, [
    networkEntry({ url: 'https://example.com/ok.png', status: 200 }),
    networkEntry({ url: 'https://cdn.example.com/missing.png', status: 404 }),
    networkEntry({ url: 'https://api.example.com/data', status: null, failure: 'net::ERR_FAILED' }),
  ]);

  it('counts both 4xx/5xx and never-responded requests as failures', () => {
    const result = queryNetwork(buffer, { onlyFailures: true });
    expect(result.entries).toHaveLength(2);
  });

  it('filters by exact status', () => {
    const result = queryNetwork(buffer, { status: 404 });
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]?.url).toContain('missing.png');
  });

  it('filters by pattern against the URL', () => {
    const result = queryNetwork(buffer, { pattern: 'cdn\\.' });
    expect(result.entries).toHaveLength(1);
  });
});

describe('isFailure', () => {
  it.each([
    [networkEntry({ status: 200 }), false],
    [networkEntry({ status: 302 }), false],
    [networkEntry({ status: 404 }), true],
    [networkEntry({ status: 500 }), true],
    [networkEntry({ status: null, failure: 'net::ERR_ABORTED' }), true],
  ])('classifies %o as failure=%s', (entry, expected) => {
    expect(isFailure(entry)).toBe(expected);
  });
});

describe('formatting', () => {
  it('distinguishes an empty buffer from a filter that matched nothing', () => {
    const empty = new RingBuffer<ConsoleEntry>(5);
    expect(formatConsole(queryConsole(empty, {}))).toMatch(/No console messages captured yet/);

    const populated = fill(5, [consoleEntry({ text: 'boot' })]);
    expect(formatConsole(queryConsole(populated, { pattern: 'nope' }))).toMatch(
      /No console messages matched the filter \(1 in the buffer\)/,
    );
  });

  it('warns that dropped entries make a negative result inconclusive', () => {
    const overflowed = fill(1, [consoleEntry({ text: 'a' }), consoleEntry({ text: 'b' })]);
    const text = formatConsole(queryConsole(overflowed, { pattern: 'zzz' }));
    expect(text).toMatch(/not proof they never happened/);
  });

  it('renders a console entry with its level and source', () => {
    const buffer = fill(5, [consoleEntry({ level: 'error', text: 'boom', source: 'app.js:10:5' })]);
    const text = formatConsole(queryConsole(buffer, {}));
    expect(text).toContain('[error] boom  (app.js:10:5)');
    expect(text).toContain('1 matching message of 1 captured');
  });

  it('renders a failed request without pretending it had a status', () => {
    const buffer = fill(5, [networkEntry({ status: null, failure: 'net::ERR_FAILED', ms: null })]);
    const text = formatNetwork(queryNetwork(buffer, {}));
    expect(text).toContain('FAILED (net::ERR_FAILED) GET');
    expect(text).not.toContain('null');
  });

  it('says when it is showing only the most recent slice', () => {
    const buffer = fill(10, [
      networkEntry({ url: 'https://a.test/1' }),
      networkEntry({ url: 'https://a.test/2' }),
      networkEntry({ url: 'https://a.test/3' }),
    ]);
    const text = formatNetwork(queryNetwork(buffer, { limit: 2 }));
    expect(text).toContain('showing the 2 most recent of 3 matching requests');
  });
});
