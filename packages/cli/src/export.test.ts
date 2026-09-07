import type { Recording } from '@humanjs/playwright';
import { describe, expect, it, vi } from 'vitest';
import { UsageError } from './args';
import {
  assertRecordFormat,
  exportRecording,
  resolveRecordFormat,
  suffixFilename,
  viewportSuffix,
} from './export';

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

describe('suffixFilename', () => {
  it.each([
    ['tour.gif', 'tour-1440x900.gif'],
    ['clip.mp4', 'clip-1440x900.mp4'],
    ['session.json', 'session-1440x900.json'],
    ['flow.ts', 'flow-1440x900.ts'],
  ])('suffixes %s before the extension', (input, expected) => {
    expect(suffixFilename(input, '1440x900')).toBe(expected);
  });

  it('keeps a two-part .spec.ts intact', () => {
    // path.extname sees only ".ts" here, which would produce
    // flow.spec-1440x900.ts and silently demote the file to a plain script.
    expect(suffixFilename('flow.spec.ts', '390x844')).toBe('flow-390x844.spec.ts');
  });

  it('keeps .test.ts intact too', () => {
    expect(suffixFilename('flow.test.ts', '390x844')).toBe('flow-390x844.test.ts');
  });

  it('preserves the directory part of a path', () => {
    expect(suffixFilename('out/tour.gif', '800x600')).toBe('out/tour-800x600.gif');
  });

  it('appends when there is no recognised extension', () => {
    expect(suffixFilename('tour', '800x600')).toBe('tour-800x600');
  });
});

describe('viewportSuffix', () => {
  it('renders the size as it was typed', () => {
    expect(viewportSuffix({ width: 1440, height: 900 })).toBe('1440x900');
  });
});
