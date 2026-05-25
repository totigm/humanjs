// Public surface of @humanjs/recorder.
// Convenience helpers on top of @humanjs/playwright's recording API.

// Re-export the Recording type so users can annotate locals without a
// second @humanjs/playwright import. The class lives over there; we just
// surface the type for ergonomics.
export type { Recording } from '@humanjs/playwright';
export type { RecordCallback, RecordOptions } from './record';
export { record } from './record';
