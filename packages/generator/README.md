# @humanjs/generator

<p>
  <a href="https://www.npmjs.com/package/@humanjs/generator"><img alt="npm" src="https://img.shields.io/npm/v/@humanjs/generator"></a>
  <a href="https://www.npmjs.com/package/@humanjs/generator"><img alt="downloads" src="https://img.shields.io/npm/dt/@humanjs/generator"></a>
  <a href="https://github.com/totigm/humanjs"><img alt="GitHub" src="https://img.shields.io/badge/GitHub-totigm%2Fhumanjs-181717?logo=github"></a>
  <a href="https://github.com/totigm/humanjs/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/totigm/humanjs/actions/workflows/ci.yml/badge.svg"></a>
  <a href="https://github.com/totigm/humanjs/blob/main/LICENSE"><img alt="license" src="https://img.shields.io/npm/l/@humanjs/generator"></a>
  <a href="https://humanjs.dev"><img alt="docs" src="https://img.shields.io/badge/docs-humanjs.dev-emerald"></a>
</p>

Visual recorder for [HumanJS](https://humanjs.dev) — record your clicks in a real browser and export a clean, **humanized** Playwright test.

```bash
npx @humanjs/generator https://your-app.com
```

It launches a real Chromium window and a local dashboard. You click through your flow; the dashboard shows a live, editable timeline next to a syntax-highlighted code preview. Curate the steps, pick a personality, and export a ready-to-commit `.spec.ts` that drives the page through HumanJS — so the generated test runs with humanized motion, not robotic jumps.

> **Audience:** AI agent builders, QA engineers, and demo/tutorial creators. HumanJS is **not** a scraping, captcha-bypass, or "undetectable automation" tool — see the [non-goals](https://humanjs.dev).

## How it works

1. `npx @humanjs/generator <url>` opens a real Chromium window at your URL and a local dashboard (loopback only) in your browser.
2. Interact with the site in the Chromium window — clicks, typing, scrolling, drag, navigation. Each action streams into the dashboard as a step, captured with a robust, role-first selector.
3. Curate the timeline in the editor (below), pick a personality, and watch the generated test update live.
4. Hit **Run** to replay the recording in a fresh window and see each step go green or red — verify it passes before you ship it.
5. Hit **Export** to write a `.spec.ts` (a `@humanjs/playwright/test` spec) or a standalone `.ts` script to your working directory — or an **`.mp4` / `.gif`** of the clean replayed flow for a demo or tutorial.

## The editor

- **Reorder** by dragging a step's handle — the rest slide out of the way.
- **Delete** junk steps, **relabel** any step (the label becomes a comment), and **edit captured values**.
- **Pick a selector** per step from the ranked candidates (role + accessible name → label → text → test id → `#id` → CSS → XPath).
- **Add assertions** by pointing at a step: `toBeVisible`, `toHaveText`, or `toHaveURL`.
- **Mark a field secret** so its value exports as `process.env.X` instead of a literal.
- **Switch personality** (`careful` / `fast` / `distracted` / `precise`) — the same recording, re-shaped, no re-recording.
- **Run / verify** — replay the curated recording in a fresh window; each step shows a live pass/fail badge and an overall result banner, stopping at the first failure. Cancellable, and it never re-records itself.
- **Export video** — `.mp4` / `.gif` of the clean replayed flow (no fumbles or pauses), with the humanized cursor visible — for demos, tutorials, and side-by-side clips.

## Output

A fixture-based spec that runs humanized locally and instant in CI:

```ts
import { test } from '@humanjs/playwright/test';

test.use({ humanOptions: { personality: 'careful', speed: process.env.CI ? 'instant' : 'human' } });

test('recorded session', async ({ human }) => {
  await human.goto('https://your-app.com/');
  await human.click('role=link[name="Sign in"]');
  await human.type('role=textbox[name="Email"]', 'user@example.com');
  await human.click('role=button[name="Continue"]');
});
```

Export as `.spec.ts` / `.test.ts` for the spec above, or `.ts` for a standalone HumanJS script.

## How it differs from Playwright Codegen

- **Humanized output** — generated tests use HumanJS primitives (curved clicks, typing rhythm, reading dwell), not raw Playwright calls.
- **Personality switcher** — the same recording exports as `careful`, `fast`, `distracted`, or `precise` without re-recording.
- **Edit before export** — delete junk, reorder, relabel, fix captured text, pick selectors, add assertions (Codegen has no editor).
- **Selector quality** — prefers ARIA role + accessible name, then label / text / test id, before falling back to CSS or XPath.

## Requirements

- Node.js ≥ 20.
- The Playwright Chromium browser. If you don't have it yet: `npx playwright install chromium`.

## Honest limits

- Records in a real browser (no iframe), so it works on sites that block framing — but it does not, and will not, defeat bot detection, fingerprinting, or captchas.
- The local dashboard binds to `127.0.0.1` only.
- Captured passwords are always masked; use the secret-field toggle to wire other sensitive values to environment variables.

See [`ROADMAP.md`](./ROADMAP.md) for what's next (in-app replay, video/GIF export, mid-timeline re-record).

## License

MIT
