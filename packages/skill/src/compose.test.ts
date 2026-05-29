import { describe, expect, it } from 'vitest';
import {
  AGENTS_END,
  AGENTS_START,
  composeAgentsBlock,
  composeClaude,
  composeCursor,
  mergeAgentsMd,
  SKILL_DESCRIPTION,
} from './compose';

const BODY = '# HumanJS\n\nSome guidance.\n';

describe('composeClaude', () => {
  it('prepends name + description frontmatter', () => {
    const out = composeClaude(BODY);
    expect(out.startsWith('---\n')).toBe(true);
    expect(out).toContain('name: humanjs');
    expect(out).toContain(`description: ${SKILL_DESCRIPTION}`);
    expect(out).toContain('# HumanJS');
    // exactly one frontmatter fence pair (opening + closing)
    expect(out.match(/^---$/gm)?.length).toBe(2);
  });
});

describe('composeCursor', () => {
  it('emits .mdc frontmatter with description, globs, alwaysApply', () => {
    const out = composeCursor(BODY);
    expect(out).toContain(`description: ${SKILL_DESCRIPTION}`);
    expect(out).toContain('globs: []');
    expect(out).toContain('alwaysApply: false');
    expect(out).toContain('# HumanJS');
  });
});

describe('mergeAgentsMd', () => {
  it('creates the file from just the block when none exists', () => {
    const out = mergeAgentsMd(null, BODY);
    expect(out).toContain(AGENTS_START);
    expect(out).toContain(AGENTS_END);
    expect(out).toContain('# HumanJS');
  });

  it('treats whitespace-only existing content as empty', () => {
    expect(mergeAgentsMd('   \n\n', BODY)).toBe(mergeAgentsMd(null, BODY));
  });

  it('appends the block, preserving existing content, when no markers present', () => {
    const existing = '# My project\n\nExisting agent instructions.\n';
    const out = mergeAgentsMd(existing, BODY);
    expect(out).toContain('# My project');
    expect(out).toContain('Existing agent instructions.');
    expect(out).toContain(AGENTS_START);
    expect(out.indexOf('Existing agent instructions.')).toBeLessThan(out.indexOf(AGENTS_START));
  });

  it('replaces the block in place when markers already exist', () => {
    const first = mergeAgentsMd('# Project\n\nKeep me.\n', BODY);
    const updated = mergeAgentsMd(first, '# HumanJS\n\nUPDATED guidance.\n');
    expect(updated).toContain('Keep me.');
    expect(updated).toContain('UPDATED guidance.');
    expect(updated).not.toContain('Some guidance.');
    // still exactly one marker pair — no duplication
    expect(updated.match(new RegExp(AGENTS_START, 'g'))?.length).toBe(1);
    expect(updated.match(new RegExp(AGENTS_END, 'g'))?.length).toBe(1);
  });

  it('is idempotent — re-merging the same body changes nothing', () => {
    const once = mergeAgentsMd('# Project\n\nKeep me.\n', BODY);
    const twice = mergeAgentsMd(once, BODY);
    expect(twice).toBe(once);
    // and again from the no-existing path
    const a = mergeAgentsMd(null, BODY);
    expect(mergeAgentsMd(a, BODY)).toBe(a);
  });
});

describe('composeAgentsBlock', () => {
  it('wraps the body in the marker pair', () => {
    const block = composeAgentsBlock(BODY);
    expect(block.startsWith(AGENTS_START)).toBe(true);
    expect(block.trimEnd().endsWith(AGENTS_END)).toBe(true);
  });
});
