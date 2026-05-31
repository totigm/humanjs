import type { Locator } from 'playwright';
import { executeClick, executeHover, type MouseContext } from '../mouse';

/** Values accepted by {@link executeSelectOption} — the Playwright `selectOption` shape. */
export type SelectOptionValues = Parameters<Locator['selectOption']>[0];
/** Files accepted by {@link executeUpload} — the Playwright `setInputFiles` shape. */
export type UploadFiles = Parameters<Locator['setInputFiles']>[0];

/** Form targets are element-bound: a selector or a pre-built `Locator`. */
export type FormTarget = Locator | string;

function toLocator(target: FormTarget, ctx: MouseContext): Locator {
  return typeof target === 'string' ? ctx.page.locator(target) : target;
}

function describe(target: FormTarget): string {
  return typeof target === 'string' ? target : (target.toString?.() ?? 'locator');
}

/**
 * Reads a checkable element's state, returning `null` when the element isn't
 * directly checkable (e.g. the target is a wrapping `<label>` or a styled
 * control). Used by {@link executeSetChecked} to guard idempotency and verify
 * the toggle only when the element actually reports a checked state.
 */
async function readChecked(locator: Locator): Promise<boolean | null> {
  try {
    return await locator.isChecked();
  } catch {
    return null;
  }
}

/**
 * Humanized checkbox/radio toggle. Moves the cursor to the control along a
 * Bezier path and clicks it (with the same hover dwell and occasional
 * near-miss as {@link executeClick}) — but only when a click is actually
 * needed:
 *
 *  - If the element already reports the desired state, no click fires. A
 *    real user doesn't re-click a box that's already in the state they want.
 *  - After toggling, the new state is verified. If it didn't change (e.g.
 *    trying to `uncheck` a radio, which can't be unchecked by clicking), a
 *    clear error is thrown rather than silently passing.
 *
 * The idempotency guard and verification are skipped when the element isn't
 * directly checkable (a `<label>` or `role`-based control where `isChecked()`
 * doesn't apply) — there the humanized click still toggles the associated
 * input, we just can't read/verify the state from this node.
 *
 * In `speed: 'instant'`, delegates to Playwright's native
 * `locator.check()` / `locator.uncheck()` (idempotent + actionability-checked).
 */
export async function executeSetChecked(
  target: FormTarget,
  ctx: MouseContext,
  checked: boolean,
): Promise<void> {
  const locator = toLocator(target, ctx);

  if (ctx.speed === 'instant') {
    if (checked) await locator.check();
    else await locator.uncheck();
    return;
  }

  const before = await readChecked(locator);
  // Already in the desired state — nothing to do (only short-circuit when the
  // state is actually readable; `null` means "not directly checkable", fall
  // through to a humanized click and let it toggle the associated control).
  if (before === checked) return;

  await executeClick(locator, ctx);

  const after = await readChecked(locator);
  if (after !== null && after !== checked) {
    throw new Error(
      `Cannot ${checked ? 'check' : 'uncheck'}: element did not reach the ${
        checked ? 'checked' : 'unchecked'
      } state after clicking (target: ${describe(target)}). Radios can't be unchecked by clicking — select a different option instead.`,
    );
  }
}

/**
 * Humanized native `<select>` choice. Moves the cursor to the dropdown along a
 * Bezier path and settles on it (the {@link executeHover} dwell), then sets the
 * value via Playwright's `selectOption`.
 *
 * Native selects open an OS-level menu Playwright can't drive visually, so the
 * humanized part is the *approach* — the value itself is set programmatically
 * (firing `input`/`change` events) the same way Playwright does. For custom,
 * DOM-rendered dropdowns, drive them with `click` + `click` on the rendered
 * options instead.
 *
 * In `speed: 'instant'`, sets the value with no cursor motion.
 *
 * Returns the list of option values that ended up selected.
 */
export async function executeSelectOption(
  target: FormTarget,
  values: SelectOptionValues,
  ctx: MouseContext,
): Promise<string[]> {
  const locator = toLocator(target, ctx);
  if (ctx.speed !== 'instant') {
    await executeHover(locator, ctx);
  }
  return locator.selectOption(values);
}

/**
 * Humanized file upload. Moves the cursor to the upload control along a Bezier
 * path (so the motion is visible in recordings / to the overlay), then sets the
 * files via Playwright's `setInputFiles`.
 *
 * The OS file picker can't be driven by automation, so — unlike a real click —
 * this never *clicks* the control (a click on `<input type="file">` would open
 * the native dialog and hang). Files are attached directly, which is how
 * Playwright models uploads. `target` should be the `<input type="file">`
 * itself; for the common "hidden input behind a styled button" pattern there's
 * no visible control to approach, so the cursor motion is skipped and the files
 * are attached directly.
 *
 * In `speed: 'instant'`, attaches the files with no cursor motion.
 */
export async function executeUpload(
  target: FormTarget,
  files: UploadFiles,
  ctx: MouseContext,
): Promise<void> {
  const locator = toLocator(target, ctx);
  if (ctx.speed !== 'instant') {
    try {
      await executeHover(locator, ctx);
    } catch {
      // Hidden file input (no bounding box) — common when a styled button
      // proxies a `display:none` input. No visible control to approach;
      // attach the files directly.
    }
  }
  await locator.setInputFiles(files);
}
