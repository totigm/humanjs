import {
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
   * Video output path. Extension determines format — `.mp4` or `.webm`.
   * Omit to skip video entirely; the returned {@link Recording} still has
   * the structured action timeline via `.toTimeline()` / `.timeline`.
   */
  readonly output?: string;
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
  /** Optional URL to navigate to before the callback runs. */
  readonly url?: string;
  /** Viewport dimensions. Overrides the quality preset's viewport. */
  readonly viewport?: { readonly width: number; readonly height: number };
  /** Run headless. Defaults to `false` so users can watch the recording happen. */
  readonly headless?: boolean;
  /** Forwarded to `chromium.launch()` (alongside `headless`). */
  readonly launch?: LaunchOptions;
  /** Forwarded to `browser.newContext()` (alongside `viewport`). */
  readonly context?: BrowserContextOptions;
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
 * One-call session recording. Launches a browser, opens a page, creates a
 * humanized session, runs `fn`, and returns a {@link Recording} you can
 * export to video, JSON timeline, or read in-memory.
 *
 * If `options.output` is set, the video is written to that path before
 * `record()` resolves — the returned Recording is still useful for
 * `toTimeline()` and `.timeline`. If `output` is omitted, capture is
 * skipped entirely (no encoding overhead) and only the timeline is captured.
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
 * // Timeline only, no video overhead
 * const rec = await record(async (human) => {
 *   await human.click('#login');
 * });
 * await rec.toTimeline('demo.json');
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
    quality,
    url,
    viewport,
    headless,
    launch,
    context,
    cursor,
    ...createHumanOptions
  } = options;

  const resolvedQuality: RecordingQuality = quality ?? 'high';
  const browserPreset = QUALITY_BROWSER_PRESETS[resolvedQuality];
  const resolvedViewport = viewport ?? context?.viewport ?? browserPreset.viewport;
  const wantsVideo = output !== undefined;

  const browser = await chromium.launch({
    ...launch,
    headless: headless ?? false,
  });
  try {
    const browserContext = await browser.newContext({
      ...context,
      viewport: resolvedViewport,
    });
    try {
      // Install the visible-cursor overlay before any page is created so
      // the addInitScript runs on the initial page render — and on any
      // page.setContent() inside the callback too.
      if (cursor !== false) {
        const cursorOptions = typeof cursor === 'object' ? cursor : undefined;
        await installMouseHelper(browserContext, cursorOptions);
      }

      const page = await browserContext.newPage();
      if (url) await page.goto(url);

      const human = await createHuman(page, createHumanOptions);

      // Capture runs only when the caller asked for a video — saves the
      // screenshot + disk-write overhead for timeline-only recordings.
      const recording = await human.record({ video: wantsVideo, quality: resolvedQuality }, () =>
        fn(human, page),
      );

      if (wantsVideo) {
        await recording.toVideo(output, { quality: resolvedQuality });
      }

      return recording;
    } finally {
      await browserContext.close().catch(() => undefined);
    }
  } finally {
    await browser.close();
  }
}
