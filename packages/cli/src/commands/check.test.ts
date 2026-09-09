import { describe, expect, it } from 'vitest';
import { CONDITIONS, describeResult, fingerprint } from './check';

describe('CONDITIONS', () => {
  it('starts from a baseline with no emulation', () => {
    expect(CONDITIONS[0]?.name).toBe('baseline');
    expect(CONDITIONS[0]?.media).toBeNull();
  });

  it('marks reduced-motion as not provable from a still', () => {
    // The difference is in movement, not layout — claiming otherwise
    // would report "identical to baseline" as though it meant something.
    const reduced = CONDITIONS.find((c) => c.name === 'reduced-motion');
    expect(reduced?.visibleInStill).toBe(false);
  });

  it('treats every other condition as visible in a still', () => {
    for (const condition of CONDITIONS.filter((c) => c.name !== 'reduced-motion')) {
      expect(condition.visibleInStill).toBe(true);
    }
  });
});

describe('fingerprint', () => {
  it('is stable for identical bytes', () => {
    expect(fingerprint(Buffer.from('abc'))).toBe(fingerprint(Buffer.from('abc')));
  });

  it('differs for different bytes', () => {
    expect(fingerprint(Buffer.from('abc'))).not.toBe(fingerprint(Buffer.from('abd')));
  });
});

describe('describeResult', () => {
  const base = { file: 'out/x.png', changed: false, visibleInStill: true };

  it('states the baseline plainly, with no verdict', () => {
    const line = describeResult({ ...base, name: 'baseline' });
    expect(line).toContain('out/x.png');
    expect(line).not.toContain('identical');
  });

  it('flags a condition the page ignores', () => {
    expect(describeResult({ ...base, name: 'dark' })).toContain(
      'identical to baseline — the page may have no branch for it',
    );
  });

  it('confirms a condition the page responds to', () => {
    expect(describeResult({ ...base, name: 'dark', changed: true })).toContain(
      'renders differently from baseline',
    );
  });

  it('refuses to render a verdict for reduced motion', () => {
    const line = describeResult({ ...base, name: 'reduced-motion', visibleInStill: false });
    expect(line).toContain('a still cannot show this');
    expect(line).toContain('--reduced-motion --record');
    expect(line).not.toContain('identical to baseline');
  });
});
