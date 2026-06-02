---
"@humanjs/playwright": minor
"@humanjs/skill": patch
---

Add a Playwright Test fixture at the `@humanjs/playwright/test` subpath. It extends `@playwright/test`'s `test` with a ready-to-use `human` fixture — bound to the test's `page`, seeded from the test title (deterministic per test), and instant in CI / humanized locally — so specs skip the `createHuman` boilerplate:

```ts
import { test, expect } from '@humanjs/playwright/test';

test('checkout', async ({ human, page }) => {
  await human.goto('/cart');
  await human.click('Checkout');
  await expect(page).toHaveURL(/success/);
});
```

Customize per file or project via `test.use({ humanOptions: { … } })`. `@playwright/test` is an optional peer dependency (only needed for this subpath; the package root is unaffected).

The recorder's `toPlaywright()` code export now generates specs that use this fixture — `import { test, expect } from '@humanjs/playwright/test'` plus `test.use({ humanOptions: … })` carrying the recorded personality/seed/speed — instead of a per-test `createHuman` call. (`toHumanJS()`, the standalone script export, is unchanged.)
