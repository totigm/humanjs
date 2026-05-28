import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveOutputPath } from './output';

describe('resolveOutputPath', () => {
  const OUT = '/out/dir';

  it('joins a plain basename to the output dir', () => {
    expect(resolveOutputPath(OUT, 'shot.png')).toBe(join(OUT, 'shot.png'));
    expect(resolveOutputPath(OUT, 'demo.mp4')).toBe(join(OUT, 'demo.mp4'));
  });

  it('rejects parent-traversal names', () => {
    expect(() => resolveOutputPath(OUT, '../escape.png')).toThrow(/path components/i);
    expect(() => resolveOutputPath(OUT, '../../etc/passwd')).toThrow(/path components/i);
  });

  it('rejects nested paths', () => {
    expect(() => resolveOutputPath(OUT, 'sub/dir/x.png')).toThrow(/path components/i);
  });

  it('rejects absolute paths', () => {
    expect(() => resolveOutputPath(OUT, '/abs/x.png')).toThrow(/path components/i);
  });

  it('rejects an empty name', () => {
    expect(() => resolveOutputPath(OUT, '')).toThrow(/path components/i);
  });
});
