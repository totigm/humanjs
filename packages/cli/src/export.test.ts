import type { Recording } from '@humanjs/playwright';
import { describe, expect, it, vi } from 'vitest';
import { UsageError } from './args';
import { assertRecordFormat, exportRecording, resolveRecordFormat } from './export';

describe('resolveRecordFormat', () => {
  it.each([
    ['clip.mp4', 'video'],
    ['clip.webm', 'video'],
    ['clip.gif', 'gif'],
    ['session.json', 'timeline'],
    ['flow.ts', 'humanjs'],
    ['flow.spec.ts', 'playwright'],
    ['flow.test.ts', 'playwright'],
  ])('maps %s to %s', (name, expected) => {
    expect(resolveRecordFormat(name)).toBe(expected);
  });

  it('prefers the Playwright mapping over the bare .ts one', () => {
    // Both suffixes match; losing this ordering writes every test as a
    // standalone script instead.
    expect(resolveRecordFormat('checkout.spec.ts')).toBe('playwright');
  });

  it('is case-insensitive', () => {
    expect(resolveRecordFormat('CLIP.GIF')).toBe('gif');
  });

  it.each([['clip.avi'], ['clip'], ['clip.mov'], ['clip.txt']])('rejects %s', (name) => {
    expect(resolveRecordFormat(name)).toBeNull();
  });
});

describe('assertRecordFormat', () => {
  it('lists every supported extension when it rejects one', () => {
    expect(() => assertRecordFormat('clip.avi')).toThrow(UsageError);
    expect(() => assertRecordFormat('clip.avi')).toThrow(/\.mp4.*\.gif.*\.json.*\.spec\.ts/s);
  });
});

describe('exportRecording', () => {
  function fakeRecording(): Recording {
    return {
      toVideo: vi.fn().mockResolvedValue(''),
      toGif: vi.fn().mockResolvedValue(''),
      toTimeline: vi.fn().mockResolvedValue(''),
      toPlaywright: vi.fn().mockResolvedValue(''),
      toHumanJS: vi.fn().mockResolvedValue(''),
    } as unknown as Recording;
  }

  it.each([
    ['clip.mp4', 'toVideo'],
    ['clip.gif', 'toGif'],
    ['s.json', 'toTimeline'],
    ['f.spec.ts', 'toPlaywright'],
    ['f.ts', 'toHumanJS'],
  ] as const)('routes %s to %s', async (name, method) => {
    const recording = fakeRecording();
    await exportRecording(recording, name);
    expect(recording[method]).toHaveBeenCalledWith(name);
  });

  it('routes a .spec.ts to the test writer, not the script writer', async () => {
    const recording = fakeRecording();
    await exportRecording(recording, 'checkout.spec.ts');
    expect(recording.toPlaywright).toHaveBeenCalled();
    expect(recording.toHumanJS).not.toHaveBeenCalled();
  });
});
