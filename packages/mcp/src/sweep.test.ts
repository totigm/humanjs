import type { Locator } from 'playwright';
import { describe, expect, it } from 'vitest';
import { type SweepRead, sweepBody, sweepRead, sweepSummary } from './sweep';

/** A locator stand-in whose read resolves or rejects on command. */
function fakeLocator(): Locator {
  return {} as Locator;
}

const ok = <T>(value: T): SweepRead<T> => ({ ok: true, value });
const failed: SweepRead<never> = { ok: false };

describe('sweepRead', () => {
  it('keeps the readings that succeed when one element fails', async () => {
    const elements = [fakeLocator(), fakeLocator(), fakeLocator()];
    const readings = await sweepRead(elements, (_element) => {
      const index = elements.indexOf(_element);
      return index === 1
        ? Promise.reject(new Error('locator.innerText: Timeout 2000ms exceeded'))
        : Promise.resolve(`value-${index}`);
    });
    // The whole point: a Promise.all here would have thrown away
    // value-0 and value-2 along with the failure.
    expect(readings).toEqual([ok('value-0'), failed, ok('value-2')]);
  });

  it('reads every element rather than stopping at the first failure', async () => {
    let reads = 0;
    const readings = await sweepRead([fakeLocator(), fakeLocator(), fakeLocator()], () => {
      reads += 1;
      return Promise.reject(new Error('gone'));
    });
    expect(reads).toBe(3);
    expect(readings).toEqual([failed, failed, failed]);
  });

  it('keeps document order, not the order the reads finished in', async () => {
    const elements = [fakeLocator(), fakeLocator(), fakeLocator()];
    const delays = [20, 0, 10];
    const readings = await sweepRead(elements, (element) => {
      const index = elements.indexOf(element);
      return new Promise((resolve) => {
        setTimeout(() => resolve(`value-${index}`), delays[index]);
      });
    });
    // Reads run in parallel and finish out of order; the agent indexes
    // these rows against the page, so position must follow the DOM.
    expect(readings).toEqual([ok('value-0'), ok('value-1'), ok('value-2')]);
  });

  it('returns nothing for no matches', async () => {
    expect(await sweepRead([], () => Promise.resolve('x'))).toEqual([]);
  });
});

describe('sweepBody', () => {
  it('indexes each reading so the agent can refer back to one', () => {
    expect(sweepBody([ok('alpha'), ok('gamma')], (value) => value)).toBe('[0] alpha\n[1] gamma');
  });

  it('marks an unreadable element in place, keeping the indexes honest', () => {
    const body = sweepBody([ok('alpha'), failed, ok('gamma')], (value) => value);
    expect(body.split('\n')[1]).toBe('[1] (unreadable — the page replaced this element mid-sweep)');
    // [2] must still be [2]: the agent counts rows against the page.
    expect(body.split('\n')[2]).toBe('[2] gamma');
  });

  it('distinguishes an absent attribute from an unreadable element', () => {
    const body = sweepBody<string | null>([ok(null), failed], (value) => value ?? '(absent)');
    expect(body).toBe('[0] (absent)\n[1] (unreadable — the page replaced this element mid-sweep)');
  });

  it('separates outerHTML dumps by a blank line', () => {
    expect(sweepBody([ok('<p>a</p>'), ok('<p>b</p>')], (value) => value, '\n\n')).toBe(
      '[0] <p>a</p>\n\n[1] <p>b</p>',
    );
  });
});

describe('sweepSummary', () => {
  it('reports a complete sweep', () => {
    expect(sweepSummary([ok('a'), ok('b')], 2, 'li')).toBe('— 2 elements matched li');
  });

  it('uses the singular for a lone match', () => {
    expect(sweepSummary([ok('a')], 1, 'h1')).toBe('— 1 element matched h1');
  });

  it('says when it is showing a slice, and how to see more', () => {
    expect(sweepSummary([ok('a'), ok('b')], 40, 'li')).toBe(
      '— showing the first 2 of 40 elements matching li; raise `limit` to see more',
    );
  });

  it('reports unreadable elements — a quiet sweep is not a clean page', () => {
    expect(sweepSummary([ok('a'), failed, failed], 3, 'li')).toBe(
      '— 3 elements matched li; 2 could not be read — re-run if you need them',
    );
  });

  it('uses the singular when a single element could not be read', () => {
    expect(sweepSummary([ok('a'), failed], 2, 'li')).toBe(
      '— 2 elements matched li; 1 could not be read — re-run if you need it',
    );
  });
});
