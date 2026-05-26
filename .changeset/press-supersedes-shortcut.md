---
"@humanjs/playwright": minor
"@humanjs/core": patch
---

**Breaking:** `human.shortcut(chord)` is renamed to `human.press(key)`, and now accepts bare keys in addition to chords.

```ts
// Before
await human.shortcut('Mod+S');
await human.shortcut('Enter');   // worked, but the name read wrong

// After
await human.press('Mod+S');      // chord
await human.press('Tab');        // bare key — what `shortcut('Tab')` always meant
await human.press('Enter');
await human.press('Escape');
```

## Why

A single key like `Tab` isn't a "shortcut," and forcing users through `human.shortcut('Tab')` was a real readability smell. `press` matches Playwright's own `keyboard.press()` — one method that accepts either a bare key or a `Modifier+Key` chord — and removes the API duplication.

## What changed

| Old | New |
|---|---|
| `human.shortcut(chord)` | `human.press(key)` |
| `Shortcut` type | `KeyOrChord` |
| `ShortcutKey` type | `KeyName` |
| `ShortcutModifier` type | `KeyModifier` |
| `ShortcutResult` type | `PressResult` |
| Action params `{ type: 'shortcut', params: { chord } }` | `{ type: 'press', params: { key } }` |
| Runtime error: `"Invalid shortcut modifier: ..."` | `"Invalid key modifier: ..."` |

## Type changes

The `KeyOrChord` union adds a `(string & {})` escape hatch at the bare-key position, so uncommon keys (`'BracketLeft'`, `'NumpadAdd'`, locale-specific keys, …) typecheck without a modifier:

```ts
await human.press('BracketLeft');   // ✓ now typechecks (was a TS error under Shortcut)
await human.press('Mod+S');         // ✓
await human.press('Tab');           // ✓ autocompletes from KeyName
await human.press('Mosd+S');        // ✗ TS error — modifier still strictly closed
await human.press('Hyper+S');       // ✗ TS error
```

Modifier-typo protection is preserved: modifier names remain a closed union, so `'Mosd+S'` / `'Hyper+S'` / etc. are still caught at compile time.

## Migration

Pure renames — no behavior changes beyond accepting bare uncommon keys:

```diff
- import { type Shortcut } from '@humanjs/playwright';
+ import { type KeyOrChord } from '@humanjs/playwright';

- await human.shortcut('Mod+S');
+ await human.press('Mod+S');

  // Plugin handler:
- if (action.type === 'shortcut') { console.log(action.params.chord); }
+ if (action.type === 'press') { console.log(action.params.key); }
```

`@humanjs/core`'s `KnownActionType` swapped `'shortcut'` for `'press'` to match. The `(string & {})` widening on `ActionType` means custom adapters emitting `'shortcut'` still typecheck against the loose form, but they won't autocomplete.
