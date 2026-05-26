---
"@humanjs/playwright": minor
---

Implements the primitives that CLAUDE.md's public API shape advertised but the codebase didn't yet ship — closing the documentation/reality gap on `@humanjs/playwright`'s Human surface — plus a new `move()` primitive for pure positional cursor motion:

```ts
await human.rightClick('#card');                 // context menu
await human.hover('button[aria-label="Help"]');  // hover without clicking
await human.move({ x: 600, y: 400 });            // pure positioning (canvas, dead space, cinematic beats)
await human.move('#anchor');                     // or to an element, no settle dwell
await human.drag('#card-1', '#slot-3');          // selector → selector
await human.drag('#slider', { x: 400, y: 220 }); // selector → point
await human.paste('#code-editor', longString);   // Cmd-V style, no per-key timing
await human.shortcut('Mod+S');                   // cross-platform Save
await human.shortcut('Cmd+Shift+P');             // literal Meta+Shift+P
await human.shortcut('Control+C');               // literal Ctrl+C (works on Mac too)
await human.shortcut('Enter');                   // single key
```

## What's new

- **`human.rightClick(target)`** — same Bezier path + hover-dwell as `click()`, dispatches with `button: 'right'`.
- **`human.hover(target)`** — moves the cursor along a humanized path and settles, no click. Includes a post-arrival dwell to let hover-state UI fire (tooltips, dropdowns). Element-bound.
- **`human.move(target)`** — pure positional cursor motion. Accepts `Locator | string | Point`. No settle dwell, no element interaction. Distinct from `hover`: `hover` is "hover an element so hover UI fires," `move` is "place the cursor here." Use `move` for canvas/SVG/dead-space positioning, pre-shortcut placement, or cinematic beats.
- **`human.drag(from, to)`** — humanized motion to `from`, mouse-down, second humanized path to `to` with the button held, mouse-up. Both endpoints accept `Locator | string | Point` — the `Point` form is essential for canvas/SVG/slider drags where the destination isn't a DOM element.
- **`human.paste(target, value)`** — drives an implicit click to focus (same pattern as `type`), then dumps the value via `page.keyboard.insertText`. The Cmd-V semantic — fast, no per-character rhythm. The implicit click is a sub-step of the paste action, same as `type`'s.
- **`human.shortcut(chord)`** — keyboard chord dispatcher with platform-aware `Mod` token. Detailed modifier rules in the JSDoc; new `'shortcut'` action type emitted to plugins with the original chord string in `params`. Does **not** move the cursor — keyboard shortcuts dispatch against focus, not cursor position. Compose with `click`/`hover`/`move` when you need both.

  **Typed chord parameter.** `chord` is a `Shortcut` — a template-literal union of every (canonical) modifier × key combination up to two modifiers. IDEs autocomplete valid chords as you type (`'Mod+S'`, `'Cmd+Shift+P'`, `'Ctrl+Alt+Delete'`), and **invalid modifiers are caught at compile time**: `'Mosd+S'` and `'Hyper+S'` are TypeScript errors, not runtime errors. The escape hatch lives on the key portion only — uncommon keys (`'Mod+BracketLeft'`, `'Mod+NumpadAdd'`, locale-specific keys) still typecheck under a known modifier. 3+ modifier chords (`'Ctrl+Shift+Alt+X'`) typecheck through the same key-side escape hatch; the cap at two literal modifiers is a TypeScript size-of-union constraint, not a runtime limit. Lowercase modifiers (`'mod+s'`) and bare uncommon keys without a modifier (`'BracketLeft'` alone) are TS errors too — runtime still accepts them, but the type steers toward canonical form for codebase consistency.

## New public types

- **`Shortcut`** — the typed chord union used by `human.shortcut(chord)`. Importable for users typing chord strings in their own helpers / config.
- **`ShortcutModifier`** — the canonical-case modifier names (`'Mod'`, `'Cmd'`, `'Ctrl'`, `'Alt'`, `'Shift'`, …). Plus aliases (`'Command'`, `'Control'`, `'Option'`, `'Win'`, `'Super'`, `'CmdOrCtrl'`).
- **`ShortcutKey`** — the canonical bare-key set (`'A'`–`'Z'`, `'0'`–`'9'`, `'F1'`–`'F12'`, `'ArrowUp'`, `'Enter'`, etc.). Uncommon keys go through the `Shortcut` union's key-side escape hatch.
- **`MouseTarget`** — `Locator | string | Point`. Used by `human.move()` and `human.drag()`. Was internal-only before this release; now exported so users can type local variables to that shape without a deep import.

## Modifier semantics for `shortcut`

| Token | Resolves to | Notes |
|---|---|---|
| `Mod`, `CmdOrCtrl` | `Meta` on macOS, `Control` elsewhere | The right token for cross-platform app shortcuts |
| `Cmd`, `Command`, `Meta`, `Win`, `Super` | `Meta` keycode | Literal — does **not** auto-translate to Control. Same physical key on every OS |
| `Ctrl`, `Control` | `Control` keycode | Literal — stays Control on every platform, so Mac-specific things like terminal `Ctrl+C` still work |
| `Alt`, `Option`, `Opt` | `Alt` keycode | Literal |
| `Shift` | `Shift` keycode | Literal |

Case-insensitive on both modifiers and key names. Invalid modifiers throw with a useful error message listing the valid options.

## Internal refactor

`executeClick` now accepts an optional `{ button }` option (used by both `human.click` and `human.rightClick`); previously the button was hardcoded. The mouse executor extracts a `moveToTarget` helper shared between click and hover, and a `resolveTargetPoint` helper (renamed from the internal `resolveDragTarget`) that handles selector/Locator/Point endpoints for both `drag` and `move`. The Human factory introduces a `mouseCtx()` accessor so every mouse primitive reads from the same `lastMousePosition` closure — successive actions chain off where the cursor actually was, including across the new primitives.

## Quality

- 167 playwright unit tests (was 123) — 44 new tests covering the six primitives, their event emission, instant-mode bypass paths, and edge cases.
- `resolveChord` is exported for the test suite; 17 of those new tests are pure-function coverage of the parser (platform mapping, aliases, case-insensitivity, error paths).
- 10 integration tests still green. Lint + typecheck clean.

## Migration

None — all five methods are net-new on the `Human` interface. No existing behavior changes. The `executeClick` signature gained an optional third argument (`ClickOptions`); the previous two-argument call sites continue to work unchanged.
