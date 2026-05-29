import { describe, expect, it } from 'vitest';
import { ALL_TARGETS, parseArgs } from './targets';

describe('parseArgs', () => {
  it('returns null targets when no target flag is given', () => {
    expect(parseArgs([]).targets).toBeNull();
  });

  it('--all selects every target', () => {
    expect(parseArgs(['--all']).targets).toEqual([...ALL_TARGETS]);
  });

  it('individual flags combine, in canonical order', () => {
    expect(parseArgs(['--codex', '--claude']).targets).toEqual(['claude', 'codex']);
  });

  it('detects --help / -h', () => {
    expect(parseArgs(['--help']).help).toBe(true);
    expect(parseArgs(['-h']).help).toBe(true);
    expect(parseArgs(['--claude']).help).toBe(false);
  });

  it('--all wins over individual flags', () => {
    expect(parseArgs(['--claude', '--all']).targets).toEqual([...ALL_TARGETS]);
  });

  it('detects --global / -g, orthogonal to targets', () => {
    expect(parseArgs([]).global).toBe(false);
    expect(parseArgs(['--global']).global).toBe(true);
    expect(parseArgs(['-g']).global).toBe(true);
    const parsed = parseArgs(['-g', '--claude']);
    expect(parsed.global).toBe(true);
    expect(parsed.targets).toEqual(['claude']);
  });
});
