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

## Type behavior

`KeyOrChord` is fully enumerated — `KeyName | ${KeyModifier}+${KeyName} | ${KeyModifier}+${KeyModifier}+${KeyName}` — so every `Modifier+Key` combination is an autocomplete-able literal. Type `'Shift+'` in your IDE and you get the full `Shift+A`, `Shift+B`, …, `Shift+Tab` list as completions.

```ts
await human.press('Tab');             // ✓ autocompletes from KeyName
await human.press('Mod+S');           // ✓ autocompletes from Modifier × KeyName
await human.press('Shift+ArrowDown'); // ✓
await human.press('Mod+Shift+P');     // ✓ two-modifier chord
await human.press('Mosd+S');          // ✗ TS error — modifier closed set
await human.press('Hyper+S');         // ✗ TS error
await human.press('BracketLeft');     // ✗ TS error — outside KeyName
```

**Escape hatch.** Uncommon keys (`'BracketLeft'`, `'NumpadAdd'`, locale keys) and 3+ modifier chords (`'Ctrl+Shift+Alt+K'`) need a cast at the call site — the runtime parser handles them, the type just doesn't enumerate them:

```ts
await human.press('Mod+BracketLeft' as KeyOrChord);
await human.press('Ctrl+Shift+Alt+K' as KeyOrChord);
```

We tried a `(string & {})` escape hatch on the key portion of chords to make these work without a cast, but the cost was unacceptable: any `(string & {})` member in the union collapses TypeScript's template-literal IntelliSense to a single wide template, so completions for `'Shift+...'` / `'Mod+...'` disappear entirely. Autocomplete for the 95% case is the killer feature; the cast for rare keys is a worthwhile trade.

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
