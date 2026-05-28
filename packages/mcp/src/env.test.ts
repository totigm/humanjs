import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_PERSIST_DIR, readEnv } from './env';

const ENV_KEYS = [
  'HUMANJS_PERSONALITY',
  'HUMANJS_SPEED',
  'HUMANJS_HEADLESS',
  'HUMANJS_OUTPUT_DIR',
  'HUMANJS_VIEWPORT',
  'HUMANJS_AUTO_INSTALL',
  'HUMANJS_PERSIST',
  'HUMANJS_USER_DATA_DIR',
  'HUMANJS_CDP_URL',
  'HUMANJS_CHANNEL',
] as const;

describe('readEnv', () => {
  let saved: Record<string, string | undefined>;

  beforeEach(() => {
    saved = {};
    for (const k of ENV_KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });

  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it('applies sensible defaults with no env set', () => {
    const env = readEnv();
    expect(env.personality).toBe('careful');
    expect(env.speed).toBe('human');
    expect(env.headless).toBe(false);
    expect(env.autoInstall).toBe(true);
    expect(env.viewport).toEqual({ width: 1440, height: 900 });
    expect(env.browser).toEqual({ mode: 'ephemeral' });
    expect(env.channel).toBeUndefined();
    expect(env.outputDir).toBe(process.cwd());
  });

  describe('personality', () => {
    it('accepts a valid preset (case-insensitive)', () => {
      process.env.HUMANJS_PERSONALITY = 'Distracted';
      expect(readEnv().personality).toBe('distracted');
    });
    it('throws on an unknown preset', () => {
      process.env.HUMANJS_PERSONALITY = 'nope';
      expect(() => readEnv()).toThrow(/HUMANJS_PERSONALITY/);
    });
  });

  describe('speed', () => {
    it('accepts a valid speed', () => {
      process.env.HUMANJS_SPEED = 'instant';
      expect(readEnv().speed).toBe('instant');
    });
    it('throws on an invalid speed', () => {
      process.env.HUMANJS_SPEED = 'turbo';
      expect(() => readEnv()).toThrow(/HUMANJS_SPEED/);
    });
  });

  describe('booleans', () => {
    it('parses truthy/falsy spellings', () => {
      process.env.HUMANJS_HEADLESS = 'true';
      process.env.HUMANJS_AUTO_INSTALL = '0';
      const env = readEnv();
      expect(env.headless).toBe(true);
      expect(env.autoInstall).toBe(false);
    });
    it('throws on a non-boolean', () => {
      process.env.HUMANJS_HEADLESS = 'maybe';
      expect(() => readEnv()).toThrow(/boolean/i);
    });
  });

  describe('viewport', () => {
    it('parses WIDTHxHEIGHT', () => {
      process.env.HUMANJS_VIEWPORT = '1920x1080';
      expect(readEnv().viewport).toEqual({ width: 1920, height: 1080 });
    });
    it('throws on a malformed value', () => {
      process.env.HUMANJS_VIEWPORT = 'huge';
      expect(() => readEnv()).toThrow(/HUMANJS_VIEWPORT/);
    });
  });

  describe('browser config precedence', () => {
    it('CDP wins over everything', () => {
      process.env.HUMANJS_CDP_URL = 'http://localhost:9222';
      process.env.HUMANJS_USER_DATA_DIR = '/data';
      process.env.HUMANJS_PERSIST = 'true';
      expect(readEnv().browser).toEqual({ mode: 'cdp', cdpUrl: 'http://localhost:9222' });
    });

    it('explicit user-data-dir → persistent', () => {
      process.env.HUMANJS_USER_DATA_DIR = '/data';
      expect(readEnv().browser).toEqual({ mode: 'persistent', userDataDir: '/data' });
    });

    it('HUMANJS_PERSIST=true → persistent with the default dir', () => {
      process.env.HUMANJS_PERSIST = 'true';
      expect(readEnv().browser).toEqual({ mode: 'persistent', userDataDir: DEFAULT_PERSIST_DIR });
    });

    it('nothing set → ephemeral', () => {
      expect(readEnv().browser).toEqual({ mode: 'ephemeral' });
    });
  });

  it('passes through the channel', () => {
    process.env.HUMANJS_CHANNEL = 'chrome';
    expect(readEnv().channel).toBe('chrome');
  });
});
