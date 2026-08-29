/**
 * Per-session observability buffers — console messages and network activity.
 *
 * An agent driving the browser is otherwise blind to everything the page
 * reports about itself: a failed image, a CORS rejection, an uncaught
 * error. Screenshots don't show it and page text doesn't contain it, so
 * without these the only recourse is guessing, or reaching for `curl`
 * outside the browser — which doesn't reproduce the browser's own request
 * context and so misses exactly the failures worth seeing.
 *
 * Both buffers are bounded ring buffers: a long session on a chatty page
 * must not grow without limit. When the cap is hit the oldest entries are
 * dropped and the drop count is reported alongside the results, because
 * "no errors found" and "no errors left in the buffer" are very different
 * answers and an agent must be able to tell them apart.
 *
 * These are read-only observers. They never execute page-supplied code —
 * see the note at the top of `tools/inspection.ts`.
 */

import type { Page } from 'playwright';

/** A console message, or an uncaught page error (level `'pageerror'`). */
export interface ConsoleEntry {
  /** Console type: `log`, `info`, `warn`, `error`, `debug`, … or `pageerror`. */
  readonly level: string;
  readonly text: string;
  /** Source location (`file:line:col`) when the browser reports one. */
  readonly source: string | null;
  /** Epoch ms. */
  readonly at: number;
}

/** A completed network response, or a request that failed before responding. */
export interface NetworkEntry {
  readonly method: string;
  readonly url: string;
  /** HTTP status, or `null` when the request failed before a response. */
  readonly status: number | null;
  /** Playwright's failure text (DNS, CORS, aborted, …), else `null`. */
  readonly failure: string | null;
  /** Playwright resource type: `document`, `xhr`, `fetch`, `image`, … */
  readonly resourceType: string;
  /** Epoch ms the response/failure was observed. */
  readonly at: number;
  /** Round-trip in ms, when the request start was observed. */
  readonly ms: number | null;
}

/**
 * Fixed-capacity FIFO buffer. Oldest entries fall off the front once the
 * cap is reached; {@link dropped} counts how many were lost so callers can
 * say so instead of silently under-reporting.
 */
export class RingBuffer<T> {
  private items: T[] = [];
  private droppedCount = 0;

  constructor(private readonly limit: number) {
    if (limit < 1) throw new Error(`RingBuffer limit must be >= 1, got ${limit}`);
  }

  push(item: T): void {
    this.items.push(item);
    if (this.items.length > this.limit) {
      this.items.shift();
      this.droppedCount += 1;
    }
  }

  toArray(): readonly T[] {
    return this.items;
  }

  /** Entries evicted because the buffer was full. */
  get dropped(): number {
    return this.droppedCount;
  }

  get size(): number {
    return this.items.length;
  }

  clear(): void {
    this.items = [];
    this.droppedCount = 0;
  }
}

/** How many entries each buffer holds before evicting the oldest. */
export const CONSOLE_BUFFER_LIMIT = 500;
export const NETWORK_BUFFER_LIMIT = 500;

/** Console levels treated as "problems" by `onlyErrors`. */
const ERROR_LEVELS = new Set(['error', 'pageerror']);

/**
 * Compiles an AI-supplied filter pattern into a case-insensitive regex.
 * A malformed pattern is a caller mistake, not a server fault, so it fails
 * with a message that says how to fix it rather than a raw regex error.
 */
export function compilePattern(pattern: string): RegExp {
  try {
    return new RegExp(pattern, 'i');
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Invalid \`pattern\` regular expression: ${detail}. Pass a valid JS regex (it is matched case-insensitively), or omit \`pattern\` to see everything.`,
    );
  }
}

export interface ConsoleQuery {
  readonly pattern?: string;
  readonly onlyErrors?: boolean;
  readonly limit?: number;
}

export interface NetworkQuery {
  readonly pattern?: string;
  readonly onlyFailures?: boolean;
  /** Keep only responses with this exact HTTP status. */
  readonly status?: number;
  readonly limit?: number;
}

/** Result of a buffer query: the slice to show, plus what it was drawn from. */
export interface QueryResult<T> {
  readonly entries: readonly T[];
  /** Entries matching the filter, before `limit` was applied. */
  readonly matched: number;
  /** Entries in the buffer before filtering. */
  readonly total: number;
  /** Entries evicted from the buffer entirely. */
  readonly dropped: number;
}

export function queryConsole(
  buffer: RingBuffer<ConsoleEntry>,
  query: ConsoleQuery,
): QueryResult<ConsoleEntry> {
  const all = buffer.toArray();
  const regex = query.pattern ? compilePattern(query.pattern) : null;
  const matches = all.filter((entry) => {
    if (query.onlyErrors && !ERROR_LEVELS.has(entry.level)) return false;
    if (regex && !regex.test(entry.text)) return false;
    return true;
  });
  return {
    entries: takeLast(matches, query.limit),
    matched: matches.length,
    total: all.length,
    dropped: buffer.dropped,
  };
}

export function queryNetwork(
  buffer: RingBuffer<NetworkEntry>,
  query: NetworkQuery,
): QueryResult<NetworkEntry> {
  const all = buffer.toArray();
  const regex = query.pattern ? compilePattern(query.pattern) : null;
  const matches = all.filter((entry) => {
    if (query.onlyFailures && !isFailure(entry)) return false;
    if (query.status !== undefined && entry.status !== query.status) return false;
    if (regex && !regex.test(entry.url)) return false;
    return true;
  });
  return {
    entries: takeLast(matches, query.limit),
    matched: matches.length,
    total: all.length,
    dropped: buffer.dropped,
  };
}

/** A request that never responded, or answered 4xx/5xx. */
export function isFailure(entry: NetworkEntry): boolean {
  if (entry.failure !== null) return true;
  return entry.status !== null && entry.status >= 400;
}

/**
 * The most recent `limit` entries. Recency is what matters when
 * debugging — the failure you just triggered is at the end, not the start.
 */
function takeLast<T>(items: readonly T[], limit: number | undefined): readonly T[] {
  if (limit === undefined || items.length <= limit) return items;
  return items.slice(items.length - limit);
}

/**
 * Renders a console query as compact text for the agent.
 *
 * The footer is not decoration: it distinguishes "the page logged nothing"
 * from "the buffer overflowed and the evidence is gone", which changes what
 * the agent should do next.
 */
export function formatConsole(result: QueryResult<ConsoleEntry>): string {
  if (result.entries.length === 0) return emptyMessage('console messages', result);
  const lines = result.entries.map((entry) => {
    const where = entry.source ? `  (${entry.source})` : '';
    return `[${entry.level}] ${entry.text}${where}`;
  });
  return [...lines, '', summary('message', result)].join('\n');
}

/** Renders a network query as compact text for the agent. */
export function formatNetwork(result: QueryResult<NetworkEntry>): string {
  if (result.entries.length === 0) return emptyMessage('network requests', result);
  const lines = result.entries.map((entry) => {
    const status = entry.failure !== null ? `FAILED (${entry.failure})` : String(entry.status);
    const timing = entry.ms === null ? '' : ` ${entry.ms}ms`;
    return `${status} ${entry.method} ${entry.url} [${entry.resourceType}]${timing}`;
  });
  return [...lines, '', summary('request', result)].join('\n');
}

function emptyMessage(noun: string, result: QueryResult<unknown>): string {
  if (result.total === 0 && result.dropped === 0) {
    return `No ${noun} captured yet for this session.`;
  }
  const dropped =
    result.dropped > 0
      ? ` ${result.dropped} older ${noun} were dropped from the buffer, so this is not proof they never happened.`
      : '';
  return `No ${noun} matched the filter (${result.total} in the buffer).${dropped}`;
}

function summary(noun: string, result: QueryResult<unknown>): string {
  const shown =
    result.entries.length < result.matched
      ? `showing the ${result.entries.length} most recent of ${result.matched} matching ${noun}s`
      : `${result.matched} matching ${noun}${result.matched === 1 ? '' : 's'}`;
  const dropped = result.dropped > 0 ? `; ${result.dropped} older dropped (buffer full)` : '';
  return `— ${shown} of ${result.total} captured${dropped}`;
}

/** The pair of buffers a session observes through. */
export interface SessionObservers {
  readonly console: RingBuffer<ConsoleEntry>;
  readonly network: RingBuffer<NetworkEntry>;
}

/**
 * Subscribes to a page's console and network events, filling bounded
 * buffers the inspection tools read from later.
 *
 * Listeners are attached once per session page and live as long as it
 * does, so events raised between tool calls — which is most of them — are
 * still captured. Playwright keeps page listeners across navigations, so
 * a `goto` does not silently stop the recording.
 *
 * Request start times live in a `WeakMap` keyed by the request object: it
 * gives round-trip timing without an unbounded Map of requests that never
 * completed, since entries vanish when the request is garbage collected.
 */
export function attachObservers(page: Page): SessionObservers {
  const consoleBuffer = new RingBuffer<ConsoleEntry>(CONSOLE_BUFFER_LIMIT);
  const networkBuffer = new RingBuffer<NetworkEntry>(NETWORK_BUFFER_LIMIT);
  const startedAt = new WeakMap<object, number>();

  page.on('console', (message) => {
    const location = message.location();
    const source = location.url
      ? `${location.url}:${location.lineNumber}:${location.columnNumber}`
      : null;
    consoleBuffer.push({
      level: message.type(),
      text: message.text(),
      source,
      at: Date.now(),
    });
  });

  // An uncaught exception never reaches page.on('console'), and it is the
  // single most useful thing to surface — so it is folded into the same
  // buffer under its own level rather than needing a separate tool.
  page.on('pageerror', (error) => {
    consoleBuffer.push({
      level: 'pageerror',
      text: error.stack ?? `${error.name}: ${error.message}`,
      source: null,
      at: Date.now(),
    });
  });

  page.on('request', (request) => {
    startedAt.set(request, Date.now());
  });

  page.on('response', (response) => {
    const request = response.request();
    const start = startedAt.get(request);
    networkBuffer.push({
      method: request.method(),
      url: response.url(),
      status: response.status(),
      failure: null,
      resourceType: request.resourceType(),
      at: Date.now(),
      ms: start === undefined ? null : Date.now() - start,
    });
  });

  page.on('requestfailed', (request) => {
    const start = startedAt.get(request);
    networkBuffer.push({
      method: request.method(),
      url: request.url(),
      status: null,
      failure: request.failure()?.errorText ?? 'request failed',
      resourceType: request.resourceType(),
      at: Date.now(),
      ms: start === undefined ? null : Date.now() - start,
    });
  });

  return { console: consoleBuffer, network: networkBuffer };
}
