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

It launches a real Chromium window and a local dashboard. You click through your flow; the dashboard shows a live, editable timeline. Curate the steps, pick a personality, and export a ready-to-commit `.spec.ts` that drives the page through HumanJS — so the generated test runs with humanized motion, not robotic jumps.

> **Audience:** AI agent builders, QA engineers, and demo/tutorial creators. HumanJS is **not** a scraping, captcha-bypass, or "undetectable automation" tool — see the [non-goals](https://humanjs.dev).

## How it differs from Playwright Codegen

- **Humanized output** — generated tests use HumanJS primitives (curved clicks, typing rhythm, reading dwell), not raw Playwright calls.
- **Personality switcher** — the same recording exports as `careful`, `fast`, `distracted`, or `precise` without re-recording.
- **Edit before export** — delete junk, reorder, relabel, and fix captured text in the dashboard (Codegen has no editor).
- **Selector quality** — prefers ARIA role + accessible name, then label / text / test id, before falling back to CSS or XPath.
- **Assertions and secrets** — add `toBeVisible` / `toHaveText` / `toHaveURL` assertions by pointing at elements, and mark sensitive fields so they export as `process.env.*` instead of literals.

## Status

🚧 v0.1 is in active development. See [`ROADMAP.md`](./ROADMAP.md) for what's shipping in v0.1 and what's planned next.

## Honest limits

- Records in a real browser (no iframe), so it works on sites that block framing — but it does not, and will not, defeat bot detection, fingerprinting, or captchas.
- The local dashboard binds to `127.0.0.1` only.
- Captured passwords are always masked; use the secret-field option to wire other sensitive values to environment variables.

## License

MIT
