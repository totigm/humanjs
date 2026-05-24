---
"@humanjs/playwright": minor
---

`human.read()` now defaults `withMotion` to `true` (was `false`).

The cursor scans across the target's bounding box while the dwell elapses by default — "reading" implies looking, and looking implies motion. The opt-in semantics felt backwards: every demo and most user code was passing `{ withMotion: true }`, and skipping it produced an invisible "just sleep" that looked broken in recordings.

Pass `{ withMotion: false }` to skip motion when you only care about the temporal pattern — typical AI-agent use case where the cursor position is irrelevant:

```ts
// Default — cursor traces the passage during the dwell
await human.read('.passage');

// Opt-out — just the dwell, no cursor motion
await human.read('.passage', { withMotion: false });
```

**Migration note**: code that called `human.read(selector)` and depended on the cursor staying put will see the cursor scan across the target. Add `{ withMotion: false }` to restore the previous behavior.
