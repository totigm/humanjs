import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveOutputPath, resolveRecordingFormat, resolveUploadPath } from './output';

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

describe('resolveUploadPath', () => {
  const UP = '/upload/dir';

  it('joins a plain basename to the upload dir', () => {
    expect(resolveUploadPath(UP, 'photo.png')).toBe(join(UP, 'photo.png'));
  });

  it('rejects parent-traversal, nested, absolute, and empty names', () => {
    expect(() => resolveUploadPath(UP, '../../etc/passwd')).toThrow(/path components/i);
    expect(() => resolveUploadPath(UP, 'sub/photo.png')).toThrow(/path components/i);
    expect(() => resolveUploadPath(UP, '/etc/passwd')).toThrow(/path components/i);
    expect(() => resolveUploadPath(UP, '')).toThrow(/path components/i);
  });
});

describe('resolveRecordingFormat', () => {
  it('maps media + timeline extensions', () => {
    expect(resolveRecordingFormat('demo.mp4')).toBe('video');
    expect(resolveRecordingFormat('demo.webm')).toBe('video');
    expect(resolveRecordingFormat('demo.gif')).toBe('gif');
    expect(resolveRecordingFormat('demo.json')).toBe('timeline');
  });

  it('distinguishes HumanJS scripts from Playwright specs by suffix', () => {
    expect(resolveRecordingFormat('session.ts')).toBe('humanjs');
    expect(resolveRecordingFormat('checkout.spec.ts')).toBe('playwright');
    expect(resolveRecordingFormat('checkout.test.ts')).toBe('playwright');
  });

  it('is case-insensitive', () => {
    expect(resolveRecordingFormat('DEMO.MP4')).toBe('video');
    expect(resolveRecordingFormat('Checkout.Spec.TS')).toBe('playwright');
  });

  it('returns null for unsupported extensions', () => {
    expect(resolveRecordingFormat('demo.txt')).toBeNull();
    expect(resolveRecordingFormat('demo')).toBeNull();
    expect(resolveRecordingFormat('demo.tsx')).toBeNull();
  });
});
