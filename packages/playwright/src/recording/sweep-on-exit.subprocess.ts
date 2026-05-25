/**
 * Subprocess harness for the sweep-on-exit integration test in
 * `recording.integration.test.ts`. NOT a test file itself — spawned by the
 * parent test as a separate Node process.
 *
 * Constructs a `Recording` with a real captured-frames temp directory and
 * then exits WITHOUT calling `dispose()`. The sweep-on-exit handler wired
 * in the `Recording` constructor must delete the temp dir before this
 * process is fully gone.
 *
 * The parent test reads the captured dir path from stdout, waits for this
 * process to exit, and then asserts the dir no longer exists.
 */

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Recording } from './index';

const dir = await mkdtemp(join(tmpdir(), 'humanjs-rec-sweep-test-'));
const framePath = join(dir, 'frame_000000.jpg');
// Minimal valid JPEG byte sequence — we don't need a renderable image, we
// just need a file on disk so the temp dir has contents to clean up.
await writeFile(framePath, Buffer.from([0xff, 0xd8, 0xff, 0xd9]));

// Construct the Recording. The constructor registers `dir` with the
// module-level sweep set; the `process.on('exit')` handler installed there
// will clean it when this process ends.
new Recording(
  {
    dir,
    frames: [{ path: framePath, tMs: 0 }],
    startedAtMs: 0,
    stoppedAtMs: 1000,
    format: 'jpeg',
    fps: 30,
    cleanup: () => rm(dir, { recursive: true, force: true }),
  },
  0,
  1000,
  { personality: 'careful', seed: null, speed: 'human', events: [] },
);

// Hand the path to the parent test so it can check whether the sweep ran.
process.stdout.write(dir);

// No explicit exit — letting Node exit naturally is what fires the
// 'exit' event the sweep handler listens for.
