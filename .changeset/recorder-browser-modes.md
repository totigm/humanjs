---
"@humanjs/recorder": minor
---

`record()` can now record in a persistent profile or attach to a browser you already launched — completing the browser-mode story alongside `@humanjs/mcp` (env/tools) and `@humanjs/playwright` (bring-your-own-page).

- **`userDataDir`** — record in a persistent profile so logins/cookies survive across runs (sign in once in a headed run, reuse it). Uses `launchPersistentContext`; `headless` / `launch` / `channel` / `viewport` still apply.
- **`cdpUrl`** — attach to a running browser over CDP (start it with `--remote-debugging-port`) and record its existing context — real logins, tabs, extensions. HumanJS **never closes** a browser it attached to; it only borrows it. Takes precedence over `userDataDir`.
- **`channel`** — launch an installed browser (`'chrome'`, `'msedge'`) instead of bundled Chromium (default + persistent modes). A channel alone does NOT reuse your profile — pair it with `userDataDir` or `cdpUrl` for logins.

```ts
// Stay signed in across runs
await record({ output: 'dashboard.mp4', userDataDir: './.humanjs-profile' }, async (human) => {
  await human.goto('https://app.example.com/dashboard');
});
```

Default behavior is unchanged — omit the new options and you get a fresh ephemeral browser as before.
