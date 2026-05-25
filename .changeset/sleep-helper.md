---
"@humanjs/core": minor
"@humanjs/playwright": minor
---

Add a `sleep(ms)` helper — exported from `@humanjs/core` and re-exported from `@humanjs/playwright`, plus available as a method on the `Human` instance for users who already have one in scope.

```ts
// Standalone import — works without a Human session
import { sleep } from '@humanjs/playwright';
await sleep(800);

// Or via the Human instance — no extra import needed when you have one
const human = await createHuman(page);
await human.click('#start');
await human.sleep(400);
await human.type('#email', 'demo@humanjs.dev');
```

Trivial implementation (`new Promise((r) => setTimeout(r, ms))`) but exported because it shows up in every demo and most user code that paces humanized actions for visual demos or recordings. Playwright's own `page.waitForTimeout()` is the alternative but Playwright's docs discourage it; an explicit `sleep` makes the intent clearer.

**Not humanized**: `human.sleep(ms)` is a raw setTimeout — not scaled by personality or speed mode, and no plugin events fire. Use it for generic pacing between humanized actions. If you want delays that scale with personality, the per-action `dwell` settings (`preClickMs`, `postActionMs`) and the personality's `speed` multiplier handle that automatically inside the humanized primitives.
