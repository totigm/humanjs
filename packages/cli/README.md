# @humanjs/cli

<p>
  <a href="https://www.npmjs.com/package/@humanjs/cli"><img alt="npm" src="https://img.shields.io/npm/v/@humanjs/cli"></a>
  <a href="https://www.npmjs.com/package/@humanjs/cli"><img alt="downloads" src="https://img.shields.io/npm/dt/@humanjs/cli"></a>
  <a href="https://github.com/totigm/humanjs"><img alt="GitHub" src="https://img.shields.io/badge/GitHub-totigm%2Fhumanjs-181717?logo=github"></a>
  <a href="https://github.com/totigm/humanjs/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/totigm/humanjs/actions/workflows/ci.yml/badge.svg"></a>
  <a href="https://github.com/totigm/humanjs/blob/main/LICENSE"><img alt="license" src="https://img.shields.io/npm/l/@humanjs/cli"></a>
  <a href="https://humanjs.dev"><img alt="docs" src="https://img.shields.io/badge/docs-humanjs.dev-emerald"></a>
</p>

Command line for [HumanJS](https://humanjs.dev). Watch humanized browser automation on any page, and run HumanJS scripts, without creating a project.

```bash
npx @humanjs/cli demo https://example.com
```

A browser opens, lands on the page, reads the heading, scrolls in stages, and drifts the cursor over a link — the way a person skims. That is the whole pitch, in one command, before you write a line of code.

> **On the command name.** The unscoped `humanjs` name on npm belongs to an unrelated package from 2022, so `npx humanjs` does **not** reach this CLI. Use `npx @humanjs/cli`. Installed (`npm i -g @humanjs/cli`), the binary is plain `humanjs`.

## Commands

### `demo <url>`

Drives any page the way a person would skim it.

```bash
npx @humanjs/cli demo https://your-site.com
npx @humanjs/cli demo https://your-site.com --record tour.gif
```

Every step is optional at runtime: a page with no heading, nothing to scroll, or no links simply gets fewer steps rather than an error. **It never clicks** — it runs on your site, not ours, so it will not navigate away, submit a form, or fire a side effect.

### `run <script>`

Runs a HumanJS flow with the browser and the `Human` instance already wired. The script is only the flow:

```ts
// flow.ts
export default async (human) => {
  await human.goto('https://example.com');
  await human.type('#email', 'you@company.com');
  await human.click('text=Sign in');
};
```

```bash
npx @humanjs/cli run flow.ts
npx @humanjs/cli run flow.ts --record login.spec.ts --headless
```

`.ts` files run directly — no build step, no tsconfig. A named `run` export works as well as the default one. The flow receives `(human, page)`, so the raw Playwright `Page` is there when you need it.

## Options

| Option | Purpose |
|---|---|
| `--record <file>` | Also record the session. The extension picks the format: `.mp4` `.webm` `.gif` `.json` (timeline) `.ts` (HumanJS script) `.spec.ts` (Playwright test) |
| `--personality <name>` | `careful` · `fast` · `distracted` · `precise` (default `careful`) |
| `--speed <pace>` | `human` · `fast` · `instant` (default `human`) |
| `--seed <string>` | Deterministic run — same seed, same trajectory, every time |
| `--viewport <WxH>` | Browser size (default `1280x800`; `1440×900` works too) |
| `--headless` | Run without a window. The default is headed, because the point of `demo` is watching it |
| `-h`, `--help` | Usage |
| `-v`, `--version` | Version |

## Recording a flow as a test

`--record` dispatches on the extension, so the same run can produce a video for a README or a committable test:

```bash
npx @humanjs/cli run checkout.ts --record checkout.spec.ts --headless
```

That writes a `@playwright/test` spec with assertions derived from the run. Typed text is captured so the test is runnable — **except password fields, which are always masked**. That is deliberate: read the value from an env var in the generated file rather than pasting the secret back in.

## Honest limits

- Built on Playwright — humanizes it, does not replace it. Will not defeat sophisticated bot detection, and is not meant to.
- `demo` runs against pages it has never seen. It is defensive by design, so on an unusual layout it does less rather than failing.
- Recording video or GIF needs `ffmpeg`, bundled via `@humanjs/recorder`. `.json` timelines and code exports have no such dependency.

## License

MIT
