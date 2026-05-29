import { extname } from 'node:path';
import {
  type BrowserContext,
  type BrowserContextOptions,
  type CreateHumanOptions,
  chromium,
  createHuman,
  type Human,
  type InstallMouseHelperOptions,
  installMouseHelper,
  type LaunchOptions,
  type Page,
  type Recording,
  type RecordingQuality,
} from '@humanjs/playwright';

interface QualityBrowserPreset {
  readonly viewport: { readonly width: number; readonly height: number };
}

const QUALITY_BROWSER_PRESETS: Record<RecordingQuality, QualityBrowserPreset> = {
  // 720p source — small files, fast encoding, good for iteration.
  fast: { viewport: { width: 1280, height: 720 } },
  // 1080p source — balanced default for tests and dashboards.
  standard: { viewport: { width: 1920, height: 1080 } },
  // 1080p source, visually-lossless encoding (slow preset + animation tune).
  // Recommended for marketing / portfolio output.
  high: { viewport: { width: 1920, height: 1080 } },
  // 1080p source, archival-quality encoding (very slow, low CRF).
  lossless: { viewport: { width: 1920, height: 1080 } },
};

/**
 * Options for {@link record}. Most fields are passed straight through to
 * Playwright's `chromium.launch()` and `browser.newContext()` so a one-call
 * recording can configure anything a full Playwright setup could.
 */
export interface RecordOptions extends CreateHumanOptions {
  /**
   * Output path. Extension determines format — `.mp4` / `.webm` for video,
   * or `.gif` for an animated GIF (palette-optimized, defaults to 15fps).
   * Omit to skip capture entirely; the returned {@link Recording} still has
   * the structured action timeline via `.toTimeline()` / `.timeline`.
   */
  readonly output?: string;
  /**
   * Optional label for the recording — becomes the title of a generated
   * `toPlaywright()` test. See `@humanjs/playwright`'s `HumanRecordOptions.name`.
   */
  readonly name?: string;
  /**
   * Quality preset. Picks both source viewport and ffmpeg encoding settings.
   * Defaults to `'high'` (visually-lossless 1080p).
   *
   * - `'fast'`: 720p, CRF 23, preset fast
   * - `'standard'`: 1080p, CRF 20, preset fast
   * - `'high'` (default): 1080p, CRF 18, preset slow, tune animation
   * - `'lossless'`: 1080p, CRF 12, preset veryslow, tune animation
   */
  readonly quality?: RecordingQuality;
  /**
   * Capture actual typed/pasted text into the timeline, so `toHumanJS()` /
   * `toPlaywright()` exports include the values. Defaults to `true`; password
   * fields are always masked. Set `false` to record no input values (exports
   * emit empty-string placeholders). See `@humanjs/playwright`'s
   * `HumanRecordOptions.captureInputs`.
   */
  readonly captureInputs?: boolean;
  /** Optional URL to navigate to before the callback runs. */
  readonly url?: string;
  /**
   * Viewport dimensions. Overrides the quality preset's viewport. Applies to
   * the default and persistent (`userDataDir`) modes; ignored when attaching
   * over `cdpUrl`, where the real browser window's size wins (see `cdpUrl`).
   */
  readonly viewport?: { readonly width: number; readonly height: number };
  /** Run headless. Defaults to `false` so users can watch the recording happen. */
  readonly headless?: boolean;
  /** Forwarded to `chromium.launch()` (alongside `headless`). */
  readonly launch?: LaunchOptions;
  /** Forwarded to `browser.newContext()` (alongside `viewport`). */
  readonly context?: BrowserContextOptions;
  /**
   * Record in a **persistent profile** at this directory so logins and
   * cookies survive across runs — sign in once (in a headed run), and later
   * recordings start authenticated. Uses `launchPersistentContext` under the
   * hood (a single context); `headless`, `launch`, `channel`, and `viewport`
   * still apply. Starts empty the first time.
   */
  readonly userDataDir?: string;
  /**
   * Record by **attaching to a browser you already launched** over CDP (e.g.
   * `"http://localhost:9222"`). Reuses that browser's existing context — your
   * real logins, tabs, extensions. Start the browser yourself with
   * `--remote-debugging-port`. HumanJS never closes a browser it attached to;
   * it only borrows it. Takes precedence over `userDataDir`.
   *
   * `launch` / `headless` / `channel` / `viewport` don't apply here — you're
   * borrowing a window HumanJS doesn't own, so the browser's real window size
   * wins. Forcing a `viewport` would only *emulate* one and letterbox the
   * capture. For a fixed recording resolution, launch the browser yourself
   * with `--window-size=1920,1080`, or use the default / persistent modes.
   */
  readonly cdpUrl?: string;
  /**
   * Playwright browser channel — e.g. `'chrome'`, `'msedge'`. Launches that
   * installed browser's binary instead of bundled Chromium (applies to the
   * default and `userDataDir` modes). NOTE: a channel alone does NOT reuse
   * your existing profile — pair it with `userDataDir` (persistent) or
   * `cdpUrl` (attach) for real logins.
   */
  readonly channel?: string;
  /**
   * Install the HumanJS visible cursor overlay so recorded videos show
   * mouse motion — Playwright's synthetic mouse doesn't render a cursor
   * by itself, so without this the recording would look like text and
   * UI changing on their own.
   *
   * - `true` (default): install with default styling (HumanJS amber, 22px)
   * - `false`: don't install — the user will install their own, or the
   *   recording intentionally has no visible cursor
   * - {@link InstallMouseHelperOptions}: install with custom color / size /
   *   click-ripple / halo settings
   *
   * The helper is installed on the context via `addInitScript` + a
   * DOMContentLoaded listener, so it persists across `page.setContent()`
   * and navigation inside the callback.
   */
  readonly cursor?: boolean | InstallMouseHelperOptions;
}

/** The callback shape both overloads of {@link record} accept. */
export type RecordCallback = (human: Human, page: Page) => Promise<void>;

/**
 * One-call session recording. Launches (or attaches to) a browser, opens a
 * page, creates a humanized session, runs `fn`, and returns a
 * {@link Recording} you can export to video, JSON timeline, or read in-memory.
 *
 * Browser source (default → ephemeral fresh profile):
 * - `userDataDir` — a persistent profile that keeps logins across runs.
 * - `cdpUrl` — attach to a browser you launched yourself (real logins/tabs);
 *   never closed on finish, only released.
 *
 * If `options.output` is set, the output file is written to that path before
 * `record()` resolves — extension dispatches to `toVideo` (`.mp4` / `.webm`)
 * or `toGif` (`.gif`). The returned Recording is still useful for additional
 * exports via `toVideo` / `toGif` / `toTimeline` (all repeatable). If
 * `output` is omitted, frame capture is skipped entirely (no encoding
 * overhead) and only the timeline is captured.
 *
 * @example
 * ```ts
 * // Video + timeline
 * const rec = await record({ output: 'demo.mp4' }, async (human) => {
 *   await human.click('#login');
 * });
 * await rec.toTimeline('demo.json');
 * console.log(rec.durationMs, rec.timeline.events.length);
 * ```
 *
 * @example
 * ```ts
 * // Stay signed in across runs (persistent profile)
 * await record({ output: 'dashboard.mp4', userDataDir: './.humanjs-profile' }, async (human) => {
 *   await human.goto('https://app.example.com/dashboard');
 * });
 * ```
 *
 * For multi-page flows or recording a slice of a larger session, use
 * `human.record()` from `@humanjs/playwright` directly.
 */
export function record(fn: RecordCallback): Promise<Recording>;
export function record(options: RecordOptions, fn: RecordCallback): Promise<Recording>;
export async function record(
  optionsOrFn: RecordCallback | RecordOptions,
  maybeFn?: RecordCallback,
): Promise<Recording> {
  const [options, fn] =
    typeof optionsOrFn === 'function'
      ? [{} as RecordOptions, optionsOrFn]
      : [optionsOrFn, maybeFn as RecordCallback];

  const {
    output,
    name,
    quality,
    captureInputs,
    url,
    viewport,
    headless,
    launch,
    context: contextOptions,
    userDataDir,
    cdpUrl,
    channel,
    cursor,
    ...createHumanOptions
  } = options;

  const resolvedQuality: RecordingQuality = quality ?? 'high';
  const browserPreset = QUALITY_BROWSER_PRESETS[resolvedQuality];
  const resolvedViewport = viewport ?? contextOptions?.viewport ?? browserPreset.viewport;
  const wantsCapture = output !== undefined;

  const { page, dispose } = await acquireRecordingContext({
    cdpUrl,
    userDataDir,
    channel,
    headless: headless ?? false,
    viewport: resolvedViewport,
    launch,
    context: contextOptions,
    cursor,
  });

  try {
    if (url) await page.goto(url);

    const human = await createHuman(page, createHumanOptions);

    // Capture runs only when the caller asked for an output file — saves
    // the screenshot + disk-write overhead for timeline-only recordings.
    const recording = await human.record(
      { name, video: wantsCapture, quality: resolvedQuality, captureInputs },
      () => fn(human, page),
    );

    if (wantsCapture && output) {
      // Dispatch by extension: .gif goes through the GIF exporter (which
      // ignores `quality` — GIF doesn't have a CRF concept), everything
      // else flows into the mp4/webm encoder with the chosen preset.
      const ext = extname(output).toLowerCase();
      if (ext === '.gif') {
        await recording.toGif(output);
      } else {
        await recording.toVideo(output, { quality: resolvedQuality });
      }
    }

    return recording;
  } finally {
    await dispose();
  }
}

/** Internal options for {@link acquireRecordingContext}. */
interface AcquireOptions {
  readonly cdpUrl?: string;
  readonly userDataDir?: string;
  readonly channel?: string;
  readonly headless: boolean;
  readonly viewport: { readonly width: number; readonly height: number };
  readonly launch?: LaunchOptions;
  readonly context?: BrowserContextOptions;
  readonly cursor?: boolean | InstallMouseHelperOptions;
}

/**
 * Resolves the browser source — CDP attach > persistent profile > ephemeral
 * — and returns the page to drive plus a `dispose` that tears down only what
 * we created. A CDP-attached browser is borrowed: `dispose` leaves it (and
 * its context) untouched so we never close the caller's real browser.
 */
async function acquireRecordingContext(
  opts: AcquireOptions,
): Promise<{ page: Page; dispose: () => Promise<void> }> {
  const cursorOptions = typeof opts.cursor === 'object' ? opts.cursor : undefined;
  const installCursor = async (ctx: BrowserContext): Promise<void> => {
    if (opts.cursor !== false) await installMouseHelper(ctx, cursorOptions);
  };

  // Attach to a browser the caller launched. Reuse its existing context so we
  // record their real session; only make a fresh one if there's none. Never
  // close it on dispose — it's borrowed.
  if (opts.cdpUrl) {
    const browser = await chromium.connectOverCDP(opts.cdpUrl);
    const context = browser.contexts()[0] ?? (await browser.newContext({ ...opts.context }));
    await installCursor(context);
    const page = context.pages()[0] ?? (await context.newPage());
    return { page, dispose: async () => undefined };
  }

  // Persistent profile — the context owns its browser, so closing it on
  // dispose tears everything down.
  if (opts.userDataDir) {
    const context = await chromium.launchPersistentContext(opts.userDataDir, {
      ...opts.launch,
      ...opts.context,
      channel: opts.channel ?? opts.launch?.channel,
      headless: opts.headless,
      viewport: opts.viewport,
    });
    await installCursor(context);
    const page = context.pages()[0] ?? (await context.newPage());
    return {
      page,
      dispose: async () => {
        await context.close().catch(() => undefined);
      },
    };
  }

  // Ephemeral (default) — a fresh throwaway browser + context.
  const browser = await chromium.launch({
    ...opts.launch,
    channel: opts.channel ?? opts.launch?.channel,
    headless: opts.headless,
  });
  const context = await browser.newContext({ ...opts.context, viewport: opts.viewport });
  await installCursor(context);
  const page = await context.newPage();
  return {
    page,
    dispose: async () => {
      await context.close().catch(() => undefined);
      await browser.close().catch(() => undefined);
    },
  };
}
