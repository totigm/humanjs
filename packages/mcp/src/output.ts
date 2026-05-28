import { basename, join } from 'node:path';

/**
 * Resolves a user/AI-supplied filename to a safe absolute path inside
 * `outputDir`. Rejects anything with path components (`../`, `sub/dir`,
 * absolute paths) so a prompt-injected filename can't write outside the
 * configured output directory.
 *
 * The AI picks the name; the env (HUMANJS_OUTPUT_DIR) picks the directory.
 */
export function resolveOutputPath(outputDir: string, filename: string): string {
  const base = basename(filename);
  if (base !== filename || base.length === 0) {
    throw new Error(
      `filename must be a plain name with no path components, got "${filename}". Files are always written to HUMANJS_OUTPUT_DIR.`,
    );
  }
  return join(outputDir, base);
}
