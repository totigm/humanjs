import { describe, expect, it } from 'vitest';
import { UsageError } from '../args';
import { selectFlow } from './run';

describe('selectFlow', () => {
  const flow = async (): Promise<void> => {};

  it('prefers the default export', () => {
    expect(selectFlow({ default: flow }, 'f.ts')).toBe(flow);
  });

  it('falls back to a named run export', () => {
    expect(selectFlow({ run: flow }, 'f.ts')).toBe(flow);
  });

  it('prefers default when both are present', () => {
    const other = async (): Promise<void> => {};
    expect(selectFlow({ default: flow, run: other }, 'f.ts')).toBe(flow);
  });

  it('explains the expected shape instead of failing later on a call', () => {
    expect(() => selectFlow({}, 'flow.ts')).toThrow(UsageError);
    expect(() => selectFlow({}, 'flow.ts')).toThrow(
      /flow.ts does not export a flow.*export default async \(human\)/s,
    );
  });

  it('rejects a non-callable export rather than trusting it', () => {
    expect(() => selectFlow({ default: { goto: true } }, 'f.ts')).toThrow(/does not export a flow/);
  });
});
