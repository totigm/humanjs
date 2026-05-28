---
"@humanjs/playwright": minor
"@humanjs/core": minor
---

`Human` now re-exports 12 common Playwright `Page` methods so callers don't have to juggle two surfaces (`human.click` here, `page.screenshot` over there).

## What's new

The re-exports are thin forwards — Playwright's behavior unchanged, just reachable from `human.*`:

```ts
await human.screenshot();
await human.pageText();
await human.content();
await human.url();
await human.title();
await human.reload();
await human.goBack();
await human.goForward();
await human.waitForLoadState('networkidle');
await human.waitForURL('/dashboard');
await human.setViewportSize({ width, height });
await human.pdf({ path: 'out.pdf' });
```

## Why these specifically

The locked principle: **if it's a verb a user or agent performs OR a state read about the current page, it's a candidate. If it's lifecycle, environment setup, or power-user JS, it stays on `page`.**

That keeps `evaluate`, `exposeFunction`, `addLocatorHandler`, `close`, `context`, `browser`, and the rest of Playwright's lower-level surface where they belong — on `page` — so the `human.*` surface stays focused on "what a user does in a browser."

## Plugin observability

Three of the new methods are navigation actions that fire plugin events: `reload`, `goBack`, `goForward`. `KnownActionType` in `@humanjs/core` is extended with the matching variants so plugins switching on action type get IDE autocomplete.

The other nine (`screenshot`, `pageText`, `content`, `url`, `title`, `waitForLoadState`, `waitForURL`, `setViewportSize`, `pdf`) are pure forwards — no plugin events, no humanization. They're library-side reads or environment ops, not user actions.

## Why now

These land alongside the `@humanjs/mcp` work — the MCP server exposes the same surface as tools, and having the methods on `human.*` first means the MCP layer is a thin wrapper instead of reaching past `human` into `page` for inspection ops.
