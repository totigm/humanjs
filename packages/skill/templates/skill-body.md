# HumanJS — humanized Playwright automation

HumanJS wraps a Playwright `Page` so clicks, typing, scrolling, and reading happen at realistic human pace (curved mouse paths, typing rhythm, reading dwell). Use it for **AI agents**, **QA tests** where real-pace timing exposes bugs, and **demo/tutorial recordings**.

**Use this skill when** writing or editing browser automation, Playwright tests, or demo scripts that should behave like a real user — or when the user mentions HumanJS, `createHuman`, humanized clicks/typing, or recording a flow.

## Setup

`@humanjs/playwright` wraps an existing Playwright `Page` — it does not replace Playwright.

```ts
import { chromium, createHuman } from '@humanjs/playwright';

const browser = await chromium.launch();
const page = await browser.newPage();

const human = await createHuman(page, {
  personality: 'careful', // 'careful' | 'fast' | 'distracted' | 'precise'
  seed: 'session-42',     // optional — deterministic trajectories when set
  speed: 'human',         // 'human' (default) | 'fast' | 'instant'
});

await human.goto('https://example.com');
await human.click('Sign in');
await human.type('Email', 'user@example.com');
```

`page` stays fully usable for assertions and anything HumanJS doesn't cover (`expect(page)…`, `page.locator(…)`).

## Selector strategy — prefer accessible names

Pass Playwright selectors as strings. **Prefer accessible names and roles** (`getByRole`, `getByLabel`, `getByText`) over brittle CSS/XPath — it's both more robust and a humanization signal (real users navigate by what they see). HumanJS forwards the string to `page.locator()`, so any Playwright selector works, but reach for CSS only when there's no accessible handle.

```ts
await human.click('Buy now');                 // resolved by accessible name
await human.type('Card number', '4242…');      // by label
await human.click('button.checkout');          // CSS fallback when needed
```

## Personalities

```ts
createHuman(page, { personality: 'careful' });    // slow, precise, few mistakes
createHuman(page, { personality: 'fast' });       // quick but still natural
createHuman(page, { personality: 'distracted' }); // scrolls back, retypes, hovers
createHuman(page, { personality: 'precise' });    // minimal noise, smooth motion
```

Extend, override, or blend (the `Personality` type is exported and stable):

```ts
import { blend } from '@humanjs/playwright';

createHuman(page, { personality: { extends: 'careful', typing: { typoProbability: 0.1 } } });
createHuman(page, { personality: blend('careful', 'distracted', 0.3) });
```

## Determinism and CI

Set `seed` for reproducible runs (required for snapshot tests). Use `speed: 'instant'` in CI to bypass humanization and keep the suite fast — the documented test pattern:

```ts
import { test, expect } from '@playwright/test';
import { createHuman } from '@humanjs/playwright';

test('checkout flow', async ({ page }) => {
  const human = await createHuman(page, {
    seed: test.info().title,
    speed: process.env.CI ? 'instant' : 'human',
  });

  await human.goto('/');
  await human.click('Buy now');
  await expect(page).toHaveURL(/checkout/);
});
```

`'instant'` uses Playwright's native methods (no curved paths or per-key timing) so tests stay quick; local runs get the full human treatment for catching real-pace bugs.

## Primitives

All await; selectors are strings or Playwright `Locator`s (`move`/`drag` also accept a `{ x, y }` Point).

| Call | Behavior |
|---|---|
| `human.goto(url)` | Navigate. |
| `human.click(target)` | Hover → micro-move → click. Occasional near-miss + recovery. |
| `human.rightClick(target)` | Context-menu click. |
| `human.doubleClick(target)` | Same motion as click; double-click dispatch. |
| `human.hover(target)` | Hover and settle (no click). |
| `human.move(target)` | Positional move, no dwell. |
| `human.drag(from, to)` | Humanized drag; endpoints are selector / Locator / Point. |
| `human.type(target, value)` | Click to focus, then realistic typing rhythm (+ optional typos/backspace). |
| `human.paste(target, value)` | Cmd-V style insert — no per-char timing. |
| `human.check(target)` / `human.uncheck(target)` | Tick/untick a checkbox or radio — clicks only if the state needs to change. |
| `human.selectOption(target, values)` | Choose option(s) in a native `<select>` (cursor moves to it, then sets the value). |
| `human.upload(target, files)` | Attach file(s) to a file input (no OS dialog). |
| `human.press(key)` | Single key (`'Tab'`) or chord (`'Mod+S'` — `Mod` = Meta on macOS, Control elsewhere). |
| `human.read(target)` | Dwell based on word count. |
| `human.scroll('natural')` | Humanized scroll; also `{ by }` / `{ to }` / a selector. |
| `human.sleep(ms)` | Pause (also exported standalone as `sleep`). |

## Recording and code export

Record a session and export it several ways:

```ts
const rec = await human.record(async () => {
  await human.goto('/checkout');
  await human.click('Buy now');
  await human.type('Email', 'user@example.com');
});

await rec.toVideo('checkout.mp4');          // mp4 / webm
await rec.toGif('checkout.gif');            // animated gif
await rec.toTimeline('checkout.json');      // structured JSON timeline
await rec.toHumanJS('checkout.ts');         // runnable HumanJS script
await rec.toPlaywright('checkout.spec.ts'); // @playwright/test spec (humanized)
```

Or one call that owns the browser lifecycle (`@humanjs/recorder`):

```ts
import { record } from '@humanjs/recorder';

await record({ output: 'demo.mp4', name: 'checkout flow' }, async (human) => {
  await human.goto('/checkout');
  await human.click('Buy now');
});
```

`toPlaywright()` generates a real test: it runs `speed: process.env.CI ? 'instant' : …`, drops recorded `sleep()` pauses by default (`{ keepSleeps: true }` to keep them), and derives safe assertions (`toBeVisible` from reads, `toHaveValue` from captured inputs).

**Captured inputs / passwords:** typed values are recorded into the timeline and code exports by default so generated scripts are runnable, **except `input[type="password"]` values, which are always masked**. Don't hand-edit a real secret back into an exported file — read it from an env var (`process.env.APP_PASSWORD`) instead. Set `captureInputs: false` on `record()` to capture no input values at all.

## Not in scope — do not frame HumanJS this way

HumanJS is for legitimate automation, QA, and demos. It is **not** a stealth tool and will not defeat sophisticated bot detection. Never write code, comments, or copy that positions it for: captcha solving/bypass, fingerprint masking, proxy rotation, or "undetectable" automation. If asked for those, decline — they are explicit non-goals.
