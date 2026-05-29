# @humanjs/core

<p>
  <a href="https://www.npmjs.com/package/@humanjs/core"><img alt="npm" src="https://img.shields.io/npm/v/@humanjs/core"></a>
  <a href="https://www.npmjs.com/package/@humanjs/core"><img alt="downloads" src="https://img.shields.io/npm/dt/@humanjs/core"></a>
  <a href="https://github.com/totigm/humanjs"><img alt="GitHub" src="https://img.shields.io/badge/GitHub-totigm%2Fhumanjs-181717?logo=github"></a>
  <a href="https://github.com/totigm/humanjs/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/totigm/humanjs/actions/workflows/ci.yml/badge.svg"></a>
  <a href="https://github.com/totigm/humanjs/blob/main/LICENSE"><img alt="license" src="https://img.shields.io/npm/l/@humanjs/core"></a>
  <a href="https://humanjs.dev"><img alt="docs" src="https://img.shields.io/badge/docs-humanjs.dev-emerald"></a>
</p>

The core of [HumanJS](https://humanjs.dev): personality system, timing math, types, and the plugin contract.

> Most users don't install this package directly. Install [`@humanjs/playwright`](https://www.npmjs.com/package/@humanjs/playwright) instead, which depends on this.

## Install

```bash
pnpm add @humanjs/core
```

## Authoring a personality

A `Personality` is plain, immutable data — it describes the *rhythm and shape*
of humanization (mouse curvature, typing delays, reading speed, dwell) without
owning any randomness. The `Personality` type is exported and stable, so anyone
can build one and pass it to `createHuman({ personality })`.

The simplest form extends a built-in preset and overrides only what you want:

```ts
import type { PersonalityExtension } from '@humanjs/core';

export const grandma: PersonalityExtension = {
  extends: 'careful',
  name: 'grandma',
  speed: 1.7, // ~70% slower overall
  mouse: { curvature: 0.95, overshootProbability: 0.4 },
  typing: { baseDelayMs: 240, thinkPauseProbability: 0.4, typoProbability: 0.08 },
  reading: { wpm: 130 },
};
```

You can also export a fully built `Personality` (every facet specified) — useful
when you don't want to inherit from a preset. Compose presets with `blend()`,
and resolve any config to a flat `Personality` with `resolvePersonality()`.

### Publish it as a community package

Personalities are a first-class extension point. To share one, publish a package
named **`@yourname/personality-<name>`** whose entry exports the object:

```ts
// @yourname/personality-grandma
export { grandma } from './grandma';
```

```ts
// consumer
import { grandma } from '@yourname/personality-grandma';
import { createHuman } from '@humanjs/playwright';

const human = await createHuman(page, { personality: grandma });
```

A runnable example lives in [`examples/personality-grandma.ts`](https://github.com/totigm/humanjs/blob/main/examples/personality-grandma.ts).

## Writing a plugin

A `HumanPlugin` is a plain object with optional lifecycle hooks the host calls
around every action. Hooks are observation-only in v1 (they can't transform
actions) and run in registration order; each may be sync or async.

```ts
import type { HumanPlugin } from '@humanjs/core';

const logger: HumanPlugin = {
  name: 'logger',
  install: (ctx) => console.log(`personality: ${ctx.personality.name}`),
  beforeAction: (action) => console.log(`▶ ${action.type}`, action.params),
  afterAction: (action, result) => console.log(`✓ ${action.type} — ${result.durationMs}ms`),
  onError: (action, error) => console.error(`✕ ${action.type}`, error),
};

const human = await createHuman(page, { plugins: [logger] });
```

`install` receives a `PluginContext` (the resolved `personality` and the
session's seeded `rng`). A runnable example lives in
[`examples/plugin-logger.ts`](https://github.com/totigm/humanjs/blob/main/examples/plugin-logger.ts).

## License

MIT
