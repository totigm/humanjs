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
