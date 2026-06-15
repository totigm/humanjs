import { describe, expect, it } from 'vitest';
import { generateHumanJS, generatePlaywrightTest } from './codegen';
import type { Timeline, TimelineEvent } from './index';

function timeline(events: TimelineEvent[], overrides: Partial<Timeline> = {}): Timeline {
  return {
    version: 1,
    personality: 'careful',
    seed: 'seed-1',
    speed: 'human',
    durationMs: 1000,
    events,
    ...overrides,
  };
}

function ev(
  type: string,
  params: Record<string, unknown> = {},
  extra: Partial<TimelineEvent> = {},
): TimelineEvent {
  return { type, params, tMs: 0, durationMs: 10, ...extra };
}

describe('generateHumanJS', () => {
  it('emits a runnable scaffold with createHuman options from the timeline', () => {
    const out = generateHumanJS(timeline([ev('goto', { url: 'https://example.com' })]));
    expect(out).toContain("import { chromium, createHuman } from '@humanjs/playwright';");
    expect(out).toContain('async function main() {');
    expect(out).toContain("personality: 'careful',");
    expect(out).toContain("seed: 'seed-1',");
    expect(out).toContain("speed: 'human',");
    expect(out).toContain("await human.goto('https://example.com');");
    expect(out).toContain('await browser.close();');
    expect(out).toContain('main();');
  });

  it('omits the seed line when seed is null', () => {
    const out = generateHumanJS(timeline([ev('click', { target: 'Sign in' })], { seed: null }));
    expect(out).not.toContain('seed:');
    expect(out).toContain("await human.click('Sign in');");
  });

  it('maps mouse actions with string targets verbatim', () => {
    const out = generateHumanJS(
      timeline([
        ev('click', { target: 'Sign in' }),
        ev('rightClick', { target: '#menu' }),
        ev('hover', { target: '.tooltip' }),
        ev('move', { target: 'nav' }),
      ]),
    );
    expect(out).toContain("await human.click('Sign in');");
    expect(out).toContain("await human.rightClick('#menu');");
    expect(out).toContain("await human.hover('.tooltip');");
    expect(out).toContain("await human.move('nav');");
  });

  it('emits raw points as coordinate objects with a flag comment', () => {
    const out = generateHumanJS(timeline([ev('move', { target: 'point(120, 340)' })]));
    expect(out).toContain('await human.move({ x: 120, y: 340 });');
    expect(out).toContain('raw coordinate');
  });

  it('includes captured input values and placeholders when absent', () => {
    const out = generateHumanJS(
      timeline([
        ev('type', { target: 'Email', length: 5 }, { inputValue: 'hello' }),
        ev('paste', { target: 'Notes', length: 3 }, { inputValue: 'abc' }),
        ev('type', { target: 'Password', length: 8 }), // masked → no inputValue
      ]),
    );
    expect(out).toContain("await human.type('Email', 'hello');");
    expect(out).toContain("await human.paste('Notes', 'abc');");
    expect(out).toContain("await human.type('Password', '');");
    expect(out).toContain('input not captured');
  });

  it('escapes quotes and newlines in values', () => {
    const out = generateHumanJS(
      timeline([ev('type', { target: "it's" }, { inputValue: "a'b\nc" })]),
    );
    expect(out).toContain("await human.type('it\\'s', 'a\\'b\\nc');");
  });

  it('maps drag, press, scroll variants, read, sleep, and nav', () => {
    const out = generateHumanJS(
      timeline([
        ev('drag', { from: 'a', to: 'b' }),
        ev('press', { key: 'Mod+S' }),
        ev('scroll', { target: 'natural' }),
        ev('scroll', { target: 'by:300' }),
        ev('scroll', { target: 'to:0' }),
        ev('scroll', { target: '#section' }),
        ev('read', { target: 'article' }),
        ev('sleep', { ms: 800 }),
        ev('reload'),
        ev('goBack'),
        ev('goForward'),
      ]),
    );
    expect(out).toContain("await human.drag('a', 'b');");
    expect(out).toContain("await human.press('Mod+S');");
    expect(out).toContain("await human.scroll('natural');");
    expect(out).toContain('await human.scroll({ by: 300 });');
    expect(out).toContain('await human.scroll({ to: 0 });');
    expect(out).toContain("await human.scroll('#section');");
    expect(out).toContain("await human.read('article');");
    expect(out).toContain('await sleep(800);');
    expect(out).toContain('await human.reload();');
    expect(out).toContain('await human.goBack();');
    expect(out).toContain('await human.goForward();');
  });

  it('imports sleep only when a sleep action is present', () => {
    const without = generateHumanJS(timeline([ev('click', { target: 'a' })]));
    expect(without).toContain("import { chromium, createHuman } from '@humanjs/playwright';");
    const withSleep = generateHumanJS(timeline([ev('sleep', { ms: 100 })]));
    expect(withSleep).toContain(
      "import { chromium, createHuman, sleep } from '@humanjs/playwright';",
    );
  });

  it('notes word-count and text reads instead of emitting broken selectors', () => {
    const out = generateHumanJS(
      timeline([ev('read', { target: '12 words' }), ev('read', { target: 'text:40 chars' })]),
    );
    expect(out).toContain('// human.read(...) — 12 words; original target not captured');
    expect(out).toContain('// human.read(...) — text:40 chars; original target not captured');
  });

  it('never emits assertions (it is a replay script, not a test)', () => {
    const out = generateHumanJS(
      timeline([
        ev('type', { target: '#email' }, { inputValue: 'a@b.com' }),
        ev('read', { target: '.passage' }),
      ]),
    );
    expect(out).not.toContain('expect(');
    expect(out).toContain("await human.type('#email', 'a@b.com');");
    expect(out).toContain("await human.read('.passage');");
  });

  it('drops explicit assert events from the standalone script', () => {
    const out = generateHumanJS(
      timeline([
        ev('click', { target: '#go' }),
        ev('assert', { kind: 'visible', target: '.banner' }),
      ]),
    );
    expect(out).not.toContain('expect(');
    expect(out).not.toContain('.banner');
    expect(out).toContain("await human.click('#go');");
  });
});

describe('generatePlaywrightTest', () => {
  it('emits a spec using the @humanjs/playwright/test fixture (no createHuman boilerplate)', () => {
    const out = generatePlaywrightTest(timeline([ev('click', { target: 'Buy now' })]));
    expect(out).toContain("import { test } from '@humanjs/playwright/test';");
    expect(out).not.toContain('createHuman');
    expect(out).toContain('test.use({ humanOptions: {');
    expect(out).toContain("test('recorded session', async ({ human }) => {");
    expect(out).toContain("await human.click('Buy now');");
    expect(out).toContain('});');
  });

  it('drops timing sleeps by default (a test should not replay human pauses)', () => {
    const out = generatePlaywrightTest(
      timeline([ev('sleep', { ms: 800 }), ev('click', { target: '#go' })]),
    );
    expect(out).not.toContain('await sleep(');
    expect(out).not.toContain("import { sleep } from '@humanjs/playwright';");
    expect(out).toContain("await human.click('#go');");
  });

  it('keeps sleeps and imports sleep when keepSleeps is set', () => {
    const out = generatePlaywrightTest(
      timeline([ev('sleep', { ms: 800 }), ev('click', { target: '#go' })]),
      { keepSleeps: true },
    );
    expect(out).toContain('await sleep(800);');
    expect(out).toContain("import { sleep } from '@humanjs/playwright';");
    expect(out).toContain("import { test } from '@humanjs/playwright/test';");
  });

  it('runs instant in CI / recorded speed locally', () => {
    const out = generatePlaywrightTest(timeline([ev('click', { target: '#go' })]));
    expect(out).toContain("speed: process.env.CI ? 'instant' : 'human',");
  });

  it('uses the recording name as the test title, overridable via options', () => {
    const named = generatePlaywrightTest(
      timeline([ev('click', { target: '#go' })], { name: 'checkout flow' }),
    );
    expect(named).toContain("test('checkout flow', async ({ human }) => {");
    const overridden = generatePlaywrightTest(
      timeline([ev('click', { target: '#go' })], { name: 'checkout flow' }),
      { title: 'override' },
    );
    expect(overridden).toContain("test('override', async ({ human }) => {");
  });

  it('derives toBeVisible from reads and toHaveValue from captured inputs', () => {
    const out = generatePlaywrightTest(
      timeline([
        ev('type', { target: '#email' }, { inputValue: 'a@b.com' }),
        ev('read', { target: '.passage' }),
      ]),
    );
    expect(out).toContain("import { expect, test } from '@humanjs/playwright/test';");
    expect(out).toContain("test('recorded session', async ({ human, page }) => {");
    expect(out).toContain("await human.type('#email', 'a@b.com');");
    expect(out).toContain("await expect(page.locator('#email')).toHaveValue('a@b.com');");
    expect(out).toContain("await human.read('.passage');");
    expect(out).toContain("await expect(page.locator('.passage')).toBeVisible();");
    expect(out).toContain('TODO: add assertions');
  });

  it('omits the expect import (and notes it in the TODO) when nothing is assertable', () => {
    const out = generatePlaywrightTest(timeline([ev('click', { target: 'Buy now' })]));
    expect(out).toContain("import { test } from '@humanjs/playwright/test';");
    expect(out).not.toContain('import { expect, test }');
    expect(out).toContain('TODO: assert the outcome — add `page` to the test args');
  });

  it('does not assert password inputs (no captured value)', () => {
    const out = generatePlaywrightTest(timeline([ev('type', { target: '#pw', length: 8 })]));
    expect(out).toContain("await human.type('#pw', '');");
    expect(out).not.toContain('toHaveValue');
  });

  it('groups actions into test.step blocks per navigation when steps is set', () => {
    const out = generatePlaywrightTest(
      timeline([
        ev('goto', { url: 'https://example.com/login' }),
        ev('click', { target: '#submit' }),
        ev('goto', { url: 'https://example.com/dashboard' }),
        ev('read', { target: '.welcome' }),
      ]),
      { steps: true },
    );
    expect(out).toContain("await test.step('go to https://example.com/login', async () => {");
    expect(out).toContain("await test.step('go to https://example.com/dashboard', async () => {");
    // actions are indented one level deeper inside a step (4 spaces)
    expect(out).toContain("    await human.click('#submit');");
  });

  it('relativizes gotos under a shared origin with baseUrl', () => {
    const out = generatePlaywrightTest(
      timeline([
        ev('goto', { url: 'https://app.example.com/login' }),
        ev('goto', { url: 'https://app.example.com/dashboard' }),
      ]),
      { baseUrl: true },
    );
    expect(out).toContain("await human.goto('/login');");
    expect(out).toContain("await human.goto('/dashboard');");
    expect(out).toContain("// Set use.baseURL = 'https://app.example.com'");
  });

  it('renders explicit assert events (visible / text / url)', () => {
    const out = generatePlaywrightTest(
      timeline([
        ev('assert', { kind: 'visible', target: '.banner' }),
        ev('assert', { kind: 'text', target: 'h1', value: 'Welcome' }),
        ev('assert', { kind: 'url', value: '/dashboard' }),
      ]),
    );
    expect(out).toContain("import { expect, test } from '@humanjs/playwright/test';");
    expect(out).toContain("test('recorded session', async ({ human, page }) => {");
    expect(out).toContain("await expect(page.locator('.banner')).toBeVisible();");
    expect(out).toContain("await expect(page.locator('h1')).toHaveText('Welcome');");
    expect(out).toContain("await expect(page).toHaveURL('/dashboard');");
  });

  it('keeps absolute gotos when origins differ even with baseUrl', () => {
    const out = generatePlaywrightTest(
      timeline([
        ev('goto', { url: 'https://a.example.com/x' }),
        ev('goto', { url: 'https://b.example.com/y' }),
      ]),
      { baseUrl: true },
    );
    expect(out).toContain("await human.goto('https://a.example.com/x');");
    expect(out).toContain("await human.goto('https://b.example.com/y');");
    expect(out).not.toContain('use.baseURL');
  });
});
