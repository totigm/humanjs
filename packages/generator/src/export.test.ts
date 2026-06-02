import type { TimelineEvent } from '@humanjs/playwright';
import { describe, expect, it } from 'vitest';
import { type ExportFormat, formatFromFilename, generateCode } from './export';

function ev(
  type: string,
  params: Record<string, unknown> = {},
  inputValue?: string,
): TimelineEvent {
  return {
    type,
    params,
    tMs: 0,
    durationMs: 0,
    ...(inputValue === undefined ? {} : { inputValue }),
  };
}

describe('formatFromFilename', () => {
  const cases: [string, ExportFormat][] = [
    ['checkout.spec.ts', 'spec'],
    ['login.test.ts', 'spec'],
    ['flow.spec.tsx', 'spec'],
    ['replay.ts', 'script'],
    ['demo.mts', 'script'],
  ];
  for (const [name, expected] of cases) {
    it(`maps ${name} → ${expected}`, () => {
      expect(formatFromFilename(name)).toBe(expected);
    });
  }
});

describe('generateCode', () => {
  it('emits a fixture-based spec for the spec format', () => {
    const out = generateCode([ev('click', { target: 'role=button[name="Go"]' })], {
      format: 'spec',
    });
    expect(out).toContain("import { test } from '@humanjs/playwright/test';");
    expect(out).toContain('await human.click(\'role=button[name="Go"]\');');
  });

  it('emits a standalone script for the script format', () => {
    const out = generateCode([ev('click', { target: '#go' })], { format: 'script' });
    expect(out).toContain("import { chromium, createHuman } from '@humanjs/playwright';");
    expect(out).toContain("await human.click('#go');");
  });

  it('carries the chosen personality into the spec', () => {
    const out = generateCode([ev('click', { target: '#go' })], {
      format: 'spec',
      personality: 'distracted',
    });
    expect(out).toContain("personality: 'distracted',");
  });

  it('substitutes process.env for a secret-flagged field (unquoted)', () => {
    const out = generateCode([ev('type', { target: '#token', secret: 'API_TOKEN' }, 'shhh')], {
      format: 'spec',
    });
    expect(out).toContain('process.env.API_TOKEN');
    expect(out).not.toContain('shhh');
    expect(out).not.toContain('__HUMANJS_ENV__');
    expect(out).not.toContain("'process.env.API_TOKEN'");
  });

  it('substitutes env even when the password value was masked', () => {
    const out = generateCode([ev('type', { target: '#pw', secret: 'APP_PASSWORD' })], {
      format: 'spec',
    });
    expect(out).toContain('process.env.APP_PASSWORD');
  });

  it('renders user assertions through the shared codegen', () => {
    const out = generateCode(
      [ev('click', { target: '#go' }), ev('assert', { kind: 'url', value: '/done' })],
      { format: 'spec' },
    );
    expect(out).toContain("await expect(page).toHaveURL('/done');");
  });
});
